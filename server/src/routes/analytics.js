import express from 'express';
import { requireAuth } from '../lib/auth.js';
import { loadPortfolio } from '../lib/portfolio.js';
import { buildTimeline } from '../lib/metrics.js';
import { getNiche } from '../lib/rpm.js';

const router = express.Router();
router.use(requireAuth);

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Ranges are whole months because the underlying data is monthly — a video's
 * earnings are modelled per month, not per day. Offering a "30 day" view would
 * imply a precision the numbers do not have.
 */
const RANGES = {
  '3m': { months: 3, label: 'Last 3 months' },
  '6m': { months: 6, label: 'Last 6 months' },
  '12m': { months: 12, label: 'Last 12 months' },
  all: { months: 36, label: 'All time' },
};

router.get('/', async (req, res, next) => {
  try {
    const key = RANGES[req.query.range] ? req.query.range : '12m';
    const range = RANGES[key];

    const { accounts, summary, raw } = await loadPortfolio(req.userId);

    // "All time" means the life of the portfolio, not a fixed 36 months —
    // otherwise a three-month-old portfolio is padded with empty buckets.
    let months = range.months;
    if (key === 'all') {
      const earliest = raw
        .map((r) => Date.parse(r.acquired_at || r.created_at))
        .filter(Number.isFinite)
        .sort((a, b) => a - b)[0];
      if (earliest) {
        const now = new Date();
        const from = new Date(earliest);
        const span = (now.getFullYear() - from.getFullYear()) * 12 + (now.getMonth() - from.getMonth()) + 1;
        months = Math.min(Math.max(span, 6), 36);
      }
    }

    const timeline = buildTimeline(raw, months);

    // Window totals come from the chart itself, so the headline figures and the
    // graph beneath them can never tell different stories.
    const windowed = timeline.reduce(
      (acc, b) => ({
        revenue: acc.revenue + b.revenue,
        cost: acc.cost + b.cost,
        views: acc.views + b.views,
      }),
      { revenue: 0, cost: 0, views: 0 }
    );
    const revenue = round2(windowed.revenue);
    const cost = round2(windowed.cost);
    const profit = round2(revenue - cost);

    /* Blended RPM: what the whole portfolio actually earns per 1,000 views,
       across every niche. The single number that says whether the mix is any
       good — a high-RPM niche with no views loses to the opposite. */
    const blendedRpm = windowed.views > 0 ? round2(revenue / (windowed.views / 1000)) : 0;

    /* Revenue by niche, ranked. */
    const byNiche = new Map();
    for (const a of accounts) {
      const entry = byNiche.get(a.niche) ?? {
        niche: a.niche,
        label: a.nicheLabel,
        benchmarkRpm: getNiche(a.niche).rpm,
        revenue: 0,
        cost: 0,
        views: 0,
        accounts: 0,
        videos: 0,
      };
      entry.revenue += a.metrics.revenue;
      entry.cost += a.metrics.totalCost;
      entry.views += a.metrics.totalViews;
      entry.accounts += 1;
      entry.videos += a.metrics.videoCount;
      byNiche.set(a.niche, entry);
    }

    const totalNicheRevenue = [...byNiche.values()].reduce((s, n) => s + n.revenue, 0);
    const nicheMix = [...byNiche.values()]
      .map((n) => ({
        ...n,
        revenue: round2(n.revenue),
        cost: round2(n.cost),
        profit: round2(n.revenue - n.cost),
        share: totalNicheRevenue > 0 ? round2((n.revenue / totalNicheRevenue) * 100) : 0,
        effectiveRpm: n.views > 0 ? round2(n.revenue / (n.views / 1000)) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    /* Health distribution — how the portfolio is actually doing, in one row. */
    const healthOrder = ['scaling', 'profitable', 'recovering', 'nearing', 'bleeding', 'pending', 'idle'];
    const healthMap = new Map();
    for (const a of accounts) {
      const h = a.metrics.health;
      const entry = healthMap.get(h.key) ?? { ...h, count: 0 };
      entry.count += 1;
      healthMap.set(h.key, entry);
    }
    const health = healthOrder.filter((k) => healthMap.has(k)).map((k) => healthMap.get(k));

    const ranked = [...accounts].sort((a, b) => b.metrics.profit - a.metrics.profit);
    const lite = (a) => ({
      id: a.id,
      nickname: a.nickname,
      nicheLabel: a.nicheLabel,
      thumbnail: a.thumbnail,
      revenue: a.metrics.revenue,
      profit: a.metrics.profit,
      roi: a.metrics.roi,
      rpm: a.metrics.rpm.rpm,
      health: a.metrics.health,
    });

    res.json({
      range: { key, label: range.label, months },
      ranges: Object.entries(RANGES).map(([id, r]) => ({ id, label: r.label })),
      kpis: {
        revenue,
        cost,
        profit,
        roi: cost > 0 ? round2((profit / cost) * 100) : null,
        margin: revenue > 0 ? round2((profit / revenue) * 100) : null,
        blendedRpm,
        views: windowed.views,
        accounts: summary.accounts,
        activeAccounts: summary.activeAccounts,
        videos: summary.videos,
        subscribers: summary.subscribers,
        // Lifetime totals, shown next to the period figures. They differ on
        // purpose: a period only counts revenue that landed inside it, while
        // lifetime includes earnings still arriving from recent uploads. Two
        // unexplained numbers look like a bug, so the UI shows both.
        lifetimeRevenue: summary.revenue,
        lifetimeCost: summary.cost,
        lifetimeProfit: summary.profit,
        lifetimeRoi: summary.roi,
      },
      timeline,
      nicheMix,
      health,
      leaders: {
        best: ranked.slice(0, 5).map(lite),
        worst: ranked.slice(-5).reverse().map(lite).filter((a) => a.profit < 0),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
