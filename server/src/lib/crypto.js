/**
 * Envelope encryption for channel credentials.
 *
 * Every secret field (password, 2FA seed, recovery email …) is sealed with
 * AES-256-GCM under a key derived from ENCRYPTION_KEY via scrypt. Stored as
 * `v1:<iv>:<tag>:<ciphertext>` (all base64url). Nothing sensitive ever lands
 * in the database in plaintext, and a stolen DB dump is inert without the key.
 */
import crypto from 'node:crypto';

const SALT = 'chai-aged-accounts-os/v1';
let cachedKey = null;

function key() {
  if (cachedKey) return cachedKey;
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret || secret.length < 16) {
    throw new Error(
      'ENCRYPTION_KEY is missing or too short. Set a random 32+ character value.'
    );
  }
  cachedKey = crypto.scryptSync(secret, SALT, 32);
  return cachedKey;
}

const b64 = (buf) => Buffer.from(buf).toString('base64url');
const unb64 = (str) => Buffer.from(str, 'base64url');

export function encrypt(plain) {
  if (plain === null || plain === undefined || plain === '') return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return `v1:${b64(iv)}:${b64(cipher.getAuthTag())}:${b64(ct)}`;
}

export function decrypt(blob) {
  if (!blob) return '';
  const parts = String(blob).split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') return '';
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), unb64(parts[1]));
    decipher.setAuthTag(unb64(parts[2]));
    return Buffer.concat([decipher.update(unb64(parts[3])), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

/**
 * Blobs the browser sealed before sending. The server can strip its own layer
 * but what is underneath stays unreadable here — that is the whole point.
 */
export const isClientSealed = (value) => typeof value === 'string' && value.startsWith('v2:');

/** Never send raw secrets in list views — only a shape hint. */
export function maskHint(blob) {
  const value = decrypt(blob);
  if (!value) return null;
  // A client-sealed value has no shape worth hinting at, and pretending
  // otherwise would leak the ciphertext's length.
  if (isClientSealed(value)) return '••••••••';
  if (value.includes('@')) {
    const [user, domain] = value.split('@');
    return `${user.slice(0, 2)}${'•'.repeat(Math.max(user.length - 2, 3))}@${domain}`;
  }
  return '•'.repeat(Math.min(Math.max(value.length, 6), 14));
}

export const newId = () => crypto.randomUUID();
