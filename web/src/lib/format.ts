/** Presentation helpers. Everything the eye scans in under a second. */

export function money(value: number | null | undefined, opts: { compact?: boolean; sign?: boolean; decimals?: number } = {}) {
  const n = Number(value ?? 0);
  const { compact = false, sign = false, decimals } = opts;
  const abs = Math.abs(n);

  let body: string;
  if (compact && abs >= 1000) {
    body = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(abs);
  } else {
    const d = decimals ?? (abs > 0 && abs < 10 ? 2 : 0);
    body = new Intl.NumberFormat('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }).format(abs);
  }

  const prefix = n < 0 ? '−' : sign && n > 0 ? '+' : '';
  return `${prefix}$${body}`;
}

export function number(value: number | null | undefined, compact = true) {
  const n = Number(value ?? 0);
  if (compact && Math.abs(n) >= 1000) {
    return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
  }
  return new Intl.NumberFormat('en-US').format(Math.round(n));
}

export function percent(value: number | null | undefined, opts: { sign?: boolean; decimals?: number } = {}) {
  if (value == null) return '—';
  const { sign = false, decimals = Math.abs(value) < 10 ? 1 : 0 } = opts;
  const prefix = value < 0 ? '−' : sign && value > 0 ? '+' : '';
  return `${prefix}${Math.abs(value).toFixed(decimals)}%`;
}

export function relativeTime(iso: string | null | undefined) {
  if (!iso) return 'never';
  const diff = Date.now() - Date.parse(iso);
  if (!Number.isFinite(diff)) return 'never';
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
}

export function shortDate(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function dateInput(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

/** "Aged since 2017 · 9 yrs" — the thing customers actually bought. */
export function channelAge(iso: string | null | undefined) {
  if (!iso) return null;
  const created = new Date(iso);
  if (Number.isNaN(created.getTime())) return null;
  const years = (Date.now() - created.getTime()) / (365.25 * 86_400_000);
  return { year: created.getFullYear(), years: Math.max(0, Math.floor(years)) };
}

export const toneClasses: Record<string, { text: string; bg: string; border: string; dot: string; chip: string }> = {
  emerald: {
    text: 'text-jade-400',
    bg: 'bg-jade-500/10',
    border: 'border-jade-500/25',
    dot: 'bg-jade-400',
    chip: 'border-jade-500/25 bg-jade-500/10 text-jade-300',
  },
  amber: {
    text: 'text-brass-300',
    bg: 'bg-brass-400/10',
    border: 'border-brass-400/25',
    dot: 'bg-brass-400',
    chip: 'border-brass-400/25 bg-brass-400/10 text-brass-200',
  },
  rose: {
    text: 'text-ember-400',
    bg: 'bg-ember-500/10',
    border: 'border-ember-500/25',
    dot: 'bg-ember-400',
    chip: 'border-ember-500/25 bg-ember-500/10 text-ember-300',
  },
  slate: {
    text: 'text-slate-400',
    bg: 'bg-white/[0.04]',
    border: 'border-white/10',
    dot: 'bg-slate-500',
    chip: 'border-white/10 bg-white/[0.04] text-slate-400',
  },
};

export const statusMeta: Record<string, { label: string; tone: string }> = {
  active: { label: 'Active', tone: 'emerald' },
  warming: { label: 'Warming up', tone: 'amber' },
  paused: { label: 'Paused', tone: 'slate' },
  sold: { label: 'Sold', tone: 'slate' },
  banned: { label: 'Terminated', tone: 'rose' },
};

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

/** Deterministic gradient per channel so avatars feel designed, not random. */
export function avatarGradient(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return `linear-gradient(135deg, hsl(${h} 46% 34%) 0%, hsl(${(h + 42) % 360} 40% 20%) 100%)`;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}
