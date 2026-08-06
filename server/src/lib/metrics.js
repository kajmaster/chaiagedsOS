/**
 * The financial engine. Every number the customer sees in the UI is computed
 * here so the dashboard, the detail drawer and the exports can never disagree.
 */
import { effectiveRpm, getNiche, getTier } from './rpm.js';

const MS_DAY = 86_400_000;
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * How a video's lifetime earnings land across the months after publication.
 * Used by both the cashflow window and the chart so the two always agree.
 */
const DECAY = [0.5, 0.25, 0.15, 0.1];

function monthsAgo(iso, now) {
  const d = new Date(iso);
  const n = new Date(now);
  if (Number.isNaN(d.getTime())) return -1;
  return (n.getFullYear() - d.getFullYear()) * 12 + (n.getMonth() - d.getMonth());
}

function monthsHeld(account, now = Date.now()) {
  const from = account.acquired_at ? Date.parse(account.acquired_at) : Date.parse(account.created_at);
  if (!Number.isFinite(from)) return 1;
  return Math.max(1, (now - from) / (MS_DAY * 30.44));
}

function daysSince(iso, now = Date.now()) {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? (now - t) / MS_DAY : Infinity;
}

/**
 * Compute the full P&L for one account.
 * @param account raw DB row
 * @param videos  that account's video rows
 * @param payouts real AdSense payouts (they override estimates when present)
 */
export function computeAccountMetrics(account, videos = [], payouts = [], now = Date.now()) {
  const rpm = effectiveRpm(account);
  const niche = getNiche(account.niche);
  const tier = getTier(account.audience_tier);

  const videoStats = videos.map((v) => {
    const views = Number(v.views) || 0;
    const estimated = round2((views / 1000) * rpm.rpm);
    const revenue = v.revenue_actual != null ? round2(v.revenue_actual) : estimated;
    const cost = round2(v.cost);
    return {
      ...v,
      views,
      cost,
      revenue,
      estimatedRevenue: estimated,
      revenueIsActual: v.revenue_actual != null,
      profit: round2(revenue - cost),
      roi: cost > 0 ? round2(((revenue - cost) / cost) * 100) : null,
      cpv: views > 0 ? round2((cost / views) * 1000) : null,
      ageDays: v.published_at ? Math.floor(daysSince(v.published_at, now)) : null,
    };
  });

  const productionCost = round2(videoStats.reduce((s, v) => s + v.cost, 0));
  const held = monthsHeld(account, now);
  const overhead = round2(Number(account.monthly_cost || 0) * held);
  const acquisition = round2(account.acquisition_cost);
  const totalCost = round2(acquisition + productionCost + overhead);

  const payoutTotal = round2(payouts.reduce((s, p) => s + (Number(p.amount) || 0), 0));
  const estimatedRevenue = round2(videoStats.reduce((s, v) => s + v.estimatedRevenue, 0));
  // Real money always beats a model.
  const hasActuals = payouts.length > 0;
  const totalRevenue = hasActuals ? payoutTotal : round2(videoStats.reduce((s, v) => s + v.revenue, 0));

  const profit = round2(totalRevenue - totalCost);
  const roi = totalCost > 0 ? round2((profit / totalCost) * 100) : null;
  const margin = totalRevenue > 0 ? round2((profit / totalRevenue) * 100) : null;

  // Once real payouts exist they set the level; the per-video model only sets
  // the shape. Scaling by this keeps cashflow consistent with total revenue.
  const revenueScale = hasActuals && estimatedRevenue > 0 ? totalRevenue / estimatedRevenue : 1;

  // Trailing 30 days = the cashflow question: is this thing feeding itself now?
  // Revenue keeps arriving after a video is published, so the current month
  // earns from the last four months of uploads, not only from new ones.
  const recentRevenue = round2(
    videoStats.reduce((sum, v) => {
      if (!v.published_at) return sum;
      const age = monthsAgo(v.published_at, now);
      return sum + (age >= 0 && age < DECAY.length ? v.estimatedRevenue * DECAY[age] : 0);
    }, 0) * revenueScale
  );
  const recent = videoStats.filter((v) => v.ageDays != null && v.ageDays <= 30);
  const recentCost = round2(recent.reduce((s, v) => s + v.cost, 0) + Number(account.monthly_cost || 0));
  const netCashflow30d = round2(recentRevenue - recentCost);

  const totalViews = videoStats.reduce((s, v) => s + v.views, 0);
  const avgViews = videoStats.length ? Math.round(totalViews / videoStats.length) : 0;
  const avgCostPerVideo = videoStats.length ? round2(productionCost / videoStats.length) : 0;

  // Break-even: how much revenue is still owed against total spend.
  const breakevenPct = totalCost > 0 ? Math.min(100, round2((totalRevenue / totalCost) * 100)) : 100;
  const amountToBreakeven = round2(Math.max(0, totalCost - totalRevenue));

  // Runway: at the current 30-day pace, when does it clear?
  const monthlyNet = netCashflow30d;
  const monthsToBreakeven =
    amountToBreakeven > 0 && monthlyNet > 0 ? round2(amountToBreakeven / monthlyNet) : amountToBreakeven <= 0 ? 0 : null;

  const health = deriveHealth({ profit, netCashflow30d, roi, breakevenPct, monetized: !!account.monetized, videoCount: videoStats.length });

  return {
    spark: buildSpark(videoStats, now, 6, revenueScale),
    rpm,
    nicheLabel: niche.label,
    tierLabel: tier.label,
    monthsHeld: round2(held),

    revenue: totalRevenue,
    estimatedRevenue,
    payoutRevenue: payoutTotal,
    revenueSource: hasActuals ? 'actual' : 'estimated',

    acquisitionCost: acquisition,
    productionCost,
    overheadCost: overhead,
    totalCost,

    profit,
    roi,
    margin,

    recentRevenue,
    recentCost,
    netCashflow30d,
    isCashflowing: netCashflow30d > 0,
    isProfitable: profit > 0,

    breakevenPct,
    amountToBreakeven,
    monthsToBreakeven,

    videoCount: videoStats.length,
    totalViews,
    avgViews,
    avgCostPerVideo,
    revenuePerVideo: videoStats.length ? round2(totalRevenue / videoStats.length) : 0,

    health,
    videos: videoStats,
  };
}

