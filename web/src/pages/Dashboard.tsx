import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Layers, Sparkles, TrendingUp, Wallet } from 'lucide-react';
import { useApp } from '@/store/AppStore';
import { Chip, EmptyState, Panel, SectionTitle, Skeleton } from '@/components/ui';
import { CostComposition, PortfolioChart } from '@/components/charts';
import { AccountCard, ChannelAvatar, StatTile } from '@/components/portfolio';
import { money, number, percent, relativeTime } from '@/lib/format';

function LoadingGrid() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[132px]" />
        ))}
      </div>
      <Skeleton className="h-[340px]" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[280px]" />
        ))}
      </div>
    </div>
  );
}

export function Dashboard() {
  const { accounts, summary, timeline, loadingPortfolio, user } = useApp();

  const attention = useMemo(
    () =>
      accounts
        .filter((a) => a.metrics.health.key === 'bleeding' || (!a.monetized && a.status !== 'sold') || a.syncError)
        .slice(0, 4),
    [accounts]
  );

  const top = useMemo(() => [...accounts].sort((a, b) => b.metrics.profit - a.metrics.profit).slice(0, 6), [accounts]);
  const lastSync = useMemo(
    () => accounts.map((a) => a.lastSyncedAt).filter(Boolean).sort().reverse()[0] ?? null,
    [accounts]
  );

  if (loadingPortfolio && !summary) return <LoadingGrid />;

  if (!accounts.length) {
    return (
      <Panel className="mt-6">
        <EmptyState
          icon={<Layers className="h-5 w-5" />}
          title="Your portfolio is empty"
          body="Add your first channel and Chai's OS will pull its stats from YouTube, estimate the RPM for its niche and start tracking profit from day one."
          action={
            <p className="text-xs text-slate-500">
              Press <kbd className="rounded border border-white/10 bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd> anywhere to
              open the command bar.
            </p>
          }
        />
      </Panel>
    );
  }

  const s = summary!;
  const firstName = (user?.name || '').split(' ')[0];

  return (
    <div className="space-y-8">
      {/* --------------------------------------------------------- header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            {firstName ? `Welcome back, ${firstName}` : 'Portfolio overview'}
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            {s.accounts} channels · {number(s.subscribers)} subscribers · last synced {relativeTime(lastSync)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip tone={s.profit >= 0 ? 'emerald' : 'rose'}>
            {s.profitableCount} of {s.accounts} profitable
          </Chip>
          <Chip tone={s.netCashflow30d >= 0 ? 'emerald' : 'amber'}>{s.cashflowingCount} cashflowing</Chip>
        </div>
      </div>

      {/* ----------------------------------------------------- stat tiles */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          index={0}
          label="Net profit"
          value={s.profit}
          format={(n) => money(n, { compact: Math.abs(n) >= 10000, sign: true })}
          accent={s.profit >= 0 ? 'jade' : 'ember'}
          delta={s.roi}
          deltaLabel="Return on everything you've spent"
        />
        <StatTile
          index={1}
          label="Revenue earned"
          value={s.revenue}
          format={(n) => money(n, { compact: n >= 10000 })}
          accent="brass"
          footnote={`${money(s.revenue / Math.max(1, s.videos))} average per video`}
        />
        <StatTile
          index={2}
          label="Total spent"
          value={s.cost}
          format={(n) => money(n, { compact: n >= 10000 })}
          meter={{
            value: s.breakevenPct,
            tone: s.breakevenPct >= 100 ? 'emerald' : s.breakevenPct >= 50 ? 'amber' : 'rose',
            caption:
              s.breakevenPct >= 100
                ? 'Portfolio has cleared break-even'
                : `${Math.round(s.breakevenPct)}% recovered · ${money(s.cost - s.revenue)} to go`,
          }}
        />
        <StatTile
          index={3}
          label="Net cashflow · 30 days"
          value={s.netCashflow30d}
          format={(n) => money(n, { sign: true })}
          accent={s.netCashflow30d >= 0 ? 'jade' : 'ember'}
          footnote={
            s.netCashflow30d >= 0
              ? 'The portfolio is paying for itself right now'
              : 'Running at a monthly loss — check the channels below'
          }
        />
      </div>

      {/* --------------------------------------------------------- charts */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
        <Panel className="min-w-0 p-6">
          <SectionTitle
            action={
              <span className="tnum text-sm font-semibold text-slate-300">
                {money(s.profit, { sign: true, compact: Math.abs(s.profit) >= 10000 })} profit
              </span>
            }
          >
            Revenue vs cost
          </SectionTitle>
          <PortfolioChart data={timeline} />
        </Panel>

        <div className="min-w-0 space-y-5">
          <Panel className="p-6">
            <SectionTitle>Where the money went</SectionTitle>
            <CostComposition acquisition={s.invested} production={s.production} overhead={s.overhead} />
          </Panel>

          <Panel className="p-6">
            <SectionTitle>Portfolio signals</SectionTitle>
            <dl className="space-y-3 text-[13px]">
              <div className="flex items-center justify-between gap-4">
                <dt className="flex items-center gap-2 text-slate-400">
                  <TrendingUp className="h-3.5 w-3.5 text-slate-600" /> Best performer
                </dt>
                <dd className="tnum truncate font-semibold text-slate-100">
                  {s.bestPerformer ? `${s.bestPerformer.nickname}` : '—'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="flex items-center gap-2 text-slate-400">
                  <Wallet className="h-3.5 w-3.5 text-slate-600" /> Profit margin
                </dt>
                <dd className="tnum font-semibold text-slate-100">{percent(s.margin)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="flex items-center gap-2 text-slate-400">
                  <Sparkles className="h-3.5 w-3.5 text-slate-600" /> Total views
                </dt>
                <dd className="tnum font-semibold text-slate-100">{number(s.views)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="flex items-center gap-2 text-slate-400">
                  <Layers className="h-3.5 w-3.5 text-slate-600" /> Videos tracked
                </dt>
                <dd className="tnum font-semibold text-slate-100">{number(s.videos, false)}</dd>
              </div>
            </dl>
          </Panel>
        </div>
      </div>

      {/* ----------------------------------------------------- attention */}
      {attention.length > 0 && (
        <Panel className="p-6">
          <SectionTitle>
            <span className="flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-brass-400" /> Needs your attention
            </span>
          </SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            {attention.map((a) => (
              <Link
                key={a.id}
                to={`/channels/${a.id}`}
                className="flex min-w-0 items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 transition-colors hover:border-white/15 hover:bg-white/[0.05]"
              >
                <ChannelAvatar account={a} size={34} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-slate-100">{a.nickname}</p>
                  <p className="truncate text-xs text-slate-500">
                    {a.syncError
                      ? a.syncError
                      : !a.monetized
                        ? 'Not monetised yet — no earnings are being counted'
                        : `Losing ${money(Math.abs(a.metrics.profit))} so far`}
                  </p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-600" />
              </Link>
            ))}
          </div>
        </Panel>
      )}

      {/* ------------------------------------------------------- channels */}
      <div>
        <SectionTitle
          action={
            <Link to="/channels" className="flex items-center gap-1.5 text-[13px] font-medium text-slate-400 transition-colors hover:text-brass-200">
              All channels <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          Top channels by profit
        </SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {top.map((a, i) => (
            <AccountCard key={a.id} account={a} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
