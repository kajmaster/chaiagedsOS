import express from 'express';
import { all, one, run } from '../db.js';
import { newId, encrypt } from '../lib/crypto.js';
import { requireAuth, blockDemoWrites } from '../lib/auth.js';
import { loadPortfolio, loadAccountDetail } from '../lib/portfolio.js';
import { resolveChannel, fetchChannelVideos, isConfigured, YouTubeError } from '../lib/youtube.js';
import { NICHES, estimateFromChannel } from '../lib/rpm.js';
import { planError } from '../lib/plans.js';
import { detectNiche, detectTier } from '../lib/classify.js';
import { rateLimit } from '../lib/ratelimit.js';

const router = express.Router();
router.use(requireAuth);

const NICHE_IDS = new Set(NICHES.map((n) => n.id));
const TIERS = new Set(['tier1', 'tier2', 'tier3', 'tier4', 'mixed']);
const STATUSES = new Set(['active', 'warming', 'paused', 'sold', 'banned']);

const money = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0;
};
const int = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
};
const text = (v) => {
  const s = v == null ? '' : String(v).trim();
  return s === '' ? null : s.slice(0, 2000);
};

async function owned(userId, accountId) {
  return one('SELECT * FROM accounts WHERE id = ? AND user_id = ?', [accountId, userId]);
}

/* ------------------------------------------------------------------ reads */

router.get('/', async (req, res, next) => {
  try {
    const { accounts, summary, timeline } = await loadPortfolio(req.userId);
    res.json({ accounts, summary, timeline, syncAvailable: isConfigured() });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const detail = await loadAccountDetail(req.userId, req.params.id);
    if (!detail) return res.status(404).json({ error: 'Account not found.' });
    res.json({ account: detail });
  } catch (err) {
    next(err);
  }
});

/** Explicit, audited unlock of the credential vault. */
router.post('/:id/credentials', async (req, res, next) => {
  try {
    const detail = await loadAccountDetail(req.userId, req.params.id, { reveal: true });
    if (!detail) return res.status(404).json({ error: 'Account not found.' });
    res.json({ credentials: detail.credentials });
  } catch (err) {
    next(err);
  }
});

/* ---------------------------------------------------------------- lookups */

/**
 * Preview a channel before it is saved — powers the "paste a URL" flow.
 *
 * Deliberately available to demo visitors: pasting your own channel and seeing
 * what it is worth is the product's whole pitch, so it must be the one thing a
 * prospect can do before signing up. It writes nothing, and the rate limit below
 * keeps the shared YouTube quota safe from abuse.
 */
