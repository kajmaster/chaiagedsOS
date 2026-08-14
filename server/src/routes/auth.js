import express from 'express';
import bcrypt from 'bcryptjs';
import { all, one, run } from '../db.js';
import { newId } from '../lib/crypto.js';
import { signToken, requireAuth } from '../lib/auth.js';
import { buildDemoWorkspace } from '../lib/demo.js';

const router = express.Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const publicUser = (u) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  plan: u.plan,
  isDemo: u.is_demo === 1 || u.is_demo === true,
  currency: u.currency,
  createdAt: u.created_at,
});

router.post('/register', async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const name = String(req.body?.name || '').trim() || null;

    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

    const existing = await one('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) return res.status(409).json({ error: 'An account with that email already exists.' });

    const user = {
      id: newId(),
      email,
      password_hash: await bcrypt.hash(password, 12),
      name,
      plan: 'starter',
      is_demo: 0,
      currency: 'USD',
      created_at: new Date().toISOString(),
    };

    await run(
      `INSERT INTO users (id, email, password_hash, name, plan, is_demo, currency, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [user.id, user.email, user.password_hash, user.name, user.plan, 0, user.currency, user.created_at]
    );

    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    const user = await one('SELECT * FROM users WHERE email = ?', [email]);
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }
    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

/**
 * One-tap demo. Spins up a throwaway, read-only workspace pre-loaded with a
 * realistic 8-channel portfolio so a prospect sees the product in ~2 seconds.
 */
router.post('/demo', async (req, res, next) => {
  try {
    const now = new Date().toISOString();
    const user = {
      id: newId(),
      email: `demo-${Date.now().toString(36)}@chai.demo`,
      password_hash: 'demo',
      name: 'Demo Operator',
      plan: 'demo',
      is_demo: 1,
      currency: 'USD',
      created_at: now,
    };

    await run(
      `INSERT INTO users (id, email, password_hash, name, plan, is_demo, currency, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [user.id, user.email, user.password_hash, user.name, user.plan, 1, user.currency, now]
    );

    const { accounts, videos, payouts } = buildDemoWorkspace(user.id);

    for (const a of accounts) {
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
          a.id, a.user_id, a.nickname, a.niche, a.audience_tier, a.status,
          a.channel_url, a.channel_id, a.handle, a.thumbnail,
          a.account_created_at, a.acquired_at, a.acquisition_cost, a.monthly_cost,
          a.subscribers, a.total_views, a.video_count, a.monetized, a.rpm_override, a.notes,
          a.cred_username, a.cred_email, a.cred_password, a.cred_2fa, a.cred_recovery,
          a.last_synced_at, a.sync_error, a.created_at, a.updated_at,
        ]
      );
    }

    for (const v of videos) {
      await run(
        `INSERT INTO videos (
           id, account_id, user_id, yt_video_id, title, thumbnail, published_at,
           views, likes, comments, cost, revenue_actual, source, created_at, updated_at
         ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          v.id, v.account_id, v.user_id, v.yt_video_id, v.title, v.thumbnail, v.published_at,
          v.views, v.likes, v.comments, v.cost, v.revenue_actual, v.source, v.created_at, v.updated_at,
        ]
      );
    }

    for (const p of payouts) {
      await run(
        `INSERT INTO payouts (id, user_id, account_id, period, amount, note, created_at)
         VALUES (?,?,?,?,?,?,?)`,
        [p.id, p.user_id, p.account_id, p.period, p.amount, p.note, p.created_at]
      );
    }

    res.status(201).json({ token: signToken(user), user: publicUser(user), demo: true });
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await one('SELECT * FROM users WHERE id = ?', [req.userId]);
    if (!user) return res.status(401).json({ error: 'Account no longer exists.' });
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.patch('/me', requireAuth, async (req, res, next) => {
  try {
    const name = req.body?.name == null ? undefined : String(req.body.name).trim();
    const currency = req.body?.currency == null ? undefined : String(req.body.currency).trim().toUpperCase();
    if (name !== undefined) await run('UPDATE users SET name = ? WHERE id = ?', [name || null, req.userId]);
    if (currency !== undefined) await run('UPDATE users SET currency = ? WHERE id = ?', [currency || 'USD', req.userId]);
    const user = await one('SELECT * FROM users WHERE id = ?', [req.userId]);
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

/** Housekeeping: demo workspaces older than 24h are disposable. */
export async function purgeStaleDemos() {
  const cutoff = new Date(Date.now() - 86_400_000).toISOString();
  const stale = await all('SELECT id FROM users WHERE is_demo = 1 AND created_at < ?', [cutoff]);
  for (const u of stale) {
    await run('DELETE FROM videos WHERE user_id = ?', [u.id]);
    await run('DELETE FROM payouts WHERE user_id = ?', [u.id]);
    await run('DELETE FROM snapshots WHERE user_id = ?', [u.id]);
    await run('DELETE FROM accounts WHERE user_id = ?', [u.id]);
    await run('DELETE FROM users WHERE id = ?', [u.id]);
  }
  return stale.length;
}

export default router;
