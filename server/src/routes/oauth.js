import express from 'express';
import { all, one, run } from '../db.js';
import { newId, encrypt, decrypt } from '../lib/crypto.js';
import { requireAuth } from '../lib/auth.js';
import { loadAccountDetail } from '../lib/portfolio.js';
import {
  buildAuthUrl,
  exchangeCode,
  isOAuthConfigured,
  OAuthError,
  readState,
  revokeToken,
  signState,
} from '../lib/googleauth.js';
import { fetchAuthorisedChannel, fetchMonthlyRevenue } from '../lib/ytanalytics.js';

const router = express.Router();

const appUrl = () => (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '');

/* ------------------------------------------------------------ start flow */

/** Returns the Google consent URL for one channel. */
router.post('/youtube/connect/:accountId', requireAuth, async (req, res, next) => {
  try {
    if (req.isDemo) return res.status(403).json({ error: 'Connect a real account to pull exact revenue.' });
    if (!isOAuthConfigured()) {
      return res.status(503).json({ error: 'Exact-revenue sync is not configured on this server yet.', code: 'OAUTH_UNCONFIGURED' });
    }

    const account = await one('SELECT id FROM accounts WHERE id = ? AND user_id = ?', [req.params.accountId, req.userId]);
    if (!account) return res.status(404).json({ error: 'Account not found.' });

    const url = buildAuthUrl(signState({ userId: req.userId, accountId: account.id }));
    res.json({ url });
  } catch (err) {
    if (err instanceof OAuthError) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

/* -------------------------------------------------------------- callback */

/**
 * Google redirects the browser here. It is not an API call, so it always ends
 * in a redirect back into the app rather than a JSON body.
 */
router.get('/youtube/callback', async (req, res) => {
  const back = (params) => res.redirect(`${appUrl()}/channels?${new URLSearchParams(params)}`);

  try {
    if (req.query.error) return back({ ytError: String(req.query.error) });

    const { userId, accountId } = readState(String(req.query.state || ''));
    const tokens = await exchangeCode(String(req.query.code || ''));

    let connected = null;
    try {
      connected = await fetchAuthorisedChannel(tokens.refresh_token);
    } catch {
      /* non-fatal — the token still works for analytics */
    }

    await run(
      `UPDATE accounts SET yt_refresh_token = ?, yt_connected_at = ?, yt_connected_channel = ?, yt_revenue_error = NULL, updated_at = ?
       WHERE id = ? AND user_id = ?`,
      [
        encrypt(tokens.refresh_token),
        new Date().toISOString(),
        connected?.title ?? null,
        new Date().toISOString(),
        accountId,
        userId,
      ]
    );

    // Pull straight away so the customer sees real numbers immediately.
    let imported = 0;
    try {
      imported = (await importRevenue(userId, accountId)).imported;
    } catch {
      /* surfaced on the channel page via yt_revenue_error */
    }

    return res.redirect(`${appUrl()}/channels/${accountId}?ytConnected=1&months=${imported}`);
  } catch (err) {
    return back({ ytError: err instanceof OAuthError ? err.message : 'Could not complete the connection.' });
  }
});

/* -------------------------------------------------------- revenue import */

/**
 * Pull real monthly earnings and write them in as payouts. Payouts already
 * override the RPM model everywhere, so nothing downstream needs to change —
 * the channel simply starts reporting exact figures.
 */
export async function importRevenue(userId, accountId) {
  const account = await one('SELECT * FROM accounts WHERE id = ? AND user_id = ?', [accountId, userId]);
  if (!account) throw new OAuthError('Account not found.', 404);

  const refreshToken = decrypt(account.yt_refresh_token);
  if (!refreshToken) throw new OAuthError('This channel is not connected to YouTube yet.', 400);

  const now = new Date().toISOString();
  let months;
  try {
    months = await fetchMonthlyRevenue(refreshToken);
  } catch (err) {
    await run('UPDATE accounts SET yt_revenue_error = ?, yt_revenue_synced_at = ? WHERE id = ?', [err.message, now, accountId]);
    throw err;
  }

  let imported = 0;
  for (const m of months) {
    if (!m.period) continue;
    const existing = await one('SELECT id FROM payouts WHERE account_id = ? AND period = ?', [accountId, m.period]);
    if (existing) {
      await run('UPDATE payouts SET amount = ?, note = ? WHERE id = ?', [m.amount, 'YouTube Analytics', existing.id]);
    } else {
      await run('INSERT INTO payouts (id, user_id, account_id, period, amount, note, created_at) VALUES (?,?,?,?,?,?,?)', [
        newId(), userId, accountId, m.period, m.amount, 'YouTube Analytics', now,
      ]);
    }
    imported++;
  }

  await run('UPDATE accounts SET yt_revenue_synced_at = ?, yt_revenue_error = NULL WHERE id = ?', [now, accountId]);
  return { imported };
}

router.post('/youtube/refresh/:accountId', requireAuth, async (req, res, next) => {
  try {
    if (req.isDemo) return res.status(403).json({ error: 'Not available in the demo workspace.' });
    const result = await importRevenue(req.userId, req.params.accountId);
    res.json({ account: await loadAccountDetail(req.userId, req.params.accountId), imported: result.imported });
  } catch (err) {
    if (err instanceof OAuthError) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

router.delete('/youtube/connect/:accountId', requireAuth, async (req, res, next) => {
  try {
    const account = await one('SELECT * FROM accounts WHERE id = ? AND user_id = ?', [req.params.accountId, req.userId]);
    if (!account) return res.status(404).json({ error: 'Account not found.' });

    const token = decrypt(account.yt_refresh_token);
    if (token) await revokeToken(token);

    await run(
      `UPDATE accounts SET yt_refresh_token = NULL, yt_connected_at = NULL, yt_connected_channel = NULL,
        yt_revenue_synced_at = NULL, yt_revenue_error = NULL WHERE id = ? AND user_id = ?`,
      [account.id, req.userId]
    );
    res.json({ account: await loadAccountDetail(req.userId, account.id) });
  } catch (err) {
    next(err);
  }
});

/** Nightly: keep every connected channel's earnings current, unattended. */
export async function refreshAllConnected() {
  if (!isOAuthConfigured()) return 0;
  const rows = await all('SELECT id, user_id FROM accounts WHERE yt_refresh_token IS NOT NULL');
  let ok = 0;
  for (const row of rows) {
    try {
      await importRevenue(row.user_id, row.id);
      ok++;
    } catch {
      /* the per-account error column already records why */
    }
  }
  return ok;
}

export default router;
