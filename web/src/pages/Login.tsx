import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Loader2, Lock, PlayCircle, ShieldCheck, TrendingUp, Wand2, Zap } from 'lucide-react';
import { useApp } from '@/store/AppStore';
import { Field } from '@/components/ui';
import { cx } from '@/lib/format';

const PROOF = [
  { icon: Wand2, title: 'Zero data entry', body: 'Paste a channel URL. Views, subscribers and uploads sync straight from YouTube.' },
  { icon: TrendingUp, title: 'Profit, not vanity', body: 'Earnings estimated from your niche RPM, minus what every video actually cost you.' },
  { icon: ShieldCheck, title: 'Logins in one place', body: 'Username, password, 2FA and recovery email stored with the channel — and exportable as a plain .txt.' },
];

/** Static preview of the real dashboard — the first thing a visitor sees. */
function DashboardPreview() {
  const rows = [
    { name: 'Wealth Vault', niche: 'Finance', revenue: '$8.0k', profit: '+$2.7k', tone: 'jade', width: '86%' },
    { name: 'Cold Files', niche: 'True Crime', revenue: '$18.2k', profit: '+$11.6k', tone: 'jade', width: '100%' },
    { name: 'Margin Notes', niche: 'Business', revenue: '$4.5k', profit: '−$0.1k', tone: 'brass', width: '62%' },
    { name: 'Quiet Craft', niche: 'Compilation', revenue: '$0', profit: '−$1.1k', tone: 'ember', width: '18%' },
  ];
  const toneBg = { jade: 'bg-jade-500', brass: 'bg-brass-400', ember: 'bg-ember-500' } as const;
  const toneText = { jade: 'text-jade-400', brass: 'text-brass-300', ember: 'text-ember-400' } as const;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, rotateX: 8 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ delay: 0.25, duration: 1, ease: [0.22, 1, 0.36, 1] }}
      className="panel w-full max-w-md p-5"
      style={{ perspective: 1200 }}
    >
      <div className="mb-5 flex items-baseline justify-between">
        <div>
          <p className="label">Portfolio profit</p>
          <p className="tnum mt-1.5 text-3xl font-semibold tracking-tight text-white">$20,813</p>
        </div>
        <span className="chip border-jade-500/25 bg-jade-500/10 text-jade-300">+68% ROI</span>
      </div>

      <div className="mb-5 flex h-16 items-end gap-1.5">
        {[38, 44, 40, 55, 61, 58, 72, 78, 74, 88, 96, 91].map((h, i) => (
          <motion.span
            key={i}
            initial={{ height: 0 }}
            animate={{ height: `${h}%` }}
            transition={{ delay: 0.5 + i * 0.045, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="flex-1 rounded-t-[3px] bg-gradient-to-t from-brass-600/30 to-brass-400"
          />
        ))}
      </div>

      <div className="space-y-3">
        {rows.map((r, i) => (
          <motion.div
            key={r.name}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.7 + i * 0.09 }}
            className="flex items-center gap-3"
          >
            <span className="w-24 shrink-0 truncate text-[13px] font-medium text-slate-200">{r.name}</span>
            <span className="hidden w-20 shrink-0 truncate text-[11px] text-slate-500 sm:block">{r.niche}</span>
            <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
              <motion.span
                initial={{ width: 0 }}
                animate={{ width: r.width }}
                transition={{ delay: 0.85 + i * 0.09, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                className={cx('block h-full rounded-full', toneBg[r.tone as keyof typeof toneBg])}
              />
            </span>
            <span className={cx('tnum w-14 shrink-0 text-right text-[12px] font-semibold', toneText[r.tone as keyof typeof toneText])}>
              {r.profit}
            </span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

export function Login() {
  const { login, register, startDemo } = useApp();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'auth' | 'demo' | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy('auth');
    try {
      if (mode === 'signin') await login(email.trim(), password);
      else await register(email.trim(), password, name.trim() || undefined);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const demo = async () => {
    setError(null);
    setBusy('demo');
    try {
      await startDemo();
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  };

  return (
    <div className="grain relative min-h-screen">
      <div className="mx-auto grid min-h-screen max-w-[1240px] items-center gap-16 px-6 py-10 lg:grid-cols-[1.05fr_minmax(0,420px)] lg:gap-20 lg:py-16">
        {/* ------------------------------------------------- left: pitch */}
        <div className="order-2 lg:order-1">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            <div className="mb-8 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brass-sheen text-lg font-bold text-ink-950 shadow-glow">
                C
              </span>
              <span className="leading-none">
                <span className="block text-[15px] font-semibold tracking-tight text-white">Chai's Aged Accounts</span>
                <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.24em] text-brass-400/80">
                  Operating System
                </span>
              </span>
            </div>

            <h1 className="max-w-xl text-4xl font-semibold leading-[1.08] tracking-tight text-white sm:text-[42px]">
              Every channel you own.
              <span className="block font-display text-[46px] font-normal italic text-brass-200 sm:text-[52px]">One honest number.</span>
            </h1>

            <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-slate-400">
              Stop guessing which aged channel is actually making money. Chai's OS tracks earnings, production cost,
              break-even and monthly cashflow across your whole portfolio — and keeps every login safely in one place.
            </p>

            <div className="mt-10 grid max-w-lg gap-5 sm:grid-cols-3">
              {PROOF.map(({ icon: Icon, title, body }, i) => (
                <motion.div
                  key={title}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + i * 0.1, duration: 0.6 }}
                >
                  <Icon className="mb-2.5 h-4 w-4 text-brass-400" />
                  <p className="text-[13px] font-semibold text-slate-200">{title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">{body}</p>
                </motion.div>
              ))}
            </div>

            <div className="mt-12 hidden lg:block">
              <DashboardPreview />
            </div>
          </motion.div>
        </div>

        {/* ------------------------------------------------- right: auth */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="order-1 lg:order-2"
        >
          <div className="panel p-7">
            <div className="mb-6 flex gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1">
              {(['signin', 'signup'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setMode(m);
                    setError(null);
                  }}
                  className={cx(
                    'relative flex-1 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors',
                    mode === m ? 'text-ink-950' : 'text-slate-400 hover:text-slate-200'
                  )}
                >
                  {mode === m && (
                    <motion.span layoutId="auth-tab" className="absolute inset-0 rounded-lg bg-brass-sheen" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />
                  )}
                  <span className="relative">{m === 'signin' ? 'Sign in' : 'Create account'}</span>
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="space-y-4">
              {mode === 'signup' && (
                <Field label="Your name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" autoComplete="name" />
              )}
              <Field
                label="Email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
              <Field
                label="Password"
                type="password"
                required
                minLength={mode === 'signup' ? 8 : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'At least 8 characters' : '••••••••'}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                error={error}
              />

              <button type="submit" disabled={busy !== null} className="btn-primary w-full">
                {busy === 'auth' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {mode === 'signin' ? 'Sign in' : 'Create my workspace'}
              </button>
            </form>

            <div className="my-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-white/[0.07]" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">or</span>
              <span className="h-px flex-1 bg-white/[0.07]" />
            </div>

            <button onClick={demo} disabled={busy !== null} className="btn-ghost w-full border-brass-400/25 bg-brass-400/[0.06] text-brass-100 hover:border-brass-400/40 hover:bg-brass-400/10">
              {busy === 'demo' ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
              {busy === 'demo' ? 'Building your demo…' : 'See it with sample data'}
            </button>
            <p className="mt-2.5 text-center text-xs text-slate-500">
              A full 8-channel portfolio, loaded instantly. No signup, nothing to install.
            </p>

            <div className="mt-6 flex items-center justify-center gap-4 border-t border-white/[0.06] pt-5 text-[11px] text-slate-600">
              <span className="flex items-center gap-1.5">
                <Lock className="h-3 w-3" /> Encrypted at rest
              </span>
              <span className="flex items-center gap-1.5">
                <Zap className="h-3 w-3" /> YouTube auto-sync
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
