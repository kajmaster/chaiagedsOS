import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowDownRight, ArrowUpRight, Minus, Users, Video } from 'lucide-react';
import { Chip, CountUp, Meter, Panel } from '@/components/ui';
import { Sparkline, SERIES } from '@/components/charts';
import { avatarGradient, channelAge, cx, initials, money, number, percent, statusMeta, toneClasses } from '@/lib/format';
import type { Account } from '@/lib/types';

/* -------------------------------------------------------------- stat tile */

/**
 * Hero number tile. The delta always carries a sign and an arrow, so the
 * green/red never does the work alone.
 */
export function StatTile({
  label,
  value,
  format,
  delta,
  deltaLabel,
  accent,
  meter,
  footnote,
  index = 0,
}: {
  label: string;
  value: number;
  format: (n: number) => string;
  delta?: number | null;
  deltaLabel?: string;
  accent?: 'brass' | 'jade' | 'ember' | 'neutral';
  meter?: { value: number; tone: string; caption: string };
  footnote?: string;
  index?: number;
}) {
  const direction = delta == null ? 'flat' : delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  const DeltaIcon = direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : Minus;
  const deltaTone =
    direction === 'up' ? 'text-jade-400' : direction === 'down' ? 'text-ember-400' : 'text-slate-500';

  const accentText =
    accent === 'jade' ? 'text-jade-300' : accent === 'ember' ? 'text-ember-300' : accent === 'brass' ? 'text-brass-200' : 'text-white';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="min-w-0"
    >
      <Panel hover className="h-full p-5">
        <p className="label">{label}</p>
        <div className="mt-3 flex items-end justify-between gap-3">
          <CountUp value={value} format={format} className={cx('text-[26px] font-semibold leading-none tracking-tight', accentText)} />
          {delta != null && (
            <span className={cx('tnum flex items-center gap-0.5 text-[13px] font-semibold', deltaTone)}>
              <DeltaIcon className="h-3.5 w-3.5" />
              {percent(Math.abs(delta), { decimals: Math.abs(delta) < 10 ? 1 : 0 })}
            </span>
          )}
        </div>
        {deltaLabel && <p className="mt-1.5 text-xs text-slate-500">{deltaLabel}</p>}
        {meter && (
          <div className="mt-4">
            <Meter value={meter.value} tone={meter.tone} />
            <p className="mt-2 text-xs text-slate-500">{meter.caption}</p>
          </div>
        )}
        {footnote && <p className="mt-3 text-xs text-slate-500">{footnote}</p>}
      </Panel>
    </motion.div>
  );
}

/* ------------------------------------------------------------ avatar */

export function ChannelAvatar({ account, size = 40 }: { account: Account; size?: number }) {
  if (account.thumbnail) {
    return (
      <img
        src={account.thumbnail}
        alt=""
        style={{ width: size, height: size }}
        className="shrink-0 rounded-full object-cover ring-1 ring-white/10"
      />
    );
  }
  return (
    <span
      style={{ width: size, height: size, background: avatarGradient(account.nickname), fontSize: size * 0.34 }}
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-white/90 ring-1 ring-white/10"
    >
      {initials(account.nickname)}
    </span>
  );
}

/* -------------------------------------------------------- account card */