/** Six monthly revenue points for the card sparkline. */
function buildSpark(videoStats, now, months = 6, scale = 1) {
  const base = new Date(now);
  const keys = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  const totals = new Map(keys.map((k) => [k, 0]));
  for (const v of videoStats) {
    if (!v.published_at) continue;
    const d = new Date(v.published_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (totals.has(key)) totals.set(key, totals.get(key) + v.estimatedRevenue);
  }
  return keys.map((k) => round2(totals.get(k) * scale));
}

/** One word the customer can scan in a grid of 40 channels. */
function deriveHealth({ profit, netCashflow30d, roi, breakevenPct, monetized, videoCount }) {
  if (!monetized) return { key: 'pending', label: 'Not monetised', tone: 'slate' };
  if (videoCount === 0) return { key: 'idle', label: 'No uploads', tone: 'slate' };
  if (profit > 0 && netCashflow30d > 0 && (roi ?? 0) >= 50) return { key: 'scaling', label: 'Scaling', tone: 'emerald' };
  if (profit > 0) return { key: 'profitable', label: 'Profitable', tone: 'emerald' };
  if (netCashflow30d > 0) return { key: 'recovering', label: 'Recovering', tone: 'amber' };
  if (breakevenPct >= 50) return { key: 'nearing', label: 'Near break-even', tone: 'amber' };
  return { key: 'bleeding', label: 'Burning cash', tone: 'rose' };
}

/** Portfolio roll-up across every account. */
export function computePortfolio(rows, now = Date.now()) {
  const sum = (fn) => round2(rows.reduce((s, r) => s + (fn(r) || 0), 0));

  const revenue = sum((r) => r.metrics.revenue);
  const cost = sum((r) => r.metrics.totalCost);
  const profit = round2(revenue - cost);
  const roi = cost > 0 ? round2((profit / cost) * 100) : null;
  const netCashflow30d = sum((r) => r.metrics.netCashflow30d);

  const active = rows.filter((r) => r.status === 'active');
  const profitable = rows.filter((r) => r.metrics.isProfitable);
  const cashflowing = rows.filter((r) => r.metrics.isCashflowing);
  const bleeding = rows.filter((r) => r.metrics.health.key === 'bleeding');

  const best = [...rows].sort((a, b) => b.metrics.profit - a.metrics.profit)[0] || null;
  const worst = [...rows].sort((a, b) => a.metrics.profit - b.metrics.profit)[0] || null;

  return {
    accounts: rows.length,
    activeAccounts: active.length,
    revenue,
    cost,
    profit,
    roi,
    margin: revenue > 0 ? round2((profit / revenue) * 100) : null,
    netCashflow30d,
    invested: sum((r) => r.metrics.acquisitionCost),
    production: sum((r) => r.metrics.productionCost),
    overhead: sum((r) => r.metrics.overheadCost),
    subscribers: rows.reduce((s, r) => s + (Number(r.subscribers) || 0), 0),
    views: rows.reduce((s, r) => s + (r.metrics.totalViews || 0), 0),
    videos: rows.reduce((s, r) => s + r.metrics.videoCount, 0),
    profitableCount: profitable.length,
    cashflowingCount: cashflowing.length,
    bleedingCount: bleeding.length,
    breakevenPct: cost > 0 ? Math.min(100, round2((revenue / cost) * 100)) : 100,
    bestPerformer: best ? { id: best.id, nickname: best.nickname, profit: best.metrics.profit } : null,
    worstPerformer: worst ? { id: worst.id, nickname: worst.nickname, profit: worst.metrics.profit } : null,
  };
}

/**
 * 12-month revenue / cost / profit series for the portfolio chart.
 *
 * A video's production cost lands entirely in its publish month, but its
 * revenue arrives over the following weeks — so we decay each video's earnings
 * across four months. Without this the chart reads as a cohort report rather
 * than a cashflow statement, which is not what an operator wants to see.
 */
export function buildTimeline(rows, months = 12, now = Date.now()) {
  const buckets = [];
  const base = new Date(now);
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    buckets.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleString('en-US', { month: 'short' }),
      year: d.getFullYear(),
      revenue: 0,
      cost: 0,
      profit: 0,
      views: 0,
    });
  }
  const index = new Map(buckets.map((b) => [b.key, b]));
  const keyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  for (const row of rows) {
    // When we have real payouts, scale the modelled curve so the chart's total
    // matches the number shown on the account card.
    const modelled = row.metrics.videos.reduce((s, v) => s + v.estimatedRevenue, 0);
    const scale = row.metrics.revenueSource === 'actual' && modelled > 0 ? row.metrics.revenue / modelled : 1;

    for (const v of row.metrics.videos) {
      if (!v.published_at) continue;
      const published = new Date(v.published_at);
      const costBucket = index.get(keyOf(published));
      if (costBucket) {
        costBucket.cost += v.cost;
        costBucket.views += v.views;
      }
      const revenue = v.estimatedRevenue * scale;
      DECAY.forEach((weight, offset) => {
        const d = new Date(published.getFullYear(), published.getMonth() + offset, 1);
        const bucket = index.get(keyOf(d));
        if (bucket) bucket.revenue += revenue * weight;
      });
    }

    // Spread monthly overhead evenly across the window.
    const monthly = Number(row.monthly_cost || 0);
    if (monthly > 0) for (const b of buckets) b.cost += monthly;
  }

  for (const b of buckets) {
    b.revenue = round2(b.revenue);
    b.cost = round2(b.cost);
    b.profit = round2(b.revenue - b.cost);
  }
  return buckets;
}
