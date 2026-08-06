import React, { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  Command,
  Download,
  Gauge,
  Info,
  LayoutGrid,
  LogOut,
  Menu,
  Plus,
  RefreshCw,
  Settings as SettingsIcon,
  Sparkles,
  X,
} from 'lucide-react';
import { useApp } from '@/store/AppStore';
import { cx, initials } from '@/lib/format';
import { api } from '@/lib/api';
import { AddChannelModal } from '@/components/AddChannelModal';
import { CommandPalette } from '@/components/CommandPalette';

const NAV = [
  { to: '/', label: 'Overview', icon: Gauge, end: true },
  { to: '/channels', label: 'Channels', icon: LayoutGrid, end: false },
  { to: '/settings', label: 'Settings', icon: SettingsIcon, end: false },
];

function Wordmark({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="relative flex h-8 w-8 items-center justify-center rounded-[10px] bg-brass-sheen text-[15px] font-bold text-ink-950 shadow-glow">
        C
      </span>
      {!compact && (
        <span className="leading-none">
          <span className="block text-[13px] font-semibold tracking-tight text-white">Chai's Aged Accounts</span>
          <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.22em] text-brass-400/80">Operating System</span>
        </span>
      )}
    </div>
  );
}

function Toasts() {
  const { toasts, dismissToast } = useApp();
  const icons = { success: CheckCircle2, error: AlertTriangle, info: Info };
  const tones = { success: 'text-jade-400', error: 'text-ember-400', info: 'text-brass-300' };

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex w-[min(92vw,380px)] flex-col gap-2.5">
      <AnimatePresence>
        {toasts.map((t) => {
          const Icon = icons[t.tone];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 24, scale: 0.97 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              className="panel pointer-events-auto flex items-start gap-3 p-3.5"
            >
              <Icon className={cx('mt-0.5 h-4 w-4 shrink-0', tones[t.tone])} />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-slate-100">{t.title}</p>
                {t.detail && <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{t.detail}</p>}
              </div>
              <button onClick={() => dismissToast(t.id)} className="btn-quiet rounded-md p-1">
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const { user, logout, syncAll, syncAvailable, accounts, toast } = useApp();
  const [addOpen, setAddOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => setNavOpen(false), [location.pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleSyncAll = async () => {
    if (!syncAvailable) {
      toast({
        title: 'Automatic sync is off',
        detail: 'Add a YOUTUBE_API_KEY on the server to pull live stats.',
        tone: 'info',
      });
      return;
    }
    setSyncing(true);
    await syncAll();
    setSyncing(false);
  };

  const sidebar = (
    <div className="flex h-full flex-col gap-6 p-5">
      <div className="px-1 pt-1">
        <Wordmark />
      </div>

      <button onClick={() => setAddOpen(true)} className="btn-primary w-full">
        <Plus className="h-4 w-4" /> Add channel
      </button>

      <nav className="flex flex-col gap-1">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cx(
                'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                isActive ? 'bg-white/[0.06] text-white' : 'text-slate-400 hover:bg-white/[0.03] hover:text-slate-200'
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute left-0 top-1/2 h-5 w-[2.5px] -translate-y-1/2 rounded-full bg-brass-400"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  />
                )}
                <Icon className="h-[17px] w-[17px]" />
                {label}
                {to === '/channels' && accounts.length > 0 && (
                  <span className="tnum ml-auto rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[11px] font-semibold text-slate-400">
                    {accounts.length}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto space-y-2">
        <button onClick={() => setPaletteOpen(true)} className="btn-ghost w-full justify-between text-slate-400">
          <span className="flex items-center gap-2">
            <Command className="h-3.5 w-3.5" /> Quick search
          </span>
          <kbd className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
        </button>

        <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.07] text-[11px] font-bold text-slate-300">
            {initials(user?.name || user?.email || 'U')}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium text-slate-200">{user?.name || 'Operator'}</span>
            <span className="block truncate text-[11px] text-slate-500">{user?.email}</span>
          </span>
          <button onClick={logout} className="btn-quiet rounded-lg p-1.5" title="Sign out">
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="grain min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] border-r border-white/[0.06] bg-ink-900/50 backdrop-blur-xl lg:block">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {navOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setNavOpen(false)}
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', stiffness: 340, damping: 34 }}
              className="fixed inset-y-0 left-0 z-50 w-[268px] border-r border-white/[0.08] bg-ink-900 lg:hidden"
            >
              {sidebar}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-ink-950/75 backdrop-blur-xl">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button onClick={() => setNavOpen(true)} className="btn-quiet -ml-2 rounded-lg p-2 lg:hidden">
              <Menu className="h-5 w-5" />
            </button>
            <div className="lg:hidden">
              <Wordmark compact />
            </div>

            {user?.isDemo && (
              <span className="chip hidden border-brass-400/25 bg-brass-400/10 text-brass-200 sm:inline-flex">
                <Sparkles className="h-3 w-3" /> Demo workspace — read only
              </span>
            )}

            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => api.downloadCsv().catch(() => toast({ title: 'Export failed', tone: 'error' }))}
                className="btn-quiet hidden rounded-lg p-2 sm:inline-flex"
                title="Export CSV"
              >
                <Download className="h-4 w-4" />
              </button>
              <button onClick={handleSyncAll} disabled={syncing} className="btn-ghost px-3 py-2 text-[13px]">
                <RefreshCw className={cx('h-3.5 w-3.5', syncing && 'animate-spin')} />
                <span className="hidden sm:inline">{syncing ? 'Syncing…' : 'Sync all'}</span>
              </button>
              <button onClick={() => setAddOpen(true)} className="btn-primary px-3 py-2 text-[13px]">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Add channel</span>
              </button>
            </div>
          </div>
        </header>

        <main className="px-4 pb-20 pt-7 sm:px-6 lg:px-8">{children}</main>
      </div>

      <AddChannelModal open={addOpen} onClose={() => setAddOpen(false)} />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onAddChannel={() => setAddOpen(true)}
        onNavigate={navigate}
      />
      <Toasts />
    </div>
  );
}
