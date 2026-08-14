import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Download,
  BadgeCheck,
  BadgeDollarSign,
  Clock,
  ExternalLink,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Wallet,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useApp } from '@/store/AppStore';
import { Chip, EmptyState, Field, Meter, Modal, Panel, SectionTitle, SecretRow, SelectField, Skeleton, TextArea, Toggle } from '@/components/ui';
import { ChannelChart } from '@/components/charts';
import { ChannelAvatar } from '@/components/portfolio';
import { channelAge, cx, dateInput, duration, money, number, percent, relativeTime, shortDate, statusMeta, toneClasses } from '@/lib/format';
import type { AccountDetail, Credentials, TimelinePoint, Video } from '@/lib/types';

const DECAY = [0.5, 0.25, 0.15, 0.1];

/** Same revenue-decay model the server uses, so the two charts agree. */
function buildChannelTimeline(account: AccountDetail, months = 12): TimelinePoint[] {
  const now = new Date();
  const buckets: TimelinePoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleString('en-US', { month: 'short' }),
      year: d.getFullYear(),
      revenue: 0,
      cost: 0,
      profit: 0,
      views: 0,
    });
  }
  const index = new Map(buckets.map((b) => [b.key, b]));
  const keyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  const modelled = account.videos.reduce((s, v) => s + v.estimatedRevenue, 0);
  const scale = account.metrics.revenueSource === 'actual' && modelled > 0 ? account.metrics.revenue / modelled : 1;

  for (const v of account.videos) {
    if (!v.publishedAt) continue;
    const published = new Date(v.publishedAt);
    const costBucket = index.get(keyOf(published));
    if (costBucket) {
      costBucket.cost += v.cost;
      costBucket.views += v.views;
    }
    DECAY.forEach((weight, offset) => {
      const b = index.get(keyOf(new Date(published.getFullYear(), published.getMonth() + offset, 1)));
      if (b) b.revenue += v.estimatedRevenue * scale * weight;
    });
  }
  for (const b of buckets) {
    if (account.monthlyCost > 0) b.cost += account.monthlyCost;
    b.revenue = Math.round(b.revenue * 100) / 100;
    b.cost = Math.round(b.cost * 100) / 100;
    b.profit = Math.round((b.revenue - b.cost) * 100) / 100;
  }
  return buckets;
}

/* ------------------------------------------------------------ KPI strip */

function Kpi({ label, value, tone, hint }: { label: string; value: string; tone?: string; hint?: React.ReactNode }) {
  return (
    <div className="px-5 py-4">
      <p className="label">{label}</p>
      <p className={cx('tnum mt-2 text-xl font-semibold tracking-tight', tone ?? 'text-white')}>{value}</p>
      {hint && <div className="mt-1 text-[11px] text-slate-500">{hint}</div>}
    </div>
  );
}

/* ------------------------------------------------------ channel details */

const CRED_FIELDS: { key: keyof Credentials; label: string; mono?: boolean }[] = [
  { key: 'username', label: 'Username' },
  { key: 'email', label: 'Email' },
  { key: 'password', label: 'Password', mono: true },
  { key: 'twoFactor', label: '2FA / secret', mono: true },
  { key: 'recoveryEmail', label: 'Recovery email' },
];

