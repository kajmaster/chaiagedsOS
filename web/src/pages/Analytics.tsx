import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Gauge, Info, TrendingDown, TrendingUp } from 'lucide-react';
import { api } from '@/lib/api';
import { useApp } from '@/store/AppStore';
import { Chip, CountUp, EmptyState, Panel, SectionTitle, Skeleton } from '@/components/ui';
import { PortfolioChart, SERIES } from '@/components/charts';
import { cx, money, number, percent, toneClasses } from '@/lib/format';
import type { AnalyticsResponse, LeaderRow, NicheSlice } from '@/lib/types';

/* ------------------------------------------------------------ range tabs */

function RangeTabs({
  ranges,
  active,
  onChange,
}: {
  ranges: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  const short: Record<string, string> = { '3m': '3M', '6m': '6M', '12m': '12M', all: 'All' };
  return (
    <div className="flex rounded-xl border border-white/[0.08] bg-white/[0.02] p-0.5">
      {ranges.map((r) => (
        <button
          key={r.id}
          onClick={() => onChange(r.id)}
          title={r.label}
          className={cx(
            'relative rounded-[10px] px-3.5 py-1.5 text-[13px] font-semibold transition-colors',
            active === r.id ? 'text-ink-950' : 'text-slate-400 hover:text-slate-200'
          )}
        >
          {active === r.id && (
            <motion.span layoutId="range-pill" className="absolute inset-0 rounded-[10px] bg-brass-sheen" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />
          )}
          <span className="relative">{short[r.id] ?? r.label}</span>
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------- KPI tile */

function Kpi({
  label,
  value,
  format,
  sub,
  accent,
  index,
}: {
  label: string;
  value: number;
  format: (n: number) => string;
  sub?: string;
  accent?: 'jade' | 'ember' | 'brass';
  index: number;
}) {
  const tone = accent === 'jade' ? 'text-jade-400' : accent === 'ember' ? 'text-ember-400' : accent === 'brass' ? 'text-brass-200' : 'text-white';
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="min-w-0 px-5 py-5"
    >
      <p className="label">{label}</p>
      <CountUp value={value} format={format} className={cx('mt-2.5 block text-[27px] font-semibold leading-none tracking-tight', tone)} />
      {sub && <p className="mt-2 text-xs text-slate-500">{sub}</p>}
    </motion.div>
  );
}

/* --------------------------------------------------- revenue by niche */

/**
 * Ranked bars, not a donut. A six-slice ring makes the reader compare arc
 * lengths; a sorted bar list with the number written next to it needs no
 * decoding at all. One series, so one colour and no legend.
 */
function NicheBars({ slices }: { slices: NicheSlice[] }) {
  const max = Math.max(...slices.map((s) => s.revenue), 1);
  const shown = slices.slice(0, 7);
  const rest = slices.slice(7);
  const restRevenue = rest.reduce((s, n) => s + n.revenue, 0);

  return (
    <div className="space-y-3.5">
      {shown.map((s, i) => (
        <motion.div
          key={s.niche}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05, duration: 0.4 }}
        >
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="truncate text-[13px] text-slate-300">{s.label}</span>
            <span className="flex shrink-0 items-baseline gap-2">
              <span className="tnum text-[13px] font-semibold text-slate-100">{money(s.revenue, { compact: true })}</span>
              <span className="tnum w-9 text-right text-[11px] text-slate-500">{Math.round(s.share)}%</span>
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(s.revenue / max) * 100}%` }}
              transition={{ duration: 0.8, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
              className="h-full rounded-full"
              style={{ background: SERIES.revenue }}
            />
          </div>
        </motion.div>
      ))}

      {rest.length > 0 && (
        <div className="flex items-baseline justify-between gap-3 border-t border-white/[0.06] pt-3 text-[13px]">
          <span className="text-slate-500">
            {rest.length} other {rest.length === 1 ? 'niche' : 'niches'}
          </span>
          <span className="tnum font-semibold text-slate-400">{money(restRevenue, { compact: true })}</span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------ niche table */

function NicheTable({ slices }: { slices: NicheSlice[] }) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[680px]">
        <div className="grid grid-cols-[minmax(0,2fr)_repeat(5,minmax(0,1fr))] gap-4 border-b border-white/[0.07] px-6 py-2.5">
          <span className="label">Niche</span>
          <span className="label text-right">Channels</span>
          <span className="label text-right">Revenue</span>
          <span className="label text-right">Profit</span>
          <span className="label text-right">Your RPM</span>
          <span className="label text-right">Benchmark</span>
        </div>
        {slices.map((s) => {
          const delta = s.effectiveRpm - s.benchmarkRpm;
          return (
            <div
              key={s.niche}
              className="grid grid-cols-[minmax(0,2fr)_repeat(5,minmax(0,1fr))] items-center gap-4 border-b border-white/[0.04] px-6 py-3 last:border-0"
            >
              <span className="truncate text-[13px] text-slate-200">{s.label}</span>
              <span className="tnum text-right text-[13px] text-slate-400">{s.accounts}</span>
              <span className="tnum text-right text-[13px] text-slate-200">{money(s.revenue, { compact: true })}</span>
              <span className={cx('tnum text-right text-[13px] font-semibold', s.profit >= 0 ? 'text-jade-400' : 'text-ember-400')}>
                {money(s.profit, { compact: true, sign: true })}
              </span>
              <span className="tnum text-right text-[13px] text-slate-200">${s.effectiveRpm.toFixed(2)}</span>
              <span className="flex items-center justify-end gap-1.5 text-right">
                <span className="tnum text-[13px] text-slate-500">${s.benchmarkRpm.toFixed(2)}</span>
                {s.effectiveRpm > 0 && (
                  <span className={cx('tnum text-[11px]', delta >= 0 ? 'text-jade-400' : 'text-ember-400')}>
                    {delta >= 0 ? '▲' : '▼'}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* --------------------------------------------------------- leaders */

function LeaderList({ rows, title, empty }: { rows: LeaderRow[]; title: React.ReactNode; empty: string }) {
  return (
    <Panel className="min-w-0 p-6">
      <SectionTitle>{title}</SectionTitle>
      {rows.length === 0 ? (
        <p className="py-3 text-sm text-slate-500">{empty}</p>
      ) : (
        <div className="space-y-1">
          {rows.map((r) => (
            <Link
              key={r.id}
              to={`/channels/${r.id}`}
              className="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-white/[0.04]"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-slate-100 group-hover:text-brass-100">{r.nickname}</span>
                <span className="block truncate text-[11px] text-slate-500">
                  {r.nicheLabel} · ${r.rpm.toFixed(2)} RPM
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className={cx('tnum block text-[13px] font-semibold', r.profit >= 0 ? 'text-jade-400' : 'text-ember-400')}>
                  {money(r.profit, { compact: true, sign: true })}
                </span>
                <span className="tnum block text-[11px] text-slate-500">{r.roi == null ? '—' : percent(r.roi, { sign: true })}</span>
              </span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-700 transition-colors group-hover:text-slate-400" />
            </Link>
          ))}
        </div>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------- page */

export function Analytics() {
  const { accounts, toast } = useApp();
  const [range, setRange] = useState('12m');
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (key: string) => {
      setLoading(true);
      try {
        setData(await api.analytics(key));
      } catch (err) {
        toast({ title: 'Could not load analytics', detail: (err as Error).message, tone: 'error' });
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    void load(range);
  }, [load, range]);

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-[120px]" />
        <Skeleton className="h-[340px]" />
        <Skeleton className="h-[260px]" />
      </div>
    );
  }

  if (!accounts.length) {
    return (
      <Panel>
        <EmptyState
          icon={<Gauge className="h-5 w-5" />}
          title="Nothing to analyse yet"
          body="Add a channel and this page fills in — blended RPM, which niches actually carry the portfolio, and where the money is going."
        />
      </Panel>
    );
  }

  const k = data!.kpis;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Analytics</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            {data!.range.label} · {k.activeAccounts} active of {k.accounts} channels
          </p>
        </div>
        <RangeTabs ranges={data!.ranges} active={range} onChange={setRange} />
      </div>

      {/* Four numbers, not six. Blended RPM leads because it is the one figure
          that judges the whole portfolio mix rather than any single channel. */}
      <Panel className="grid grid-cols-2 divide-x divide-y divide-white/[0.05] lg:grid-cols-4 lg:divide-y-0">
        <Kpi
          index={0}
          label="Blended RPM"
          value={k.blendedRpm}
          format={(n) => `$${n.toFixed(2)}`}
          accent="brass"
          sub="Earned per 1,000 views, across every niche"
        />
        <Kpi
          index={1}
          label="Revenue"
          value={k.revenue}
          format={(n) => money(n, { compact: n >= 10000 })}
          sub={`${number(k.views)} views in this period`}
        />
        <Kpi
          index={2}
          label="Net profit"
          value={k.profit}
          format={(n) => money(n, { compact: Math.abs(n) >= 10000, sign: true })}
          accent={k.profit >= 0 ? 'jade' : 'ember'}
          sub={k.margin == null ? undefined : `${percent(k.margin)} margin`}
        />
        <Kpi
          index={3}
          label="Return on spend"
          value={k.roi ?? 0}
          format={(n) => percent(n, { sign: true })}
          accent={(k.roi ?? 0) >= 0 ? 'jade' : 'ember'}
          sub={`${money(k.cost, { compact: k.cost >= 10000 })} spent`}
        />
      </Panel>

      {/* Everything above is scoped to the selected period. The lifetime totals
          differ, and showing both is the only honest way to present that — two
          unexplained sets of numbers is exactly what makes people distrust a
          dashboard. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-1 text-[13px]">
        <span className="label !normal-case !tracking-normal !text-slate-500">Lifetime, all channels:</span>
        <span className="tnum text-slate-300">{money(k.lifetimeRevenue, { compact: true })} revenue</span>
        <span className="text-slate-700">·</span>
        <span className={cx('tnum font-semibold', k.lifetimeProfit >= 0 ? 'text-jade-400' : 'text-ember-400')}>
          {money(k.lifetimeProfit, { compact: true, sign: true })} profit
        </span>
        <span className="text-slate-700">·</span>
        <span className="tnum text-slate-300">{percent(k.lifetimeRoi, { sign: true })} ROI</span>
        <span
          className="cursor-help text-slate-600 underline decoration-dotted underline-offset-4"
          title="Period figures only count revenue that landed inside the selected months. Lifetime totals also include earnings still arriving from recent uploads, so the two rarely match exactly."
        >
          why do these differ?
        </span>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
        <Panel className="min-w-0 p-6">
          <SectionTitle>Revenue vs cost</SectionTitle>
          <PortfolioChart data={data!.timeline} height={300} />
        </Panel>

        <Panel className="min-w-0 p-6">
          <SectionTitle>Where revenue comes from</SectionTitle>
          {data!.nicheMix.length ? (
            <NicheBars slices={data!.nicheMix} />
          ) : (
            <p className="text-sm text-slate-600">No revenue recorded yet.</p>
          )}
        </Panel>
      </div>

      {/* Portfolio health as one quiet row rather than another chart. */}
      <Panel className="p-6">
        <SectionTitle>Portfolio health</SectionTitle>
        <div className="flex flex-wrap gap-x-8 gap-y-4">
          {data!.health.map((h) => (
            <div key={h.key} className="flex items-center gap-2.5">
              <span className={cx('h-2 w-2 rounded-full', toneClasses[h.tone]?.dot)} />
              <span className="tnum text-lg font-semibold text-white">{h.count}</span>
              <span className="text-[13px] text-slate-400">{h.label}</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        <div className="border-b border-white/[0.07] px-6 py-4">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.18em] text-slate-400">Niche performance</h2>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
            <Info className="h-3 w-3" />
            Your RPM against the benchmark for that niche — below it usually means audience geography, not the niche itself.
          </p>
        </div>
        <NicheTable slices={data!.nicheMix} />
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <LeaderList
          rows={data!.leaders.best}
          title={
            <span className="flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5 text-jade-400" /> Carrying the portfolio
            </span>
          }
          empty="No profitable channels yet."
        />
        <LeaderList
          rows={data!.leaders.worst}
          title={
            <span className="flex items-center gap-2">
              <TrendingDown className="h-3.5 w-3.5 text-ember-400" /> Losing money
            </span>
          }
          empty="Nothing is losing money. Every channel is in the black."
        />
      </div>
    </div>
  );
}