router.post('/lookup', async (req, res, next) => {
  try {
    const scope = req.isDemo ? 'demo' : 'user';
    const limit = req.isDemo ? 15 : 60;
    const gate = rateLimit({ key: `lookup:${scope}:${req.userId}`, limit, windowMs: 3_600_000 });
    if (!gate.allowed) {
      return res.status(429).json({
        error: `That's a lot of lookups. Try again in ${Math.ceil(gate.retryAfter / 60)} minutes.`,
        retryAfter: gate.retryAfter,
      });
    }

    const channel = await resolveChannel(req.body?.query);

    // Guess the niche and audience here, so the estimate the prospect sees and
    // the numbers they get after signing up come from identical logic.
    const { niche, confident } = detectNiche(channel.title, channel.description);
    const audienceTier = detectTier(channel.country);

    res.json({
      channel,
      suggestion: { niche, audienceTier, confident },
      estimate: estimateFromChannel(channel, niche, audienceTier),
    });
  } catch (err) {
    if (err instanceof YouTubeError) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

/* ----------------------------------------------------------------- writes */

router.post('/', blockDemoWrites, async (req, res, next) => {
  try {
    const b = req.body || {};
    const nickname = text(b.nickname);
    if (!nickname) return res.status(400).json({ error: 'Give the channel a name.' });

    const user = await one('SELECT plan FROM users WHERE id = ?', [req.userId]);
    const { count } = (await one('SELECT COUNT(*) AS count FROM accounts WHERE user_id = ?', [req.userId])) ?? { count: 0 };
    const limit = planError(user?.plan, Number(count));
    if (limit) return res.status(402).json(limit);

    const now = new Date().toISOString();
    const id = newId();
    const niche = NICHE_IDS.has(b.niche) ? b.niche : 'other';
    const tier = TIERS.has(b.audienceTier) ? b.audienceTier : 'tier1';
    const status = STATUSES.has(b.status) ? b.status : 'active';

    await run(
      `INSERT INTO accounts (
         id, user_id, nickname, niche, audience_tier, status,
         channel_url, channel_id, handle, thumbnail,
         account_created_at, acquired_at, acquisition_cost, monthly_cost,
         subscribers, total_views, video_count, monetized, rpm_override, notes,
         cred_username, cred_email, cred_password, cred_2fa, cred_recovery,
         last_synced_at, sync_error, created_at, updated_at
       ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id, req.userId, nickname, niche, tier, status,
        text(b.channelUrl), text(b.channelId), text(b.handle), text(b.thumbnail),
        text(b.accountCreatedAt), text(b.acquiredAt) ?? now, money(b.acquisitionCost), money(b.monthlyCost),
        int(b.subscribers), int(b.totalViews), int(b.videoCount), b.monetized ? 1 : 0,
        b.rpmOverride ? money(b.rpmOverride) : null, text(b.notes),
        encrypt(b.credentials?.username), encrypt(b.credentials?.email), encrypt(b.credentials?.password),
        encrypt(b.credentials?.twoFactor), encrypt(b.credentials?.recoveryEmail),
        null, null, now, now,
      ]
    );

    // If they gave us a channel, hydrate it immediately — zero manual typing.
    if (isConfigured() && (b.channelUrl || b.channelId || b.handle)) {
      await syncAccount(req.userId, id).catch(() => {});
    }

    res.status(201).json({ account: await loadAccountDetail(req.userId, id) });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', blockDemoWrites, async (req, res, next) => {
  try {
    const row = await owned(req.userId, req.params.id);
    if (!row) return res.status(404).json({ error: 'Account not found.' });

    const b = req.body || {};
    const sets = [];
    const params = [];
    const set = (col, val) => {
      sets.push(`${col} = ?`);
      params.push(val);
    };

    if (b.nickname !== undefined) set('nickname', text(b.nickname) ?? row.nickname);
    if (b.niche !== undefined) set('niche', NICHE_IDS.has(b.niche) ? b.niche : 'other');
    if (b.audienceTier !== undefined) set('audience_tier', TIERS.has(b.audienceTier) ? b.audienceTier : 'tier1');
    if (b.status !== undefined) set('status', STATUSES.has(b.status) ? b.status : 'active');
    if (b.channelUrl !== undefined) set('channel_url', text(b.channelUrl));
    if (b.channelId !== undefined) set('channel_id', text(b.channelId));
    if (b.handle !== undefined) set('handle', text(b.handle));
    if (b.accountCreatedAt !== undefined) set('account_created_at', text(b.accountCreatedAt));
    if (b.acquiredAt !== undefined) set('acquired_at', text(b.acquiredAt));
    if (b.acquisitionCost !== undefined) set('acquisition_cost', money(b.acquisitionCost));
    if (b.monthlyCost !== undefined) set('monthly_cost', money(b.monthlyCost));
    if (b.subscribers !== undefined) set('subscribers', int(b.subscribers));
    if (b.totalViews !== undefined) set('total_views', int(b.totalViews));
    if (b.videoCount !== undefined) set('video_count', int(b.videoCount));
    if (b.monetized !== undefined) set('monetized', b.monetized ? 1 : 0);
    if (b.rpmOverride !== undefined) set('rpm_override', b.rpmOverride ? money(b.rpmOverride) : null);
    if (b.notes !== undefined) set('notes', text(b.notes));

    // Credentials: only touch fields explicitly present, so a partial save
    // can never wipe a password the user didn't retype.
    const c = b.credentials;
    if (c && typeof c === 'object') {
      if (c.username !== undefined) set('cred_username', encrypt(c.username));
      if (c.email !== undefined) set('cred_email', encrypt(c.email));
      if (c.password !== undefined) set('cred_password', encrypt(c.password));
      if (c.twoFactor !== undefined) set('cred_2fa', encrypt(c.twoFactor));
      if (c.recoveryEmail !== undefined) set('cred_recovery', encrypt(c.recoveryEmail));
    }

    if (!sets.length) return res.json({ account: await loadAccountDetail(req.userId, row.id) });

    set('updated_at', new Date().toISOString());
    params.push(row.id, req.userId);
    await run(`UPDATE accounts SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`, params);

    res.json({ account: await loadAccountDetail(req.userId, row.id) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', blockDemoWrites, async (req, res, next) => {
  try {
    const row = await owned(req.userId, req.params.id);
    if (!row) return res.status(404).json({ error: 'Account not found.' });
    await run('DELETE FROM videos WHERE account_id = ?', [row.id]);
    await run('DELETE FROM payouts WHERE account_id = ?', [row.id]);
    await run('DELETE FROM snapshots WHERE account_id = ?', [row.id]);
    await run('DELETE FROM accounts WHERE id = ? AND user_id = ?', [row.id, req.userId]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------- sync */

/**
 * Pull live stats from YouTube and reconcile the video table.
 * Costs the customer typed into a video are preserved — we only ever
 * overwrite machine-owned fields (views, likes, comments, title, thumbnail).
 */
export async function syncAccount(userId, accountId) {
  const row = await one('SELECT * FROM accounts WHERE id = ? AND user_id = ?', [accountId, userId]);
  if (!row) throw new YouTubeError('Account not found.', 404);

  const query = row.channel_id || row.channel_url || row.handle;
  if (!query) throw new YouTubeError('Add a YouTube channel URL to this account first.', 400);

  const now = new Date().toISOString();
  let channel;
  try {
    channel = await resolveChannel(query);
  } catch (err) {
    await run('UPDATE accounts SET sync_error = ?, last_synced_at = ? WHERE id = ?', [err.message, now, accountId]);
    throw err;
  }

  const videos = await fetchChannelVideos(channel.uploadsPlaylistId, 50);
  const existing = await all('SELECT * FROM videos WHERE account_id = ?', [accountId]);
  const byYtId = new Map(existing.filter((v) => v.yt_video_id).map((v) => [v.yt_video_id, v]));

  let added = 0;
  let updated = 0;
  for (const v of videos) {
    const prior = byYtId.get(v.ytVideoId);
    if (prior) {
      await run(
        `UPDATE videos SET title = ?, thumbnail = ?, published_at = ?, views = ?, likes = ?, comments = ?, source = 'youtube', updated_at = ?
         WHERE id = ?`,
        [v.title, v.thumbnail, v.publishedAt, v.views, v.likes, v.comments, now, prior.id]
      );
      updated++;
    } else {
      await run(
        `INSERT INTO videos (id, account_id, user_id, yt_video_id, title, thumbnail, published_at, views, likes, comments, cost, revenue_actual, source, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [newId(), accountId, userId, v.ytVideoId, v.title, v.thumbnail, v.publishedAt, v.views, v.likes, v.comments, 0, null, 'youtube', now, now]
      );
      added++;
    }
  }

  await run(
    `UPDATE accounts SET channel_id = ?, handle = ?, channel_url = ?, thumbnail = ?,
       subscribers = ?, total_views = ?, video_count = ?, account_created_at = COALESCE(account_created_at, ?),
       last_synced_at = ?, sync_error = NULL, updated_at = ?
     WHERE id = ? AND user_id = ?`,
    [
      channel.channelId, channel.handle, channel.url, channel.thumbnail,
      channel.subscribers, channel.totalViews, channel.videoCount, channel.publishedAt,
      now, now, accountId, userId,
    ]
  );

  await run(
    `INSERT INTO snapshots (id, user_id, account_id, taken_on, subscribers, total_views) VALUES (?,?,?,?,?,?)`,
    [newId(), userId, accountId, now.slice(0, 10), channel.subscribers, channel.totalViews]
  );

  return { added, updated, channel };
}

router.post('/:id/sync', blockDemoWrites, async (req, res, next) => {
  try {
    const result = await syncAccount(req.userId, req.params.id);
    res.json({
      account: await loadAccountDetail(req.userId, req.params.id),
      sync: { added: result.added, updated: result.updated, channel: result.channel.title },
    });
  } catch (err) {
    if (err instanceof YouTubeError) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

/** Sync everything the customer owns in one click. */
router.post('/sync-all', blockDemoWrites, async (req, res, next) => {
  try {
    if (!isConfigured()) return res.status(503).json({ error: 'YouTube sync is not configured on this server.' });
    const rows = await all(
      `SELECT id, nickname FROM accounts WHERE user_id = ? AND status IN ('active','warming')`,
      [req.userId]
    );
    const results = [];
    for (const row of rows) {
      try {
        const r = await syncAccount(req.userId, row.id);
        results.push({ id: row.id, nickname: row.nickname, ok: true, added: r.added, updated: r.updated });
      } catch (err) {
        results.push({ id: row.id, nickname: row.nickname, ok: false, error: err.message });
      }
    }
    const { accounts, summary, timeline } = await loadPortfolio(req.userId);
    res.json({ results, accounts, summary, timeline });
  } catch (err) {
    next(err);
  }
});

/* ----------------------------------------------------------------- videos */

router.post('/:id/videos', blockDemoWrites, async (req, res, next) => {
  try {
    const row = await owned(req.userId, req.params.id);
    if (!row) return res.status(404).json({ error: 'Account not found.' });

    const b = req.body || {};
    const now = new Date().toISOString();
    await run(
      `INSERT INTO videos (id, account_id, user_id, yt_video_id, title, thumbnail, published_at, views, likes, comments, cost, revenue_actual, source, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        newId(), row.id, req.userId, text(b.ytVideoId), text(b.title) ?? 'Untitled video', text(b.thumbnail),
        text(b.publishedAt) ?? now, int(b.views), int(b.likes), int(b.comments),
        money(b.cost), b.revenueActual == null || b.revenueActual === '' ? null : money(b.revenueActual),
        'manual', now, now,
      ]
    );
    res.status(201).json({ account: await loadAccountDetail(req.userId, row.id) });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/videos/:videoId', blockDemoWrites, async (req, res, next) => {
  try {
    const row = await owned(req.userId, req.params.id);
    if (!row) return res.status(404).json({ error: 'Account not found.' });

    const b = req.body || {};
    const sets = [];
    const params = [];
    const set = (c, v) => {
      sets.push(`${c} = ?`);
      params.push(v);
    };
    if (b.title !== undefined) set('title', text(b.title) ?? 'Untitled video');
    if (b.publishedAt !== undefined) set('published_at', text(b.publishedAt));
    if (b.views !== undefined) set('views', int(b.views));
    if (b.cost !== undefined) set('cost', money(b.cost));
    if (b.revenueActual !== undefined) {
      set('revenue_actual', b.revenueActual == null || b.revenueActual === '' ? null : money(b.revenueActual));
    }
    if (!sets.length) return res.json({ account: await loadAccountDetail(req.userId, row.id) });

    set('updated_at', new Date().toISOString());
    params.push(req.params.videoId, row.id);
    await run(`UPDATE videos SET ${sets.join(', ')} WHERE id = ? AND account_id = ?`, params);
    res.json({ account: await loadAccountDetail(req.userId, row.id) });
  } catch (err) {
    next(err);
  }
});

/** Bulk cost assignment — "every video on this channel cost me $120". */
router.post('/:id/videos/bulk-cost', blockDemoWrites, async (req, res, next) => {
  try {
    const row = await owned(req.userId, req.params.id);
    if (!row) return res.status(404).json({ error: 'Account not found.' });
    const cost = money(req.body?.cost);
    const onlyEmpty = req.body?.onlyEmpty !== false;
    await run(
      `UPDATE videos SET cost = ?, updated_at = ? WHERE account_id = ?${onlyEmpty ? ' AND cost = 0' : ''}`,
      [cost, new Date().toISOString(), row.id]
    );
    res.json({ account: await loadAccountDetail(req.userId, row.id) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id/videos/:videoId', blockDemoWrites, async (req, res, next) => {
  try {
    const row = await owned(req.userId, req.params.id);
    if (!row) return res.status(404).json({ error: 'Account not found.' });
    await run('DELETE FROM videos WHERE id = ? AND account_id = ?', [req.params.videoId, row.id]);
    res.json({ account: await loadAccountDetail(req.userId, row.id) });
  } catch (err) {
    next(err);
  }
});

/* ---------------------------------------------------------------- payouts */

router.post('/:id/payouts', blockDemoWrites, async (req, res, next) => {
  try {
    const row = await owned(req.userId, req.params.id);
    if (!row) return res.status(404).json({ error: 'Account not found.' });
    const period = text(req.body?.period) ?? new Date().toISOString().slice(0, 7);
    const amount = money(req.body?.amount);

    const existing = await one('SELECT id FROM payouts WHERE account_id = ? AND period = ?', [row.id, period]);
    if (existing) await run('UPDATE payouts SET amount = ?, note = ? WHERE id = ?', [amount, text(req.body?.note), existing.id]);
    else
      await run('INSERT INTO payouts (id, user_id, account_id, period, amount, note, created_at) VALUES (?,?,?,?,?,?,?)', [
        newId(), req.userId, row.id, period, amount, text(req.body?.note), new Date().toISOString(),
      ]);

    res.status(201).json({ account: await loadAccountDetail(req.userId, row.id) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id/payouts/:payoutId', blockDemoWrites, async (req, res, next) => {
  try {
    const row = await owned(req.userId, req.params.id);
    if (!row) return res.status(404).json({ error: 'Account not found.' });
    await run('DELETE FROM payouts WHERE id = ? AND account_id = ?', [req.params.payoutId, row.id]);
    res.json({ account: await loadAccountDetail(req.userId, row.id) });
  } catch (err) {
    next(err);
  }
});

export default router;
