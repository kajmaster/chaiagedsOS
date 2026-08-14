import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check, KeyRound, Link2, Loader2, Search, Sparkles, Wand2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useApp } from '@/store/AppStore';
import { Field, Modal, SelectField, TextArea, Toggle } from '@/components/ui';
import { cx, money, number } from '@/lib/format';
import { sealCredentials, vaultSession } from '@/lib/vault';
import { VaultUnlockModal } from '@/components/VaultGate';
import type { ChannelEstimate, ChannelPreview } from '@/lib/types';

/*
 * Niche and audience detection deliberately live on the server (lib/classify.js)
 * so the estimate a visitor sees here and the numbers they get after signing up
 * can never disagree.
 */

const EMPTY_CREDS = { username: '', email: '', password: '', twoFactor: '', recoveryEmail: '' };

export function AddChannelModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { niches, audienceTiers, syncAvailable, refresh, toast, user, logout } = useApp();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [looking, setLooking] = useState(false);
  const [preview, setPreview] = useState<ChannelPreview | null>(null);
  const [estimate, setEstimate] = useState<ChannelEstimate | null>(null);
  const [nicheUncertain, setNicheUncertain] = useState(false);
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
  const [needsUnlock, setNeedsUnlock] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setPreview(null);
    setEstimate(null);
    setNicheUncertain(false);
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
      const { channel, suggestion, estimate } = await api.lookupChannel(query.trim());
      setPreview(channel);
      setEstimate(estimate);
      setNicheUncertain(!suggestion.confident);
      setForm((f) => ({
        ...f,
        nickname: f.nickname || channel.title,
        channelUrl: channel.url,
        niche: suggestion.niche,
        audienceTier: suggestion.audienceTier,
      }));
    } catch (err) {
      setLookupError((err as Error).message);
      setPreview(null);
      setEstimate(null);
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
      // With the vault on, credentials are encrypted here and the server only
      // ever receives ciphertext.
      const anyCredentials = Object.values(creds).some(Boolean);
      let payloadCreds: Record<string, unknown> = creds;
      if (user?.vault.enabled && anyCredentials) {
        const key = vaultSession.get();
        if (!key) {
          setSaving(false);
          setNeedsUnlock(true);
          return;
        }
        payloadCreds = await sealCredentials(key, creds);
      }

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
        credentials: payloadCreds,
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
        <div className="mb-5 rounded-xl border border-brass-400/25 bg-brass-400/[0.07] px-4 py-3 text-[13px] leading-relaxed text-brass-100">
          <strong className="font-semibold">Try it with your own channel.</strong> Paste a real YouTube URL below and we'll show
          you what it's earning. Saving it needs a free account.
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

          {/* The moment that sells the product: paste a URL, see what it earns. */}
          {estimate && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="mt-3 rounded-xl border border-white/[0.08] bg-ink-850/60 p-4"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="label !text-brass-400/90">Estimated earnings</span>
                <span className="chip border-white/10 bg-white/[0.04] text-slate-400">
                  {estimate.nicheLabel} · ${estimate.rpm.toFixed(2)} RPM
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-[11px] text-slate-500">Per video</p>
                  <p className="tnum mt-1 text-lg font-semibold text-white">{money(estimate.perVideo.mid)}</p>
                  <p className="tnum mt-0.5 text-[11px] text-slate-500">
                    {money(estimate.perVideo.low)}–{money(estimate.perVideo.high)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500">Lifetime so far</p>
                  <p className="tnum mt-1 text-lg font-semibold text-white">{money(estimate.lifetime.mid, { compact: true })}</p>
                  <p className="tnum mt-0.5 text-[11px] text-slate-500">
                    {money(estimate.lifetime.low, { compact: true })}–{money(estimate.lifetime.high, { compact: true })}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500">Average views</p>
                  <p className="tnum mt-1 text-lg font-semibold text-white">{number(estimate.avgViewsPerVideo)}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">per video</p>
                </div>
              </div>

              <p className="mt-3 border-t border-white/[0.06] pt-3 text-[11px] leading-relaxed text-slate-500">
                Modelled from public view counts, assuming {Math.round(estimate.assumptions.monetisedShare * 100)}% of views are
                monetised. Log a real payout and your actual numbers replace this everywhere.
              </p>
            </motion.div>
          )}

          {nicheUncertain && preview && (
            <p className="mt-3 flex items-start gap-2 rounded-xl border border-brass-400/25 bg-brass-400/[0.07] px-3.5 py-2.5 text-[12px] leading-relaxed text-brass-100">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              We couldn't confidently tell what this channel is about, and the niche drives every revenue figure — pick the right
              one below.
            </p>
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
              <span className="block text-xs text-slate-500">
                {user?.vault.enabled
                  ? 'Encrypted in your browser — unreadable to this service'
                  : 'Encrypted with AES-256 before it touches the database'}
              </span>
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

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] pt-5">
          <p className="flex items-center gap-1.5 text-xs text-slate-500">
            <Sparkles className="h-3 w-3 text-brass-400" />
            Earnings estimated at ${estRpm.toFixed(2)} RPM until you log a real payout.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn-ghost">
              {user?.isDemo ? 'Close' : 'Cancel'}
            </button>
            {user?.isDemo ? (
              // Demo visitors can look a channel up but not save it — so the
              // button that would save becomes the signup instead.
              <button type="button" onClick={logout} className="btn-primary">
                <ArrowRight className="h-4 w-4" />
                Create a free account to track it
              </button>
            ) : (
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {saving ? 'Saving…' : 'Add channel'}
              </button>
            )}
          </div>
        </div>
      </form>
      <VaultUnlockModal open={needsUnlock} onClose={() => setNeedsUnlock(false)} onUnlocked={() => setNeedsUnlock(false)} />
    </Modal>
  );
}
