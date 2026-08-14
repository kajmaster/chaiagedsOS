/**
 * Zero-knowledge credential vault.
 *
 * The objection that kills this product is "you're just a guy on the internet —
 * why would I give you my channel passwords?" It is a fair objection, and no
 * promise fixes it. The only real answer is to make it impossible: credentials
 * are encrypted in the browser with a key derived from a passphrase that never
 * leaves the device, so the server stores ciphertext it cannot read.
 *
 * That is a genuine guarantee rather than a policy — it holds even if the
 * database is stolen, the server is subpoenaed, or the operator is dishonest.
 *
 * The trade-off is real and must be stated plainly in the UI: forget the
 * passphrase and the credentials are gone. There is no reset, because a reset
 * would mean we could read them.
 */

const ITERATIONS = 310_000; // OWASP 2023 guidance for PBKDF2-HMAC-SHA256
const VERIFIER_PLAINTEXT = 'chai-vault-v2';

const enc = new TextEncoder();
const dec = new TextDecoder();

const b64 = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf as ArrayBuffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const unb64 = (s: string) => {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

export const randomSalt = () => b64(crypto.getRandomValues(new Uint8Array(16)));

export async function deriveKey(passphrase: string, saltB64: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: unb64(saltB64), iterations: ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/** Client-side blobs are tagged `v2:` so the server can tell them from legacy rows. */
export async function encryptField(key: CryptoKey, plaintext: string): Promise<string | null> {
  if (!plaintext) return null;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext));
  return `v2:${b64(iv)}:${b64(ct)}`;
}

export async function decryptField(key: CryptoKey, blob: string | null): Promise<string> {
  if (!blob) return '';
  if (!isClientEncrypted(blob)) return blob; // legacy server-side record
  const [, ivB64, ctB64] = blob.split(':');
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(ivB64) }, key, unb64(ctB64));
    return dec.decode(pt);
  } catch {
    throw new VaultError('That passphrase does not unlock this vault.');
  }
}

export const isClientEncrypted = (blob: string | null | undefined) => typeof blob === 'string' && blob.startsWith('v2:');

export class VaultError extends Error {}

/** Proves a passphrase is correct without the server ever learning it. */
export async function buildVerifier(key: CryptoKey) {
  return encryptField(key, VERIFIER_PLAINTEXT);
}

export async function checkVerifier(key: CryptoKey, verifier: string | null) {
  if (!verifier) return false;
  try {
    return (await decryptField(key, verifier)) === VERIFIER_PLAINTEXT;
  } catch {
    return false;
  }
}

/**
 * The unlocked key lives in memory only — never localStorage, which would
 * defeat the point by leaving it readable to any script on the page.
 */
let unlockedKey: CryptoKey | null = null;

export const vaultSession = {
  set: (key: CryptoKey) => {
    unlockedKey = key;
  },
  get: () => unlockedKey,
  clear: () => {
    unlockedKey = null;
  },
  isUnlocked: () => unlockedKey !== null,
};

type CredentialFields = Partial<Record<'username' | 'email' | 'password' | 'twoFactor' | 'recoveryEmail', string | null>>;

/** Encrypt every supplied credential field before it leaves the browser. */
export async function sealCredentials(key: CryptoKey, creds: CredentialFields) {
  const out: Record<string, string | null> = {};
  for (const [field, value] of Object.entries(creds)) {
    if (value === undefined) continue;
    out[field] = value ? await encryptField(key, value) : null;
  }
  return out;
}

/**
 * Decrypt a credential set for display. Legacy plaintext passes through.
 * Returns the same keys it was given, so callers keep their own field types.
 */
export async function openCredentials<T extends CredentialFields>(key: CryptoKey | null, creds: T): Promise<Record<keyof T, string>> {
  const out = {} as Record<keyof T, string>;
  for (const [field, value] of Object.entries(creds) as [keyof T, string | null][]) {
    if (!value) {
      out[field] = '';
    } else if (isClientEncrypted(value)) {
      if (!key) throw new VaultError('Vault is locked.');
      out[field] = await decryptField(key, value);
    } else {
      out[field] = value;
    }
  }
  return out;
}

/** Does this credential set need the vault key to read? */
export const needsVaultKey = (creds: CredentialFields) => Object.values(creds).some((v) => isClientEncrypted(v ?? null));

/** Rough strength gate — weak passphrases undermine the whole guarantee. */
export function passphraseProblem(pass: string): string | null {
  if (pass.length < 12) return 'Use at least 12 characters — this is the only thing protecting your logins.';
  if (/^[a-z]+$/i.test(pass)) return 'Add a number or symbol.';
  if (/^(.)\1+$/.test(pass)) return 'That is too predictable.';
  return null;
}