/** Everything about a channel as plain text, for the customer's own records. */
function buildTxt(account: AccountDetail, creds: Credentials | null) {
  const m = account.metrics;
  const L: string[] = [];
  L.push(account.nickname);
  L.push('='.repeat(account.nickname.length));
  L.push('');
  L.push(`Niche          : ${account.nicheLabel}`);
  L.push(`Audience       : ${account.audienceTierLabel}`);
  L.push(`Status         : ${statusMeta[account.status]?.label ?? account.status}`);
  if (account.channelUrl) L.push(`Channel URL    : ${account.channelUrl}`);
  if (account.accountCreatedAt) L.push(`Channel created: ${shortDate(account.accountCreatedAt)}`);
  if (account.acquiredAt) L.push(`Acquired       : ${shortDate(account.acquiredAt)}`);
  L.push('');
  L.push('LOGIN DETAILS');
  L.push('-------------');
  for (const f of CRED_FIELDS) {
    const value = creds?.[f.key];
    L.push(`${f.label.padEnd(15)}: ${value || '(not set)'}`);
  }
  L.push('');
  L.push('NUMBERS');
  L.push('-------');
  L.push(`Subscribers    : ${number(account.subscribers, false)}`);
  L.push(`Videos tracked : ${m.videoCount}`);
  L.push(`Revenue        : ${money(m.revenue)} (${m.revenueSource === 'actual' ? 'from logged payouts' : 'estimated'})`);
  L.push(`Total spent    : ${money(m.totalCost)}`);
  L.push(`Profit         : ${money(m.profit, { sign: true })}`);
  L.push(`ROI            : ${m.roi == null ? '-' : percent(m.roi, { sign: true })}`);
  L.push(`Effective RPM  : $${m.rpm.rpm.toFixed(2)}`);
  if (account.notes) {
    L.push('');
    L.push('NOTES');
    L.push('-----');
    L.push(account.notes);
  }
  L.push('');
  L.push(`Exported ${new Date().toLocaleString()} from Chai's Aged Accounts OS`);
  // CRLF so the file opens correctly in Windows Notepad, which is where most
  // people will actually read this.
  return L.join('\r\n');
}