export function AccountCard({ account, index = 0 }: { account: Account; index?: number }) {
  const m = account.metrics;
  const tone = toneClasses[m.health.tone] ?? toneClasses.slate;
  const status = statusMeta[account.status] ?? statusMeta.active;
  const age = channelAge(account.accountCreatedAt);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.3), duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="min-w-0"
    >
      <Link to={`/channels/${account.id}`} className="block h-full">
        <Panel hover className="group flex h-full flex-col p-5">
          {/* header */}
          <div className="flex items-start gap-3.5">
            <ChannelAvatar account={account} />
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-[15px] font-semibold tracking-tight text-white transition-colors group-hover:text-brass-100">
                {account.nickname}
              </h3>
              <p className="mt-0.5 truncate text-xs text-slate-500">
                {account.nicheLabel}
                {age && ` · aged ${age.year}`}
              </p>
            </div>
            <Chip tone={m.health.tone}>{m.health.label}</Chip>
          </div>

          {/* headline numbers */}
          <div className="mt-5 grid grid-cols-3 gap-3">
            <div>
              <p className="label !text-[9.5px]">Revenue</p>
              <p className="tnum mt-1 text-[15px] font-semibold text-slate-100">{money(m.revenue, { compact: true })}</p>
            </div>
            <div>
              <p className="label !text-[9.5px]">Spent</p>
              <p className="tnum mt-1 text-[15px] font-semibold text-slate-400">{money(m.totalCost, { compact: true })}</p>
            </div>
            <div>
              <p className="label !text-[9.5px]">Profit</p>
              <p className={cx('tnum mt-1 text-[15px] font-semibold', m.profit >= 0 ? 'text-jade-400' : 'text-ember-400')}>
                {money(m.profit, { compact: true, sign: true })}
              </p>
            </div>
          </div>

          {/* sparkline */}
          <div className="mt-4">
            <Sparkline points={m.spark ?? []} tone={m.profit >= 0 ? SERIES.revenue : SERIES.cost} />
          </div>

          {/* break-even */}
          <div className="mt-3">
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="text-[11px] text-slate-500">
                {m.breakevenPct >= 100 ? 'Past break-even' : `${Math.round(m.breakevenPct)}% to break-even`}
              </span>
              <span className="tnum text-[11px] font-semibold text-slate-400">
                {m.roi == null ? '—' : `${percent(m.roi, { sign: true })} ROI`}
              </span>
            </div>
            <Meter value={m.breakevenPct} tone={m.breakevenPct >= 100 ? 'emerald' : m.breakevenPct >= 50 ? 'amber' : 'rose'} />
          </div>

          {/* footer */}
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/[0.05] pt-3.5 text-[11px] text-slate-500">
            <span className="flex items-center gap-3">
              <span className="tnum flex items-center gap-1">
                <Users className="h-3 w-3" /> {number(account.subscribers)}
              </span>
              <span className="tnum flex items-center gap-1">
                <Video className="h-3 w-3" /> {m.videoCount}
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className={cx('h-1.5 w-1.5 rounded-full', toneClasses[status.tone]?.dot)} />
              {status.label}
            </span>
          </div>
        </Panel>
      </Link>
    </motion.div>
  );
}

/* ------------------------------------------------------- account row */

export function AccountRow({ account }: { account: Account }) {
  const m = account.metrics;
  const status = statusMeta[account.status] ?? statusMeta.active;

  return (
    <Link
      to={`/channels/${account.id}`}
      className="grid grid-cols-[minmax(0,2.2fr)_repeat(5,minmax(0,1fr))_auto] items-center gap-4 border-b border-white/[0.05] px-5 py-3.5 transition-colors last:border-0 hover:bg-white/[0.03]"
    >
      <div className="flex min-w-0 items-center gap-3">
        <ChannelAvatar account={account} size={32} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-100">{account.nickname}</p>
          <p className="truncate text-[11px] text-slate-500">{account.nicheLabel}</p>
        </div>
      </div>
      <span className="tnum text-right text-sm text-slate-300">{number(account.subscribers)}</span>
      <span className="tnum text-right text-sm text-slate-300">{money(m.revenue, { compact: true })}</span>
      <span className="tnum text-right text-sm text-slate-400">{money(m.totalCost, { compact: true })}</span>
      <span className={cx('tnum text-right text-sm font-semibold', m.profit >= 0 ? 'text-jade-400' : 'text-ember-400')}>
        {money(m.profit, { compact: true, sign: true })}
      </span>
      <span className="tnum text-right text-sm text-slate-300">{m.roi == null ? '—' : percent(m.roi, { sign: true })}</span>
      <span className="flex justify-end">
        <Chip tone={m.health.tone}>{m.health.label}</Chip>
      </span>
    </Link>
  );
}

export function AccountTableHeader() {
  return (
    <div className="grid grid-cols-[minmax(0,2.2fr)_repeat(5,minmax(0,1fr))_auto] items-center gap-4 border-b border-white/[0.07] px-5 py-3">
      <span className="label">Channel</span>
      <span className="label text-right">Subs</span>
      <span className="label text-right">Revenue</span>
      <span className="label text-right">Spent</span>
      <span className="label text-right">Profit</span>
      <span className="label text-right">ROI</span>
      <span className="label text-right">Status</span>
    </div>
  );
}
