/**
 * Loads a user's whole portfolio in three queries and hands back fully
 * computed, API-shaped objects. Single source of truth for every read path.
 */
import { all } from '../db.js';
import { computeAccountMetrics, computePortfolio, buildTimeline } from './metrics.js';
import { decrypt, maskHint } from './crypto.js';

const bool = (v) => v === 1 || v === true || v === '1';
const num = (v) => (v == null ? 0 : Number(v));

export function serializeAccount(row, metrics, { reveal = false } = {}) {
  return {
    id: row.id,
    nickname: row.nickname,
    niche: row.niche,
    nicheLabel: metrics.nicheLabel,
    audienceTier: row.audience_tier,
    audienceTierLabel: metrics.tierLabel,
    status: row.status,

    channelUrl: row.channel_url,
    channelId: row.channel_id,
    handle: row.handle,
    thumbnail: row.thumbnail,

    accountCreatedAt: row.account_created_at,
    acquiredAt: row.acquired_at,
    acquisitionCost: num(row.acquisition_cost),
    monthlyCost: num(row.monthly_cost),

    subscribers: num(row.subscribers),
    totalViews: num(row.total_views),
    videoCount: num(row.video_count),

    monetized: bool(row.monetized),
    rpmOverride: row.rpm_override == null ? null : Number(row.rpm_override),
    costModel: row.cost_model === 'per_minute' ? 'per_minute' : 'flat',
    costPerMinute: num(row.cost_per_minute),

    notes: row.notes,
    lastSyncedAt: row.last_synced_at,
    syncError: row.sync_error,

    // Never expose the token itself — only whether one exists.
    exactRevenue: {
      connected: Boolean(row.yt_refresh_token),
      connectedAt: row.yt_connected_at ?? null,
      channelTitle: row.yt_connected_channel ?? null,
      syncedAt: row.yt_revenue_synced_at ?? null,
      error: row.yt_revenue_error ?? null,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,

    credentials: reveal
      ? {
          username: decrypt(row.cred_username),
          email: decrypt(row.cred_email),
          password: decrypt(row.cred_password),
          twoFactor: decrypt(row.cred_2fa),
          recoveryEmail: decrypt(row.cred_recovery),
        }
      : {
          username: maskHint(row.cred_username),
          email: maskHint(row.cred_email),
          password: maskHint(row.cred_password),
          twoFactor: maskHint(row.cred_2fa),
          recoveryEmail: maskHint(row.cred_recovery),
        },

    metrics: { ...metrics, videos: undefined },
  };
}

export function serializeVideo(v) {
  return {
    id: v.id,
    accountId: v.account_id,
    ytVideoId: v.yt_video_id,
    title: v.title,
    thumbnail: v.thumbnail,
    publishedAt: v.published_at,
    durationSeconds: v.durationSeconds,
    views: v.views,
    likes: num(v.likes),
    comments: num(v.comments),
    cost: v.cost,
    minuteCost: v.minuteCost,
    extraCost: v.extraCost,
    revenue: v.revenue,
    estimatedRevenue: v.estimatedRevenue,
    revenueIsActual: v.revenueIsActual,
    profit: v.profit,
    roi: v.roi,
    cpv: v.cpv,
    ageDays: v.ageDays,
    source: v.source,
  };
}

export async function loadPortfolio(userId) {
  const [accountRows, videoRows, payoutRows] = await Promise.all([
    all('SELECT * FROM accounts WHERE user_id = ? ORDER BY created_at ASC', [userId]),
    all('SELECT * FROM videos WHERE user_id = ? ORDER BY published_at DESC', [userId]),
    all('SELECT * FROM payouts WHERE user_id = ? ORDER BY period ASC', [userId]),
  ]);

  const videosByAccount = new Map();
  for (const v of videoRows) {
    if (!videosByAccount.has(v.account_id)) videosByAccount.set(v.account_id, []);
    videosByAccount.get(v.account_id).push(v);
  }
  const payoutsByAccount = new Map();
  for (const p of payoutRows) {
    if (!payoutsByAccount.has(p.account_id)) payoutsByAccount.set(p.account_id, []);
    payoutsByAccount.get(p.account_id).push(p);
  }

  const enriched = accountRows.map((row) => ({
    ...row,
    metrics: computeAccountMetrics(row, videosByAccount.get(row.id) ?? [], payoutsByAccount.get(row.id) ?? []),
  }));

  return {
    accounts: enriched.map((row) => serializeAccount(row, row.metrics)),
    summary: computePortfolio(enriched),
    timeline: buildTimeline(enriched),
    raw: enriched,
  };
}

export async function loadAccountDetail(userId, accountId, { reveal = false } = {}) {
  const [row] = await all('SELECT * FROM accounts WHERE id = ? AND user_id = ?', [accountId, userId]);
  if (!row) return null;

  const [videoRows, payoutRows] = await Promise.all([
    all('SELECT * FROM videos WHERE account_id = ? ORDER BY published_at DESC', [accountId]),
    all('SELECT * FROM payouts WHERE account_id = ? ORDER BY period ASC', [accountId]),
  ]);

  const metrics = computeAccountMetrics(row, videoRows, payoutRows);
  return {
    ...serializeAccount(row, metrics, { reveal }),
    videos: metrics.videos.map(serializeVideo),
    payouts: payoutRows.map((p) => ({ id: p.id, period: p.period, amount: Number(p.amount), note: p.note })),
  };
}