function downloadTxt(filename: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function Vault({ account, onEdit }: { account: AccountDetail; onEdit: () => void }) {
  const { toast, user } = useApp();
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [plain, setPlain] = useState<Credentials | null>(null);
  const [loading, setLoading] = useState(false);

  /** Fetch the decrypted set once, then reuse it for reveals and export. */
  const load = async () => {
    if (plain) return plain;
    setLoading(true);
    try {
      const res = await api.revealCredentials(account.id);
      setPlain(res.credentials);
      return res.credentials;
    } catch (err) {
      toast({ title: 'Could not read the login details', detail: (err as Error).message, tone: 'error' });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const reveal = async (field: keyof Credentials) => {
    if (revealed[field]) return setRevealed((r) => ({ ...r, [field]: false }));
    if (!(await load())) return;
    setRevealed((r) => ({ ...r, [field]: true }));
  };

  const exportTxt = async () => {
    const creds = await load();
    const safe = account.nickname.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    downloadTxt(`${safe}.txt`, buildTxt(account, creds));
  };

  const empty = CRED_FIELDS.every((f) => !account.credentials[f.key]);

  return (
    <Panel className="p-6">
      <SectionTitle
        action={
          !user?.isDemo && (
            <button onClick={onEdit} className="btn-quiet px-2 py-1 text-xs">
              <Pencil className="h-3 w-3" /> Edit
            </button>
          )
        }
      >
        <span className="flex items-center gap-2">
          <KeyRound className="h-3.5 w-3.5 text-brass-400" /> Login details
        </span>
      </SectionTitle>

      {empty ? (
        <p className="py-4 text-sm text-slate-500">
          Nothing saved yet.{' '}
          <button onClick={onEdit} className="text-brass-300 underline underline-offset-2 hover:text-brass-200">
            Add them
          </button>{' '}
          so they live with the channel.
        </p>
      ) : (
        <div>
          {CRED_FIELDS.map((f) => (
            <SecretRow
              key={f.key}
              label={f.label}
              mono={f.mono}
              value={plain?.[f.key] ?? null}
              masked={account.credentials[f.key]}
              revealed={!!revealed[f.key]}
              onReveal={() => reveal(f.key)}
            />
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.05] pt-4">
        <p className="flex items-center gap-1.5 text-[11px] text-slate-600">
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
          Encrypted at rest, and only decrypted when you ask for it.
        </p>
        <button onClick={exportTxt} className="btn-ghost px-3 py-1.5 text-xs">
          <Download className="h-3.5 w-3.5" /> Export .txt
        </button>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------- edit modal */

/**
 * One definition of the edit form's shape, used for both the initial state and
 * the reset. It was written out twice and the two copies drifted the moment a
 * field was added.
 */
function formFrom(account: AccountDetail) {
  return {
    nickname: account.nickname,
    niche: account.niche,
    audienceTier: account.audienceTier,
    status: account.status as string,
    channelUrl: account.channelUrl ?? '',
    acquisitionCost: String(account.acquisitionCost || ''),
    monthlyCost: String(account.monthlyCost || ''),
    rpmOverride: account.rpmOverride == null ? '' : String(account.rpmOverride),
    costModel: account.costModel as string,
    costPerMinute: account.costPerMinute ? String(account.costPerMinute) : '',
    acquiredAt: dateInput(account.acquiredAt),
    monetized: account.monetized,
    notes: account.notes ?? '',
  };
}

function EditModal({
  account,
  open,
  onClose,
  onSaved,
}: {
  account: AccountDetail;
  open: boolean;
  onClose: () => void;
  onSaved: (a: AccountDetail) => void;
}) {
  const { niches, audienceTiers, toast, refresh, user } = useApp();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => formFrom(account));
  const [creds, setCreds] = useState({ username: '', email: '', password: '', twoFactor: '', recoveryEmail: '' });
  const [touchedCreds, setTouchedCreds] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(formFrom(account));
    setCreds({ username: '', email: '', password: '', twoFactor: '', recoveryEmail: '' });
    setTouchedCreds(false);
  }, [open, account]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Only send credential fields the user actually typed into.
      const credentials: Record<string, string | null> | undefined = touchedCreds
        ? Object.fromEntries(Object.entries(creds).filter(([, v]) => v !== ''))
        : undefined;


      const { account: updated } = await api.updateAccount(account.id, {
        nickname: form.nickname,
        niche: form.niche,
        audienceTier: form.audienceTier,
        status: form.status,
        channelUrl: form.channelUrl || null,
        acquisitionCost: Number(form.acquisitionCost) || 0,
        monthlyCost: Number(form.monthlyCost) || 0,
        rpmOverride: form.rpmOverride === '' ? null : Number(form.rpmOverride),
        costModel: form.costModel,
        costPerMinute: form.costModel === 'per_minute' ? Number(form.costPerMinute) || 0 : 0,
        acquiredAt: form.acquiredAt ? new Date(form.acquiredAt).toISOString() : null,
        monetized: form.monetized,
        notes: form.notes || null,
        ...(credentials && Object.keys(credentials).length ? { credentials } : {}),
      });
      onSaved(updated);
      await refresh();
      toast({ title: 'Channel updated', tone: 'success' });
      onClose();
    } catch (err) {
      toast({ title: 'Could not save', detail: (err as Error).message, tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setCred = (k: keyof typeof creds, v: string) => {
    setTouchedCreds(true);
    setCreds((c) => ({ ...c, [k]: v }));
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit channel" subtitle="Leave a credential blank to keep what's already stored." width="max-w-3xl">
      <form onSubmit={submit} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Channel name" value={form.nickname} onChange={(e) => set('nickname', e.target.value)} required />
          <SelectField label="Status" value={form.status} onChange={(e) => set('status', e.target.value as any)}>
            {Object.entries(statusMeta).map(([id, m]) => (
              <option key={id} value={id}>
                {m.label}
              </option>
            ))}
          </SelectField>
          <SelectField label="Niche" value={form.niche} onChange={(e) => set('niche', e.target.value)}>
            {niches.map((n) => (
              <option key={n.id} value={n.id}>
                {n.label}
              </option>
            ))}
          </SelectField>
          <SelectField label="Main audience" value={form.audienceTier} onChange={(e) => set('audienceTier', e.target.value)}>
            {audienceTiers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </SelectField>
          <Field label="Channel URL" value={form.channelUrl} onChange={(e) => set('channelUrl', e.target.value)} placeholder="https://youtube.com/@…" />
          <Field label="Date acquired" type="date" value={form.acquiredAt} onChange={(e) => set('acquiredAt', e.target.value)} />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Purchase price" prefix="$" type="number" min="0" value={form.acquisitionCost} onChange={(e) => set('acquisitionCost', e.target.value)} />
          <Field label="Monthly cost" prefix="$" type="number" min="0" value={form.monthlyCost} onChange={(e) => set('monthlyCost', e.target.value)} />
          <Field
            label="RPM override"
            prefix="$"
            type="number"
            min="0"
            step="0.01"
            value={form.rpmOverride}
            onChange={(e) => set('rpmOverride', e.target.value)}
            placeholder="auto"
            hint="Your real AdSense RPM"
          />
        </div>

        {/* Editing is bought both ways — a price per video, or a rate per
            finished minute like the pay-as-you-go services charge. */}
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
          <p className="label mb-3 flex items-center gap-2 !text-brass-400/90">
            <Clock className="h-3 w-3" /> How production is billed
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Billing model" value={form.costModel} onChange={(e) => set('costModel', e.target.value)}>
              <option value="flat">Flat price per video</option>
              <option value="per_minute">Rate per finished minute</option>
            </SelectField>
            {form.costModel === 'per_minute' ? (
              <Field
                label="Rate per minute"
                prefix="$"
                type="number"
                min="0"
                step="0.01"
                value={form.costPerMinute}
                onChange={(e) => set('costPerMinute', e.target.value)}
                placeholder="0.00"
                hint="Applied to every video's real length"
              />
            ) : (
              <div className="flex items-end pb-1 text-xs leading-relaxed text-slate-500">
                Each video keeps whatever cost you set on it.
              </div>
            )}
          </div>
          {form.costModel === 'per_minute' && (
            <p className="mt-3 text-xs leading-relaxed text-slate-500">
              Cost is calculated from each video's actual runtime, pulled from YouTube. Anything you type into a video's cost is
              added on top — useful for a thumbnail or voiceover billed separately.
            </p>
          )}
        </div>

        <Toggle checked={form.monetized} onChange={(v) => set('monetized', v)} label="Monetised" hint="Earnings only count once the channel is in the Partner Programme." />

        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
          <p className="label mb-3 flex items-center gap-2 !text-brass-400/90">
            <KeyRound className="h-3 w-3" /> Credentials
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Username" value={creds.username} onChange={(e) => setCred('username', e.target.value)} placeholder="unchanged" autoComplete="off" />
            <Field label="Email" value={creds.email} onChange={(e) => setCred('email', e.target.value)} placeholder="unchanged" autoComplete="off" />
            <Field label="Password" value={creds.password} onChange={(e) => setCred('password', e.target.value)} placeholder="unchanged" autoComplete="new-password" />
            <Field label="Recovery email" value={creds.recoveryEmail} onChange={(e) => setCred('recoveryEmail', e.target.value)} placeholder="unchanged" autoComplete="off" />
            <div className="sm:col-span-2">
              <Field label="2FA / secret code" value={creds.twoFactor} onChange={(e) => setCred('twoFactor', e.target.value)} placeholder="unchanged" autoComplete="off" />
            </div>
          </div>
        </div>

        <TextArea label="Notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} />

        <div className="flex justify-end gap-2 border-t border-white/[0.07] pt-5">
          <button type="button" onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save changes
          </button>
        </div>
      </form>

    </Modal>
  );
}

/* ----------------------------------------------------------- video table */

function VideoTable({ account, onChange }: { account: AccountDetail; onChange: (a: AccountDetail) => void }) {
  const { toast, user, refresh } = useApp();
  const [busy, setBusy] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkCost, setBulkCost] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState({ title: '', views: '', cost: '', publishedAt: dateInput(new Date().toISOString()) });

  const saveCost = async (video: Video, value: string) => {
    const cost = Number(value);
    if (!Number.isFinite(cost) || cost === video.cost) return;
    setBusy(video.id);
    try {
      const { account: updated } = await api.updateVideo(account.id, video.id, { cost });
      onChange(updated);
      await refresh();
    } catch (err) {
      toast({ title: 'Could not update cost', detail: (err as Error).message, tone: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const applyBulk = async () => {
    const cost = Number(bulkCost);
    if (!Number.isFinite(cost)) return;
    try {
      const { account: updated } = await api.bulkCost(account.id, cost, false);
      onChange(updated);
      await refresh();
      setBulkOpen(false);
      setBulkCost('');
      toast({ title: `Applied ${money(cost)} to every video`, tone: 'success' });
    } catch (err) {
      toast({ title: 'Could not apply cost', detail: (err as Error).message, tone: 'error' });
    }
  };

  const addVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { account: updated } = await api.addVideo(account.id, {
        title: draft.title,
        views: Number(draft.views) || 0,
        cost: Number(draft.cost) || 0,
        publishedAt: draft.publishedAt ? new Date(draft.publishedAt).toISOString() : null,
      });
      onChange(updated);
      await refresh();
      setAddOpen(false);
      setDraft({ title: '', views: '', cost: '', publishedAt: dateInput(new Date().toISOString()) });
    } catch (err) {
      toast({ title: 'Could not add video', detail: (err as Error).message, tone: 'error' });
    }
  };

  const readOnly = !!user?.isDemo;
  const perMinute = account.costModel === 'per_minute' && account.costPerMinute > 0;

  return (
    <Panel className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-6 py-4">
        <div>
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.18em] text-slate-400">Videos</h2>
          <p className="mt-1 text-xs text-slate-500">
            {account.videos.length} tracked ·{' '}
            {perMinute
              ? `${account.metrics.totalMinutes.toFixed(0)} min at ${money(account.costPerMinute)}/min · ${money(
                  account.metrics.avgCostPerVideo
                )} average`
              : `${money(account.metrics.avgCostPerVideo)} average cost`}
          </p>
        </div>
        {!readOnly && (
          <div className="flex gap-2">
            {!perMinute && (
              <button onClick={() => setBulkOpen(true)} className="btn-ghost px-3 py-1.5 text-xs">
                <BadgeDollarSign className="h-3.5 w-3.5" /> Set cost for all
              </button>
            )}
            <button onClick={() => setAddOpen(true)} className="btn-ghost px-3 py-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" /> Add video
            </button>
          </div>
        )}
      </div>

      {account.videos.length === 0 ? (
        <EmptyState
          icon={<Plus className="h-5 w-5" />}
          title="No videos yet"
          body="Sync the channel to pull uploads from YouTube automatically, or add one by hand."
        />
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-[minmax(0,3fr)_repeat(6,minmax(0,1fr))] gap-4 border-b border-white/[0.06] px-6 py-2.5">
              <span className="label">Title</span>
              <span className="label text-right">Published</span>
              <span className="label text-right">Length</span>
              <span className="label text-right">Views</span>
              <span className="label text-right">Cost</span>
              <span className="label text-right">Revenue</span>
              <span className="label text-right">Profit</span>
            </div>

            {account.videos.map((v) => (
              <div
                key={v.id}
                className="grid grid-cols-[minmax(0,3fr)_repeat(6,minmax(0,1fr))] items-center gap-4 border-b border-white/[0.04] px-6 py-3 last:border-0 transition-colors hover:bg-white/[0.02]"
              >
                <span className="flex min-w-0 items-center gap-3">
                  {v.thumbnail && <img src={v.thumbnail} alt="" className="h-8 w-14 shrink-0 rounded object-cover" />}
                  <span className="truncate text-[13px] text-slate-200">{v.title}</span>
                </span>
                <span className="tnum text-right text-xs text-slate-500">{shortDate(v.publishedAt)}</span>
                <span className="tnum text-right text-[13px] text-slate-400">{duration(v.durationSeconds)}</span>
                <span className="tnum text-right text-[13px] text-slate-300">{number(v.views)}</span>
                <span className="text-right">
                  {perMinute ? (
                    // Derived from runtime — typing over it would contradict the
                    // billing model the customer just chose.
                    <span
                      className="tnum cursor-help text-[13px] text-slate-300 underline decoration-dotted underline-offset-4"
                      title={`${duration(v.durationSeconds)} × ${money(account.costPerMinute)}/min = ${money(v.minuteCost)}`}
                    >
                      {money(v.cost)}
                    </span>
                  ) : readOnly ? (
                    <span className="tnum text-[13px] text-slate-400">{money(v.cost)}</span>
                  ) : (
                    <input
                      type="number"
                      min="0"
                      defaultValue={v.cost || ''}
                      placeholder="0"
                      onBlur={(e) => saveCost(v, e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                      className={cx(
                        'tnum w-20 rounded-lg border border-transparent bg-transparent px-2 py-1 text-right text-[13px] text-slate-300',
                        'hover:border-white/10 hover:bg-white/[0.04] focus:border-brass-400/50 focus:bg-ink-850',
                        busy === v.id && 'opacity-50'
                      )}
                    />
                  )}
                </span>
                <span className="tnum text-right text-[13px] text-slate-200">{money(v.revenue)}</span>
                <span className={cx('tnum text-right text-[13px] font-semibold', v.profit >= 0 ? 'text-jade-400' : 'text-ember-400')}>
                  {money(v.profit, { sign: true })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal open={bulkOpen} onClose={() => setBulkOpen(false)} title="Set cost for every video" subtitle="Fastest way to get accurate numbers when your production cost is fixed." width="max-w-md">
        <Field label="Cost per video" prefix="$" type="number" min="0" value={bulkCost} onChange={(e) => setBulkCost(e.target.value)} autoFocus />
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => setBulkOpen(false)} className="btn-ghost">Cancel</button>
          <button onClick={applyBulk} className="btn-primary">Apply to {account.videos.length} videos</button>
        </div>
      </Modal>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add a video" width="max-w-lg">
        <form onSubmit={addVideo} className="space-y-4">
          <Field label="Title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} required />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Views" type="number" min="0" value={draft.views} onChange={(e) => setDraft({ ...draft, views: e.target.value })} />
            <Field label="Cost" prefix="$" type="number" min="0" value={draft.cost} onChange={(e) => setDraft({ ...draft, cost: e.target.value })} />
            <Field label="Published" type="date" value={draft.publishedAt} onChange={(e) => setDraft({ ...draft, publishedAt: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setAddOpen(false)} className="btn-ghost">Cancel</button>
            <button type="submit" className="btn-primary">Add video</button>
          </div>
        </form>
      </Modal>
    </Panel>
  );
}

/* ------------------------------------------------------------------ page */

export function ChannelDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast, refresh, syncAvailable, user } = useApp();

  const [account, setAccount] = useState<AccountDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [payout, setPayout] = useState({ period: new Date().toISOString().slice(0, 7), amount: '' });

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { account: a } = await api.account(id);
      setAccount(a);
    } catch (err) {
      toast({ title: 'Channel not found', detail: (err as Error).message, tone: 'error' });
      navigate('/channels');
    } finally {
      setLoading(false);
    }
  }, [id, navigate, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const timeline = useMemo(() => (account ? buildChannelTimeline(account) : []), [account]);

  if (loading || !account) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-24" />
        <Skeleton className="h-28" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  const m = account.metrics;
  const status = statusMeta[account.status] ?? statusMeta.active;
  const age = channelAge(account.accountCreatedAt);

  const sync = async () => {
    if (!syncAvailable) {
      toast({ title: 'Automatic sync is off', detail: 'Add a YOUTUBE_API_KEY on the server to enable it.', tone: 'info' });
      return;
    }
    setSyncing(true);
    try {
      const res = await api.syncAccount(account.id);
      setAccount(res.account);
      await refresh();

      const s = res.sync;
      // Say how many of the channel's uploads we actually hold. Silently
      // pulling a subset is what made the tool look broken.
      const detail = s.truncated
        ? `Pulled the newest ${s.fetched} of ${s.channelVideoCount} uploads.`
        : `${s.fetched} of ${s.channelVideoCount} uploads tracked · ${s.added} new, ${s.updated} updated.`;
      toast({ title: `Synced ${s.channel}`, detail, tone: 'success' });
    } catch (err) {
      toast({ title: 'Sync failed', detail: (err as Error).message, tone: 'error' });
    } finally {
      setSyncing(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Delete ${account.nickname}? This removes its videos and stored credentials permanently.`)) return;
    try {
      await api.deleteAccount(account.id);
      await refresh();
      toast({ title: `${account.nickname} deleted`, tone: 'success' });
      navigate('/channels');
    } catch (err) {
      toast({ title: 'Could not delete', detail: (err as Error).message, tone: 'error' });
    }
  };

  const savePayout = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { account: updated } = await api.addPayout(account.id, { period: payout.period, amount: Number(payout.amount) || 0 });
      setAccount(updated);
      await refresh();
      setPayoutOpen(false);
      setPayout({ period: new Date().toISOString().slice(0, 7), amount: '' });
      toast({ title: 'Payout logged', detail: 'Real earnings now override the estimate.', tone: 'success' });
    } catch (err) {
      toast({ title: 'Could not save payout', detail: (err as Error).message, tone: 'error' });
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
      <Link to="/channels" className="inline-flex items-center gap-1.5 text-[13px] text-slate-500 transition-colors hover:text-slate-300">
        <ArrowLeft className="h-3.5 w-3.5" /> All channels
      </Link>

      {/* -------------------------------------------------------- header */}
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="flex min-w-0 items-start gap-4">
          <ChannelAvatar account={account} size={56} />
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-white">{account.nickname}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Chip tone={m.health.tone}>{m.health.label}</Chip>
              <Chip tone={status.tone}>{status.label}</Chip>
              <Chip>{account.nicheLabel}</Chip>
              {age && <Chip>Aged since {age.year}</Chip>}
              {!account.monetized && <Chip tone="amber">Not monetised</Chip>}
            </div>
            <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
              <span className="tnum">{number(account.subscribers)} subscribers</span>
              <span>·</span>
              <span className="tnum">{number(account.totalViews)} lifetime views</span>
              <span>·</span>
              <span>synced {relativeTime(account.lastSyncedAt)}</span>
              {account.channelUrl && (
                <>
                  <span>·</span>
                  <a href={account.channelUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brass-300 hover:text-brass-200">
                    Open on YouTube <ExternalLink className="h-3 w-3" />
                  </a>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={sync} disabled={syncing} className="btn-ghost px-3 py-2 text-[13px]">
            <RefreshCw className={cx('h-3.5 w-3.5', syncing && 'animate-spin')} /> Sync
          </button>
          {!user?.isDemo && (
            <>
              <button onClick={() => setPayoutOpen(true)} className="btn-ghost px-3 py-2 text-[13px]">
                <Wallet className="h-3.5 w-3.5" /> Log payout
              </button>
              <button onClick={() => setEditOpen(true)} className="btn-primary px-3 py-2 text-[13px]">
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
              <button onClick={remove} className="btn-quiet rounded-xl px-2.5 py-2 text-ember-400/70 hover:bg-ember-500/10 hover:text-ember-400" title="Delete">
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {account.syncError && (
        <div className="rounded-xl border border-ember-500/25 bg-ember-500/[0.07] px-4 py-3 text-[13px] text-ember-200">
          Last sync failed: {account.syncError}
        </div>
      )}

      {/* ----------------------------------------------------- KPI strip */}
      <Panel className="grid grid-cols-2 divide-x divide-y divide-white/[0.05] sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0">
        <Kpi
          label="Revenue"
          value={money(m.revenue)}
          hint={
            m.revenueSource === 'actual' ? (
              <span className="flex items-center gap-1 text-jade-400/80">
                <BadgeCheck className="h-3 w-3" /> Exact — from your payouts
              </span>
            ) : user?.isDemo ? (
              'Estimated from RPM'
            ) : (
              // The commonest complaint is "the revenue is not exact" — and the
              // fix already exists, it just was not visible from here.
              <button
                type="button"
                onClick={() => setPayoutOpen(true)}
                className="text-left text-brass-300/90 underline decoration-dotted underline-offset-4 transition-colors hover:text-brass-200"
              >
                Estimated — log a payout for exact numbers
              </button>
            )
          }
        />
        <Kpi label="Total spent" value={money(m.totalCost)} hint={`${money(m.acquisitionCost)} purchase`} />
        <Kpi
          label="Profit"
          value={money(m.profit, { sign: true })}
          tone={m.profit >= 0 ? 'text-jade-400' : 'text-ember-400'}
          hint={m.roi == null ? undefined : `${percent(m.roi, { sign: true })} ROI`}
        />
        <Kpi
          label="Cashflow · 30d"
          value={money(m.netCashflow30d, { sign: true })}
          tone={m.netCashflow30d >= 0 ? 'text-jade-400' : 'text-ember-400'}
          hint={m.isCashflowing ? 'Paying for itself' : 'Burning cash'}
        />
        <Kpi
          label="Effective RPM"
          value={`$${m.rpm.rpm.toFixed(2)}`}
          hint={m.rpm.source === 'override' ? 'Your override' : `${m.tierLabel.split('—')[0].trim()} estimate`}
        />
        <Kpi label="Per video" value={money(m.revenuePerVideo)} hint={`${money(m.avgCostPerVideo)} to make`} />
      </Panel>

      {/* ------------------------------------------------------ analytics */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
        <Panel className="min-w-0 p-6">
          <SectionTitle>Monthly performance</SectionTitle>
          <ChannelChart data={timeline} />
        </Panel>

        <div className="min-w-0 space-y-5">
          <Panel className="p-6">
            <SectionTitle>Break-even</SectionTitle>
            <p className="tnum text-2xl font-semibold tracking-tight text-white">{Math.round(m.breakevenPct)}%</p>
            <Meter
              className="mt-3"
              value={m.breakevenPct}
              tone={m.breakevenPct >= 100 ? 'emerald' : m.breakevenPct >= 50 ? 'amber' : 'rose'}
            />
            <p className="mt-3 text-[13px] leading-relaxed text-slate-400">
              {m.amountToBreakeven <= 0 ? (
                <>
                  Fully recovered. Everything from here is profit — currently{' '}
                  <span className="font-semibold text-jade-400">{money(m.profit)}</span> ahead.
                </>
              ) : (
                <>
                  <span className="font-semibold text-slate-200">{money(m.amountToBreakeven)}</span> still to recover
                  {m.monthsToBreakeven != null
                    ? ` — about ${m.monthsToBreakeven.toFixed(1)} months at the current pace.`
                    : '. Not earning enough yet to project a date.'}
                </>
              )}
            </p>
            <dl className="mt-5 space-y-2.5 border-t border-white/[0.05] pt-4 text-[13px]">
              {[
                ['Purchase price', money(m.acquisitionCost)],
                ['Video production', money(m.productionCost)],
                ['Running costs', money(m.overheadCost)],
                ['Held for', `${m.monthsHeld.toFixed(1)} months`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="tnum font-medium text-slate-200">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Vault account={account} onEdit={() => setEditOpen(true)} />
        </div>
      </div>

      {/* --------------------------------------------------------- videos */}
      <VideoTable account={account} onChange={setAccount} />

      {/* -------------------------------------------------------- payouts */}
      {account.payouts.length > 0 && (
        <Panel className="p-6">
          <SectionTitle>Logged payouts</SectionTitle>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {account.payouts.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5">
                <span className="text-[13px] text-slate-400">{p.period}</span>
                <span className="tnum text-[13px] font-semibold text-slate-100">{money(p.amount)}</span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {account.notes && (
        <Panel className="p-6">
          <SectionTitle>Notes</SectionTitle>
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-300">{account.notes}</p>
        </Panel>
      )}

      <EditModal account={account} open={editOpen} onClose={() => setEditOpen(false)} onSaved={setAccount} />

      <Modal open={payoutOpen} onClose={() => setPayoutOpen(false)} title="Log a real payout" subtitle="Once you log actual AdSense earnings, they replace the estimate everywhere." width="max-w-md">
        <form onSubmit={savePayout} className="space-y-4">
          <Field label="Month" type="month" value={payout.period} onChange={(e) => setPayout({ ...payout, period: e.target.value })} required />
          <Field label="Amount received" prefix="$" type="number" min="0" step="0.01" value={payout.amount} onChange={(e) => setPayout({ ...payout, amount: e.target.value })} required autoFocus />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setPayoutOpen(false)} className="btn-ghost">Cancel</button>
            <button type="submit" className="btn-primary">Save payout</button>
          </div>
        </form>
      </Modal>
    </motion.div>
  );
}
