import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check, KeyRound, Link2, Loader2, Search, Sparkles, Wand2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useApp } from '@/store/AppStore';
import { Field, Modal, SelectField, TextArea, Toggle } from '@/components/ui';
import { cx, money, number } from '@/lib/format';
import type { ChannelPreview } from '@/lib/types';

/** Rough keyword → niche classifier so the customer rarely has to choose. */
const NICHE_HINTS: [RegExp, string][] = [
  [/invest|stock|money|finance|wealth|dividend|trading|forex/i, 'finance'],
  [/real ?estate|property|landlord|realtor/i, 'real_estate'],
  [/business|startup|entrepreneur|agency|saas|marketing/i, 'business'],
  [/\bai\b|artificial intelligence|automation|prompt|gpt|llm/i, 'ai'],
  [/crypto|bitcoin|ethereum|web3|nft|blockchain/i, 'crypto'],
  [/tech|software|coding|program|developer|gadget|review/i, 'tech'],
  [/insurance|lawyer|legal|attorney/i, 'insurance'],
  [/luxury|watch|rolex|supercar|mansion/i, 'luxury'],
  [/motivat|discipline|mindset|self.?improv|productiv/i, 'self_improve'],
  [/crime|murder|mystery|detective|unsolved/i, 'true_crime'],
  [/car|auto|engine|motor|drive/i, 'automotive'],
  [/fitness|health|workout|gym|diet|nutrition|wellness/i, 'health'],
  [/tutorial|how ?to|course|learn|education|study/i, 'education'],
  [/news|politic|breaking|current/i, 'news'],
  [/travel|destination|nomad|backpack/i, 'travel'],
  [/beauty|makeup|fashion|skincare|style/i, 'beauty'],
  [/science|space|physics|astronom|nasa/i, 'science'],
  [/history|documentar|ancient|war|empire/i, 'history'],
  [/food|cook|recipe|kitchen|chef|baking/i, 'food'],
  [/vlog|lifestyle|daily|day in the life/i, 'lifestyle'],
  [/sport|football|soccer|basketball|nba|nfl/i, 'sports'],
  [/gam(e|ing)|minecraft|fortnite|roblox|speedrun/i, 'gaming'],
  [/pet|dog|cat|animal|wildlife/i, 'pets'],
  [/kids|family|cartoon|nursery/i, 'kids'],
  [/music|song|beat|remix|lofi/i, 'music'],
  [/compilation|satisfying|asmr|relax/i, 'compilation'],
];

function guessNiche(text: string) {
  for (const [re, id] of NICHE_HINTS) if (re.test(text)) return id;
  return 'other';
}

/** Country → the audience tier that actually drives RPM. */
function guessTier(country: string | null) {
  if (!country) return 'mixed';
  if (['US', 'GB', 'CA', 'AU', 'NZ', 'IE'].includes(country)) return 'tier1';
  if (['DE', 'NL', 'SE', 'NO', 'DK', 'CH', 'AT', 'FI', 'BE', 'FR', 'IT', 'ES'].includes(country)) return 'tier2';
  if (['PL', 'RO', 'BR', 'MX', 'AR', 'CO', 'CL', 'TR', 'RU', 'UA'].includes(country)) return 'tier3';
  if (['IN', 'PK', 'BD', 'ID', 'PH', 'VN', 'NG', 'EG', 'KE', 'ZA'].includes(country)) return 'tier4';
  return 'mixed';
}

const EMPTY_CREDS = { username: '', email: '', password: '', twoFactor: '', recoveryEmail: '' };

