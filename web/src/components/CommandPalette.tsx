import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BarChart3, CornerDownLeft, Download, Gauge, LayoutGrid, Plus, Search, Settings, Youtube } from 'lucide-react';
import { useApp } from '@/store/AppStore';
import { api } from '@/lib/api';
import { avatarGradient, cx, initials, money } from '@/lib/format';

interface Item {
  id: string;
  label: string;
  hint?: string;
  group: string;
  icon: React.ReactNode;
  run: () => void;
}

export function CommandPalette({
  open,
  onClose,
  onAddChannel,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  onAddChannel: () => void;
  onNavigate: (to: string) => void;
}) {
  const { accounts, toast } = useApp();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const items = useMemo<Item[]>(() => {
    const actions: Item[] = [
      { id: 'add', label: 'Add a channel', hint: 'Paste a YouTube URL', group: 'Actions', icon: <Plus className="h-4 w-4" />, run: () => { onClose(); onAddChannel(); } },
      { id: 'export', label: 'Export portfolio to CSV', group: 'Actions', icon: <Download className="h-4 w-4" />, run: () => { onClose(); api.downloadCsv().catch(() => toast({ title: 'Export failed', tone: 'error' })); } },
      { id: 'nav-home', label: 'Go to Overview', group: 'Navigate', icon: <Gauge className="h-4 w-4" />, run: () => { onClose(); onNavigate('/'); } },
      { id: 'nav-ch', label: 'Go to Channels', group: 'Navigate', icon: <LayoutGrid className="h-4 w-4" />, run: () => { onClose(); onNavigate('/channels'); } },
      { id: 'nav-an', label: 'Go to Analytics', hint: 'Blended RPM, niche performance', group: 'Navigate', icon: <BarChart3 className="h-4 w-4" />, run: () => { onClose(); onNavigate('/analytics'); } },
      { id: 'nav-set', label: 'Go to Settings', group: 'Navigate', icon: <Settings className="h-4 w-4" />, run: () => { onClose(); onNavigate('/settings'); } },
    ];

    const channels: Item[] = accounts.map((a) => ({
      id: a.id,
      label: a.nickname,
      hint: `${a.nicheLabel} · ${money(a.metrics.profit, { sign: true })} profit`,
      group: 'Channels',
      icon: (
        <span
          className="flex h-5 w-5 items-center justify-center rounded-md text-[9px] font-bold text-white/90"
          style={{ background: avatarGradient(a.nickname) }}
        >
          {initials(a.nickname)}
        </span>
      ),
      run: () => {
        onClose();
        onNavigate(`/channels/${a.id}`);
      },
    }));

    return [...channels, ...actions];
  }, [accounts, onAddChannel, onClose, onNavigate, toast]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => `${i.label} ${i.hint ?? ''} ${i.group}`.toLowerCase().includes(q));
  }, [items, query]);

  const groups = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const item of filtered) {
      if (!map.has(item.group)) map.set(item.group, []);
      map.get(item.group)!.push(item);
    }
    return [...map.entries()];
  }, [filtered]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  useEffect(() => setCursor(0), [query]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onClose();
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setCursor((c) => Math.min(c + 1, filtered.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setCursor((c) => Math.max(c - 1, 0));
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        filtered[cursor]?.run();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, filtered, cursor, onClose]);

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  let flatIndex = -1;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-[12vh]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.985 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="panel relative w-full max-w-xl overflow-hidden"
          >
            <div className="flex items-center gap-3 border-b border-white/[0.07] px-4">
              <Search className="h-4 w-4 shrink-0 text-slate-500" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search channels or run a command…"
                className="w-full bg-transparent py-4 text-[15px] text-slate-100 placeholder:text-slate-600 focus:outline-none"
              />
              <kbd className="hidden shrink-0 rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-slate-500 sm:block">
                ESC
              </kbd>
            </div>

            <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
              {groups.length === 0 && (
                <p className="px-3 py-10 text-center text-sm text-slate-500">No matches for “{query}”.</p>
              )}
              {groups.map(([group, list]) => (
                <div key={group} className="mb-1">
                  <p className="px-3 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">{group}</p>
                  {list.map((item) => {
                    flatIndex++;
                    const active = flatIndex === cursor;
                    const myIndex = flatIndex;
                    return (
                      <button
                        key={item.id}
                        data-active={active}
                        onMouseEnter={() => setCursor(myIndex)}
                        onClick={item.run}
                        className={cx(
                          'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                          active ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]'
                        )}
                      >
                        <span className={cx('shrink-0', active ? 'text-brass-300' : 'text-slate-500')}>{item.icon}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-slate-100">{item.label}</span>
                          {item.hint && <span className="block truncate text-xs text-slate-500">{item.hint}</span>}
                        </span>
                        {active && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-slate-600" />}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-white/[0.07] px-4 py-2.5 text-[11px] text-slate-600">
              <span className="flex items-center gap-1.5">
                <Youtube className="h-3 w-3" /> {accounts.length} channels indexed
              </span>
              <span>↑↓ navigate · ↵ open</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
