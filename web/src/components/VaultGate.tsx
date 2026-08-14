import React, { useState } from 'react';
import { Eye, Loader2, Lock, ShieldCheck, TriangleAlert } from 'lucide-react';
import { api } from '@/lib/api';
import { useApp } from '@/store/AppStore';
import { Field, Modal } from '@/components/ui';
import { checkVerifier, deriveKey, buildVerifier, passphraseProblem, randomSalt, vaultSession } from '@/lib/vault';

/**
 * Two related dialogs:
 *   - Set up the vault (choose a passphrase, generate a salt, prove it works)
 *   - Unlock it for this session
 *
 * Both keep the passphrase in the browser. The server receives a salt and a
 * verifier blob and nothing else.
 */

export function VaultSetupModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { setUser, toast } = useApp();
  const [pass, setPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const problem = passphraseProblem(pass);
    if (problem) return setError(problem);
    if (pass !== confirm) return setError('The two passphrases do not match.');
    if (!ack) return setError('Please confirm you understand it cannot be recovered.');

    setBusy(true);
    try {
      const salt = randomSalt();
      const key = await deriveKey(pass, salt);
      const verifier = await buildVerifier(key);
      const { user } = await api.setupVault({ salt, verifier: verifier! });
      vaultSession.set(key);
      setUser(user);
      toast({ title: 'Private vault enabled', detail: 'New credentials are now encrypted on your device.', tone: 'success' });
      onClose();
      setPass('');
      setConfirm('');
      setAck(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Turn on your private vault"
      subtitle="Your logins get encrypted in this browser before they are sent. Nobody running this service can read them — including us."
      width="max-w-lg"
    >
      <form onSubmit={submit} className="space-y-5">
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
          <p className="flex items-start gap-2.5 text-[13px] leading-relaxed text-slate-300">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-jade-400" />
            <span>
              This passphrase never leaves your device. We store only a random salt and a short proof that it is correct — neither
              can be used to unlock anything.
            </span>
          </p>
        </div>

        <Field
          label="Vault passphrase"
          type="password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          placeholder="At least 12 characters"
          autoComplete="new-password"
          autoFocus
        />
        <Field
          label="Confirm passphrase"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          error={error}
        />

        <button
          type="button"
          onClick={() => setAck((v) => !v)}
          className="flex w-full items-start gap-3 rounded-xl border border-brass-400/25 bg-brass-400/[0.06] p-3.5 text-left"
        >
          <span
            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
              ack ? 'border-brass-400 bg-brass-400 text-ink-950' : 'border-brass-400/50'
            }`}
          >
            {ack && <span className="text-[10px] font-bold">✓</span>}
          </span>
          <span className="text-[13px] leading-relaxed text-brass-100">
            <TriangleAlert className="mr-1.5 inline h-3.5 w-3.5" />
            I understand this cannot be reset. If I forget it, the saved logins are gone permanently — a recovery option would mean
            someone else could get in too.
          </span>
        </button>

        <div className="flex justify-end gap-2 border-t border-white/[0.07] pt-5">
          <button type="button" onClick={onClose} className="btn-ghost">
            Not now
          </button>
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            Enable vault
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function VaultUnlockModal({
  open,
  onClose,
  onUnlocked,
}: {
  open: boolean;
  onClose: () => void;
  onUnlocked: () => void;
}) {
  const { user } = useApp();
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const key = await deriveKey(pass, user!.vault.salt!);
      if (!(await checkVerifier(key, user!.vault.verifier))) {
        setError('That passphrase is not right.');
        return;
      }
      vaultSession.set(key);
      setPass('');
      onUnlocked();
      onClose();
    } catch {
      setError('Could not unlock the vault.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Unlock your vault" subtitle="Needed once per session to read or save credentials." width="max-w-md">
      <form onSubmit={submit} className="space-y-4">
        <Field
          label="Vault passphrase"
          type="password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          autoComplete="current-password"
          autoFocus
          error={error}
        />
        <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-500">
          <Eye className="mt-0.5 h-3 w-3 shrink-0" />
          Decryption happens here in your browser. The passphrase is never sent anywhere.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button type="submit" disabled={busy || !pass} className="btn-primary">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            Unlock
          </button>
        </div>
      </form>
    </Modal>
  );
}
