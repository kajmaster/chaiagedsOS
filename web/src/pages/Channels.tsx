import React, { useMemo, useState } from 'react';
import { LayoutGrid, List, Search } from 'lucide-react';
import { useApp } from '@/store/AppStore';
import { Panel, SectionTitle, EmptyState, Skeleton } from '@/components/ui';
import { AccountCard, AccountRow, AccountTableHeader } from '@/components/portfolio';
import { cx } from '@/lib/format';

type SortKey = 'profit' | 'revenue' | 'roi' | 'cost' | 'subscribers' | 'name';

const SORTS: { id: SortKey; label: string }[] = [
  { id: 'profit', label: 'Profit' },
  { id: 'revenue', label: 'Revenue' },
  { id: 'roi', label: 'ROI' },
  { id: 'cost', label: 'Spent' },
  { id: 'subscribers', label: 'Subscribers' },
  { id: 'name', label: 'Name' },
];

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'profitable', label: 'Profitable' },
  { id: 'losing', label: 'Losing money' },
  { id: 'cashflowing', label: 'Cashflowing' },
  { id: 'unmonetised', label: 'Not monetised' },
];

export function Channels() {
  const { accounts, loadingPortfolio } = useApp();
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [sort, setSort] = useState<SortKey>('profit');
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    let list = [...accounts];

    if (filter === 'profitable') list = list.filter((a) => a.metrics.isProfitable);
    if (filter === 'losing') list = list.filter((a) => a.metrics.profit < 0);
    if (filter === 'cashflowing') list = list.filter((a) => a.metrics.isCashflowing);
    if (filter === 'unmonetised') list = list.filter((a) => !a.monetized);

    const q = query.trim().toLowerCase();
    if (q) list = list.filter((a) => `${a.nickname} ${a.nicheLabel} ${a.handle ?? ''}`.toLowerCase().includes(q));

    list.sort((a, b) => {
      switch (sort) {
        case 'revenue': return b.metrics.revenue - a.metrics.revenue;
        case 'roi': return (b.metrics.roi ?? -Infinity) - (a.metrics.roi ?? -Infinity);
        case 'cost': return b.metrics.totalCost - a.metrics.totalCost;
        case 'subscribers': return b.subscribers - a.subscribers;
        case 'name': return a.nickname.localeCompare(b.nickname);
        default: return b.metrics.profit - a.metrics.profit;
      }
    });
    return list;
  }, [accounts, filter, query, sort]);

  if (loadingPortfolio && !accounts.length) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-[280px]" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Channels</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            {visible.length} of {accounts.length} shown
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="field w-44 py-2 pl-8.5 text-[13px] sm:w-56"
              style={{ paddingLeft: '2.15rem' }}
            />
          </div>
          <div className="flex rounded-xl border border-white/[0.08] bg-white/[0.02] p-0.5">
            {(['grid', 'table'] as const).map((v) => {
              const Icon = v === 'grid' ? LayoutGrid : List;
              return (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cx(
                    'rounded-[10px] p-2 transition-colors',
                    view === v ? 'bg-white/[0.08] text-slate-100' : 'text-slate-500 hover:text-slate-300'
                  )}
                  title={v === 'grid' ? 'Card view' : 'Table view'}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* filters + sort in one row above the content */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cx(
                'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                filter === f.id
                  ? 'border-brass-400/40 bg-brass-400/10 text-brass-100'
                  : 'border-white/[0.07] text-slate-400 hover:border-white/15 hover:text-slate-200'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-xs text-slate-500">
          Sort by
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-lg border border-white/[0.08] bg-ink-850 px-2.5 py-1.5 text-xs text-slate-200 focus:border-brass-400/50"
          >
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {visible.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<Search className="h-5 w-5" />}
            title="Nothing matches that"
            body="Try a different filter or clear the search box."
          />
        </Panel>
      ) : view === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((a, i) => (
            <AccountCard key={a.id} account={a} index={i} />
          ))}
        </div>
      ) : (
        <Panel className="overflow-x-auto">
          <div className="min-w-[820px]">
            <AccountTableHeader />
            {visible.map((a) => (
              <AccountRow key={a.id} account={a} />
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
