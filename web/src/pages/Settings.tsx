import React, { useState } from 'react';
import { Download, Loader2, LogOut, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { api } from '@/lib/api';
import { useApp } from '@/store/AppStore';
import { Field, Panel, SectionTitle } from '@/components/ui';
import { money, number, shortDate } from '@/lib/format';

export function Settings() {
  const { user, setUser, accounts, summary, syncAvailable, toast, logout, niches } = useApp();
  const [name, setName] = useState(user?.name ?? '');
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { user: updated } = await api.updateMe({ name });
      setUser(updated);
      toast({ title: 'Profile updated', tone: 'success' });
    } catch (err) {
      toast({ title: 'Could not save', detail: (err as Error).message, tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Settings</h1>
        <p className="mt-1.5 text-sm text-slate-500">Your workspace, data and integrations.</p>
      </div>

      <Panel className="p-6">
        <SectionTitle>Profile</SectionTitle>
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          <Field label="Email" value={user?.email ?? ''} disabled />
          <div className="sm:col-span-2 flex items-center justify-between gap-4 pt-1">
            <p className="text-xs text-slate-500">Member since {shortDate(user?.createdAt)}</p>
            <button type="submit" disabled={saving || !!user?.isDemo} className="btn-primary">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </button>
          </div>
        </form>
      </Panel>

      <Panel className="p-6">
        <SectionTitle>Your data</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ['Channels', number(accounts.length, false)],
            ['Videos tracked', number(summary?.videos ?? 0, false)],
            ['Lifetime revenue', money(summary?.revenue ?? 0, { compact: true })],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3.5">
              <p className="label">{label}</p>
              <p className="tnum mt-1.5 text-lg font-semibold text-white">{value}</p>
            </div>
          ))}
        </div>
        <button
          onClick={() => api.downloadCsv().catch(() => toast({ title: 'Export failed', tone: 'error' }))}
          className="btn-ghost mt-4"
        >
          <Download className="h-4 w-4" /> Export everything to CSV
        </button>
      </Panel>

      <Panel className="p-6">
        <SectionTitle>Automation</SectionTitle>
        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <Zap className={syncAvailable ? 'mt-0.5 h-4 w-4 shrink-0 text-jade-400' : 'mt-0.5 h-4 w-4 shrink-0 text-slate-600'} />
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-200">YouTube auto-sync</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                {syncAvailable
                  ? 'Connected. Views, subscribers and new uploads are pulled straight from YouTube whenever you press Sync.'
                  : 'Not configured on this server. Add a YOUTUBE_API_KEY environment variable to enable one-click syncing.'}
              </p>
            </div>
            <span className={syncAvailable ? 'chip border-jade-500/25 bg-jade-500/10 text-jade-300' : 'chip border-white/10 bg-white/[0.04] text-slate-400'}>
              {syncAvailable ? 'Active' : 'Off'}
            </span>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brass-400" />
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-200">RPM estimation</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Earnings are modelled from {niches.length} niche benchmarks scaled by your audience region — until you log a real
                payout, which always wins.
              </p>
            </div>
          </div>

        </div>
      </Panel>


      <Panel className="p-6">
        <SectionTitle>Session</SectionTitle>
        <button onClick={logout} className="btn-ghost text-ember-300 hover:border-ember-500/30 hover:bg-ember-500/10">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </Panel>
    </div>
  );
}