export function AddChannelModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { niches, audienceTiers, syncAvailable, refresh, toast, user } = useApp();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [looking, setLooking] = useState(false);
  const [preview, setPreview] = useState<ChannelPreview | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    nickname: '',
    niche: 'other',
    audienceTier: 'tier1',
    status: 'active',
    channelUrl: '',
    acquisitionCost: '',
    monthlyCost: '',
    costPerVideo: '',
    monetized: true,
    notes: '',
  });
  const [creds, setCreds] = useState(EMPTY_CREDS);
  const [showCreds, setShowCreds] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setPreview(null);
    setLookupError(null);
    setShowCreds(false);
    setCreds(EMPTY_CREDS);
    setForm({
      nickname: '', niche: 'other', audienceTier: 'tier1', status: 'active', channelUrl: '',
      acquisitionCost: '', monthlyCost: '', costPerVideo: '', monetized: true, notes: '',
    });
  }, [open]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const runLookup = async () => {
    if (!query.trim()) return;
    setLooking(true);
    setLookupError(null);
    try {
      const { channel } = await api.lookupChannel(query.trim());
      setPreview(channel);
      setForm((f) => ({
        ...f,
        nickname: f.nickname || channel.title,
        channelUrl: channel.url,
        niche: guessNiche(`${channel.title} ${channel.description}`),
        audienceTier: guessTier(channel.country),
      }));
    } catch (err) {
      setLookupError((err as Error).message);
      setPreview(null);
    } finally {
      setLooking(false);
    }
  };

  const selectedNiche = useMemo(() => niches.find((n) => n.id === form.niche), [niches, form.niche]);
  const selectedTier = useMemo(() => audienceTiers.find((t) => t.id === form.audienceTier), [audienceTiers, form.audienceTier]);
  const estRpm = selectedNiche && selectedTier ? selectedNiche.rpm * selectedTier.multiplier : 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nickname.trim()) {
      toast({ title: 'Give the channel a name first', tone: 'error' });
      return;
    }
    setSaving(true);
    try {
      const { account } = await api.createAccount({
        nickname: form.nickname.trim(),
        niche: form.niche,
        audienceTier: form.audienceTier,
        status: form.status,
        channelUrl: form.channelUrl || null,
        channelId: preview?.channelId ?? null,
        handle: preview?.handle ?? null,
        thumbnail: preview?.thumbnail ?? null,
        accountCreatedAt: preview?.publishedAt ?? null,
        subscribers: preview?.subscribers ?? 0,
        totalViews: preview?.totalViews ?? 0,
        videoCount: preview?.videoCount ?? 0,
        acquisitionCost: Number(form.acquisitionCost) || 0,
        monthlyCost: Number(form.monthlyCost) || 0,
        monetized: form.monetized,
        notes: form.notes || null,
        credentials: creds,
      });

      // "Every video cost me $X" — one number instead of dozens of rows.
      const perVideo = Number(form.costPerVideo);
      if (perVideo > 0) await api.bulkCost(account.id, perVideo, true).catch(() => {});

      await refresh();
      toast({
        title: `${account.nickname} added`,
        detail: syncAvailable && form.channelUrl ? 'Live stats pulled from YouTube.' : 'Add uploads to start tracking profit.',
        tone: 'success',
      });
      onClose();
      navigate(`/channels/${account.id}`);
    } catch (err) {
      toast({ title: 'Could not save channel', detail: (err as Error).message, tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a channel"
      subtitle="Paste the YouTube URL — we pull the stats, guess the niche and estimate the RPM for you."
      width="max-w-3xl"
    >
      {user?.isDemo && (
        <div className="mb-5 rounded-xl border border-brass-400/25 bg-brass-400/[0.07] px-4 py-3 text-[13px] text-brass-100">
          You're in the demo workspace. Create a free account to save channels of your own.
        </div>
      )}

      <form onSubmit={submit} className="space-y-6">
        {/* ---------------------------------------------------- auto-fill */}
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
          <div className="mb-3 flex items-center gap-2">
            <Wand2 className="h-3.5 w-3.5 text-brass-400" />
            <span className="label !text-brass-400/90">Automatic setup</span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Link2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void runLookup();
                  }
                }}
                placeholder="youtube.com/@channel, a channel URL or @handle"
                className="field pl-10"
              />
            </div>
            <button type="button" onClick={runLookup} disabled={looking || !query.trim()} className="btn-ghost shrink-0">
              {looking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {looking ? 'Looking up…' : 'Fetch'}
            </button>
          </div>

          {!syncAvailable && (
            <p className="mt-2.5 text-xs text-slate-500">
              Live lookup is off on this server. You can still add the channel manually below.
            </p>
          )}
          {lookupError && <p className="mt-2.5 text-xs text-ember-400">{lookupError}</p>}

          {preview && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 flex items-center gap-4 rounded-xl border border-jade-500/20 bg-jade-500/[0.06] p-3.5"
            >
              {preview.thumbnail ? (
                <img src={preview.thumbnail} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
              ) : (
                <div className="h-12 w-12 shrink-0 rounded-full bg-white/10" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{preview.title}</p>
                <p className="tnum mt-0.5 truncate text-xs text-slate-400">
                  {number(preview.subscribers)} subscribers · {number(preview.videoCount, false)} videos · {number(preview.totalViews)} views
                  {preview.publishedAt && ` · since ${new Date(preview.publishedAt).getFullYear()}`}
                </p>
              </div>
              <Check className="h-4 w-4 shrink-0 text-jade-400" />
            </motion.div>
          )}
        </div>

        {/* ------------------------------------------------------ identity */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Channel name"
            value={form.nickname}
            onChange={(e) => set('nickname', e.target.value)}
            placeholder="e.g. Wealth Vault"
            required
          />
          <SelectField label="Status" value={form.status} onChange={(e) => set('status', e.target.value)}>
            <option value="active">Active</option>
            <option value="warming">Warming up</option>
            <option value="paused">Paused</option>
            <option value="sold">Sold</option>
            <option value="banned">Terminated</option>
          </SelectField>

          <SelectField
            label="Niche"
            value={form.niche}
            onChange={(e) => set('niche', e.target.value)}
            hint={selectedNiche ? `Base RPM ≈ $${selectedNiche.rpm.toFixed(2)} per 1,000 views` : undefined}
          >
            {niches.map((n) => (
              <option key={n.id} value={n.id}>
                {n.label}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Main audience"
            value={form.audienceTier}
            onChange={(e) => set('audienceTier', e.target.value)}
            hint={`Effective RPM ≈ $${estRpm.toFixed(2)}`}
          >
            {audienceTiers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </SelectField>
        </div>

        {/* ----------------------------------------------------- economics */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label="What you paid for it"
            prefix="$"
            type="number"
            min="0"
            step="1"
            value={form.acquisitionCost}
            onChange={(e) => set('acquisitionCost', e.target.value)}
            placeholder="0"
          />
          <Field
            label="Monthly running cost"
            prefix="$"
            type="number"
            min="0"
            step="1"
            value={form.monthlyCost}
            onChange={(e) => set('monthlyCost', e.target.value)}
            placeholder="0"
            hint="Editors, tools, VAs"
          />
          <Field
            label="Cost per video"
            prefix="$"
            type="number"
            min="0"
            step="1"
            value={form.costPerVideo}
            onChange={(e) => set('costPerVideo', e.target.value)}
            placeholder="0"
            hint="Applied to every upload"
          />
        </div>

        <Toggle
          checked={form.monetized}
          onChange={(v) => set('monetized', v)}
          label="Monetised"
          hint="Turn off until the channel is accepted into the Partner Programme — revenue then shows as potential, not earned."
        />

        {/* --------------------------------------------------- credentials */}
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02]">
          <button
            type="button"
            onClick={() => setShowCreds((v) => !v)}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
          >
            <KeyRound className="h-4 w-4 shrink-0 text-brass-400" />
            <span className="flex-1">
              <span className="block text-sm font-medium text-slate-200">Account credentials</span>
              <span className="block text-xs text-slate-500">Encrypted with AES-256 before it touches the database</span>
            </span>
            <span className={cx('text-slate-500 transition-transform', showCreds && 'rotate-90')}>
              <ArrowRight className="h-4 w-4" />
            </span>
          </button>

          {showCreds && (
            <div className="grid gap-4 border-t border-white/[0.06] p-4 sm:grid-cols-2">
              <Field label="Username" value={creds.username} onChange={(e) => setCreds({ ...creds, username: e.target.value })} autoComplete="off" />
              <Field label="Email" value={creds.email} onChange={(e) => setCreds({ ...creds, email: e.target.value })} autoComplete="off" />
              <Field label="Password" value={creds.password} onChange={(e) => setCreds({ ...creds, password: e.target.value })} autoComplete="new-password" />
              <Field label="Recovery email" value={creds.recoveryEmail} onChange={(e) => setCreds({ ...creds, recoveryEmail: e.target.value })} autoComplete="off" />
              <div className="sm:col-span-2">
                <Field
                  label="2FA / secret code"
                  value={creds.twoFactor}
                  onChange={(e) => setCreds({ ...creds, twoFactor: e.target.value })}
                  placeholder="Backup code or authenticator seed"
                  autoComplete="off"
                />
              </div>
            </div>
          )}
        </div>

        <TextArea label="Notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Upload cadence, editor, anything you'd forget in three months…" />

        <div className="flex items-center justify-between gap-3 border-t border-white/[0.07] pt-5">
          <p className="flex items-center gap-1.5 text-xs text-slate-500">
            <Sparkles className="h-3 w-3 text-brass-400" />
            Earnings estimated at ${estRpm.toFixed(2)} RPM until you log a real payout.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn-ghost">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {saving ? 'Saving…' : 'Add channel'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
