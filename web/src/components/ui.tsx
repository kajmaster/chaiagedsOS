import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy, Eye, EyeOff, X } from 'lucide-react';
import { cx, toneClasses } from '@/lib/format';

/* ------------------------------------------------------------------ panel */

export function Panel({
  className,
  children,
  hover,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { hover?: boolean }) {
  return (
    <div className={cx('panel', hover && 'panel-hover', className)} {...rest}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.18em] text-slate-400">{children}</h2>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------- chip */

export function Chip({ tone = 'slate', children, className }: { tone?: string; children: React.ReactNode; className?: string }) {
  const t = toneClasses[tone] ?? toneClasses.slate;
  return <span className={cx('chip', t.chip, className)}>{children}</span>;
}

export function StatusDot({ tone = 'slate', pulse }: { tone?: string; pulse?: boolean }) {
  const t = toneClasses[tone] ?? toneClasses.slate;
  return <span className={cx('inline-block h-1.5 w-1.5 rounded-full', t.dot, pulse && 'animate-pulse-ring')} />;
}

/* ------------------------------------------------------------------ input */

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  prefix?: string;
  error?: string | null;
}

export const Field = React.forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, hint, prefix, error, className, ...rest },
  ref
) {
  return (
    <label className="block">
      {label && <span className="label mb-1.5 block">{label}</span>}
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-500">{prefix}</span>
        )}
        <input ref={ref} className={cx('field tnum', prefix && 'pl-7', error && 'border-ember-500/50', className)} {...rest} />
      </div>
      {error ? (
        <span className="mt-1.5 block text-xs text-ember-400">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-xs text-slate-500">{hint}</span>
      ) : null}
    </label>
  );
});

export function SelectField({
  label,
  hint,
  children,
  className,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string; hint?: string }) {
  return (
    <label className="block">
      {label && <span className="label mb-1.5 block">{label}</span>}
      <select className={cx('field appearance-none bg-ink-850 pr-9', className)} {...rest}>
        {children}
      </select>
      {hint && <span className="mt-1.5 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function TextArea({
  label,
  className,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return (
    <label className="block">
      {label && <span className="label mb-1.5 block">{label}</span>}
      <textarea className={cx('field min-h-[92px] resize-y leading-relaxed', className)} {...rest} />
    </label>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-xl border border-white/[0.07] bg-ink-850/60 px-3.5 py-3 text-left transition-colors hover:border-white/15"
    >
      <span>
        <span className="block text-sm font-medium text-slate-200">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-slate-500">{hint}</span>}
      </span>
      <span
        className={cx(
          'relative h-6 w-11 shrink-0 rounded-full transition-colors duration-300',
          checked ? 'bg-brass-sheen' : 'bg-white/10'
        )}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 520, damping: 34 }}
          className={cx(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow',
            checked ? 'left-[22px]' : 'left-0.5'
          )}
        />
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ modal */

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  width = 'max-w-2xl',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/75 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.99 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className={cx('panel relative my-8 w-full p-6 sm:p-7', width)}
          >
            <div className="mb-6 flex items-start justify-between gap-6">
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-white">{title}</h2>
                {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
              </div>
              <button onClick={onClose} className="btn-quiet -mr-2 -mt-1 rounded-lg p-2" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------ copy / mask */

export function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          /* clipboard blocked — nothing sensible to do */
        }
      }}
      className="btn-quiet rounded-lg p-1.5"
      aria-label={label ?? 'Copy'}
      title={label ?? 'Copy'}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-jade-400" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

export function SecretRow({
  label,
  value,
  masked,
  revealed,
  onReveal,
  mono,
}: {
  label: string;
  value: string | null;
  masked: string | null;
  revealed: boolean;
  onReveal: () => void;
  mono?: boolean;
}) {
  const shown = revealed ? value : masked;
  const empty = !masked && !value;

  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/[0.05] py-2.5 last:border-0">
      <span className="w-32 shrink-0 text-xs font-medium text-slate-500">{label}</span>
      <span className={cx('min-w-0 flex-1 truncate text-sm', mono && 'font-mono text-[13px]', empty ? 'text-slate-600' : 'text-slate-200')}>
        {empty ? 'Not set' : shown}
      </span>
      {!empty && (
        <span className="flex shrink-0 items-center gap-0.5">
          <button type="button" onClick={onReveal} className="btn-quiet rounded-lg p-1.5" aria-label={revealed ? 'Hide' : 'Reveal'}>
            {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
          {revealed && value && <CopyButton value={value} label={`Copy ${label}`} />}
        </span>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- skeleton */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('skeleton', className)} />;
}

/* ------------------------------------------------------------------ meter */

/** Horizontal progress used for break-even and cost composition. */
export function Meter({ value, tone = 'amber', className }: { value: number; tone?: string; className?: string }) {
  const t = toneClasses[tone] ?? toneClasses.slate;
  return (
    <div className={cx('h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]', className)}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className={cx('h-full rounded-full', t.dot)}
      />
    </div>
  );
}

/* -------------------------------------------------------------- countUp */

/** Animated figure — the small touch that makes a dashboard feel alive. */
export function CountUp({ value, format, className }: { value: number; format: (n: number) => string; className?: string }) {
  const [display, setDisplay] = useState(value);
  const from = useRef(value);
  const raf = useRef<number>();

  useEffect(() => {
    const start = performance.now();
    const origin = from.current;
    const delta = value - origin;
    if (delta === 0) return;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 700);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(origin + delta * eased);
      if (t < 1) raf.current = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      from.current = value;
    };
  }, [value]);

  return <span className={cx('tnum', className)}>{format(display)}</span>;
}

/* ------------------------------------------------------------------ empty */

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] text-slate-500">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-slate-200">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-slate-500">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
