import React, { useId, useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { money, number } from '@/lib/format';
import type { TimelinePoint } from '@/lib/types';

/**
 * Chart palette — validated against the app's dark surface (#0A0C11) for the
 * OKLCH lightness band, chroma floor, CVD separation, normal-vision floor and
 * contrast. Do not substitute ad-hoc hexes here; re-validate if you change one.
 */
export const SERIES = {
  revenue: '#B98A2E',
  cost: '#3E7FD4',
  third: '#1E9B78',
} as const;

/** Status hues are reserved — they always ship with a sign or icon, never colour alone. */
export const STATUS = { good: '#1E9B78', bad: '#D4483F' } as const;

const AXIS = { fill: '#64748B', fontSize: 11 };
const GRID = 'rgba(255,255,255,0.05)';

/* ---------------------------------------------------------------- tooltip */

function ChartTooltip({
  active,
  payload,
  label,
  rows,
}: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="pointer-events-none rounded-xl border border-white/10 bg-ink-850/95 px-3.5 py-3 shadow-lift backdrop-blur-xl">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className="space-y-1.5">
        {rows(payload).map((r: { key: string; name: string; value: string; color?: string }) => (
          <div key={r.key} className="flex items-center justify-between gap-6 text-[13px]">
            <span className="flex items-center gap-2 text-slate-400">
              {r.color && <span className="h-2 w-2 rounded-[2px]" style={{ background: r.color }} />}
              {r.name}
            </span>
            <span className="tnum font-semibold text-slate-100">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Legend({ items }: { items: { name: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      {items.map((i) => (
        <span key={i.name} className="flex items-center gap-2 text-xs font-medium text-slate-400">
          <span className="h-2 w-2 rounded-[2px]" style={{ background: i.color }} />
          {i.name}
        </span>
      ))}
    </div>
  );
}

/* -------------------------------------------------------- portfolio chart */

/**
 * Revenue vs cost over 12 months. Two series, one dollar axis — never a second
 * y-scale. Profit is the readable gap between the two bands.
 */
export function PortfolioChart({ data, height = 260 }: { data: TimelinePoint[]; height?: number }) {
  const gradId = useId().replace(/:/g, '');
  const hasData = data.some((d) => d.revenue > 0 || d.cost > 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Legend
          items={[
            { name: 'Revenue', color: SERIES.revenue },
            { name: 'Total cost', color: SERIES.cost },
          ]}
        />
        <span className="text-xs text-slate-500">Last 12 months</span>
      </div>

      <div style={{ height }}>
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -12 }}>
              <defs>
                <linearGradient id={`rev-${gradId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SERIES.revenue} stopOpacity={0.34} />
                  <stop offset="100%" stopColor={SERIES.revenue} stopOpacity={0} />
                </linearGradient>
                <linearGradient id={`cost-${gradId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SERIES.cost} stopOpacity={0.26} />
                  <stop offset="100%" stopColor={SERIES.cost} stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} dy={8} />
              <YAxis
                tick={AXIS}
                tickLine={false}
                axisLine={false}
                width={64}
                tickFormatter={(v) => money(v, { compact: true })}
              />
              <Tooltip
                cursor={{ stroke: 'rgba(255,255,255,0.18)', strokeWidth: 1 }}
                content={
                  <ChartTooltip
                    rows={(payload: any[]) => {
                      const p = payload[0]?.payload as TimelinePoint;
                      return [
                        { key: 'r', name: 'Revenue', value: money(p.revenue), color: SERIES.revenue },
                        { key: 'c', name: 'Total cost', value: money(p.cost), color: SERIES.cost },
                        { key: 'p', name: 'Profit', value: money(p.profit, { sign: true }) },
                        { key: 'v', name: 'Views', value: number(p.views) },
                      ];
                    }}
                  />
                }
              />

              <Area
                type="monotone"
                dataKey="revenue"
                stroke={SERIES.revenue}
                strokeWidth={2}
                fill={`url(#rev-${gradId})`}
                activeDot={{ r: 4, strokeWidth: 2, stroke: '#0A0C11' }}
              />
              <Area
                type="monotone"
                dataKey="cost"
                stroke={SERIES.cost}
                strokeWidth={2}
                fill={`url(#cost-${gradId})`}
                activeDot={{ r: 4, strokeWidth: 2, stroke: '#0A0C11' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-600">
            Add a channel to start building your revenue history.
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------- channel P&L area */

export function ChannelChart({ data, height = 220 }: { data: TimelinePoint[]; height?: number }) {
  const gradId = useId().replace(/:/g, '');
  return (
    <div>
      <div className="mb-4">
        <Legend
          items={[
            { name: 'Revenue', color: SERIES.revenue },
            { name: 'Cost', color: SERIES.cost },
          ]}
        />
      </div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -12 }}>
            <defs>
              <linearGradient id={`cr-${gradId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SERIES.revenue} stopOpacity={0.32} />
                <stop offset="100%" stopColor={SERIES.revenue} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} dy={8} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} width={60} tickFormatter={(v) => money(v, { compact: true })} />
            <Tooltip
              cursor={{ stroke: 'rgba(255,255,255,0.18)', strokeWidth: 1 }}
              content={
                <ChartTooltip
                  rows={(payload: any[]) => {
                    const p = payload[0]?.payload as TimelinePoint;
                    return [
                      { key: 'r', name: 'Revenue', value: money(p.revenue), color: SERIES.revenue },
                      { key: 'c', name: 'Cost', value: money(p.cost), color: SERIES.cost },
                      { key: 'p', name: 'Profit', value: money(p.profit, { sign: true }) },
                    ];
                  }}
                />
              }
            />
            <Area type="monotone" dataKey="revenue" stroke={SERIES.revenue} strokeWidth={2} fill={`url(#cr-${gradId})`} activeDot={{ r: 4 }} />
            <Line type="monotone" dataKey="cost" stroke={SERIES.cost} strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- sparkline */

/** Single series, no legend — the card title names it. */
export function Sparkline({ points, tone = SERIES.revenue, height = 34 }: { points: number[]; tone?: string; height?: number }) {
  const id = useId().replace(/:/g, '');
  const data = useMemo(() => points.map((v, i) => ({ i, v })), [points]);
  if (points.length < 2) return <div style={{ height }} />;

  return (
    <div style={{ height }} aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`sp-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={tone} stopOpacity={0.4} />
              <stop offset="100%" stopColor={tone} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={tone} strokeWidth={1.75} fill={`url(#sp-${id})`} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ------------------------------------------------- cost composition bar */

/**
 * Part-to-whole as a single stacked bar with 2px surface gaps — easier to read
 * than a donut at this size, and it direct-labels every segment.
 */
export function CostComposition({
  acquisition,
  production,
  overhead,
}: {
  acquisition: number;
  production: number;
  overhead: number;
}) {
  const total = acquisition + production + overhead;
  const segments = [
    { name: 'Acquisition', value: acquisition, color: SERIES.revenue },
    { name: 'Production', value: production, color: SERIES.cost },
    { name: 'Overhead', value: overhead, color: SERIES.third },
  ].filter((s) => s.value > 0);

  if (total <= 0) {
    return <p className="text-sm text-slate-600">No spend recorded yet.</p>;
  }

  return (
    <div>
      <div className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full">
        {segments.map((s) => (
          <div
            key={s.name}
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${(s.value / total) * 100}%`, background: s.color }}
            title={`${s.name}: ${money(s.value)}`}
          />
        ))}
      </div>
      <div className="mt-4 space-y-2.5">
        {segments.map((s) => (
          <div key={s.name} className="flex items-center justify-between gap-4 text-[13px]">
            <span className="flex items-center gap-2.5 text-slate-400">
              <span className="h-2 w-2 rounded-[2px]" style={{ background: s.color }} />
              {s.name}
            </span>
            <span className="flex items-baseline gap-2">
              <span className="tnum font-semibold text-slate-100">{money(s.value)}</span>
              <span className="tnum w-10 text-right text-xs text-slate-500">{Math.round((s.value / total) * 100)}%</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
