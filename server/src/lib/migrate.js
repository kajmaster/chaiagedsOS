/**
 * One-time data moves that cannot be expressed as a schema change.
 */
import { all, run } from '../db.js';
import { decrypt, decryptLoose, encrypt } from './crypto.js';

const LABELS = [
  ['cred_username', 'Username'],
  ['cred_email', 'Email'],
  ['cred_password', 'Password'],
  ['cred_2fa', '2FA / secret'],
  ['cred_recovery', 'Recovery email'],
];

/**
 * The five structured credential fields were replaced by one free-text note.
 * Fold anything already stored into that note rather than stranding it in
 * columns nothing reads any more, then clear the originals so the data lives in
 * exactly one place.
 */
export async function foldCredentialsIntoNotes() {
  const rows = await all(
    `SELECT id, notes, cred_username, cred_email, cred_password, cred_2fa, cred_recovery
       FROM accounts
      WHERE cred_username IS NOT NULL OR cred_email IS NOT NULL OR cred_password IS NOT NULL
         OR cred_2fa IS NOT NULL OR cred_recovery IS NOT NULL`
  );

  let moved = 0;
  for (const row of rows) {
    const lines = [];
    for (const [column, label] of LABELS) {
      const value = decrypt(row[column]);
      if (value) lines.push(`${label}: ${value}`);
    }
    if (!lines.length) continue;

    const existing = decryptLoose(row.notes).trim();
    const merged = existing ? `${lines.join('\n')}\n\n${existing}` : lines.join('\n');

    await run(
      `UPDATE accounts SET notes = ?, cred_username = NULL, cred_email = NULL,
        cred_password = NULL, cred_2fa = NULL, cred_recovery = NULL WHERE id = ?`,
      [encrypt(merged), row.id]
    );
    moved++;
  }

  if (moved) console.log(`  folded credentials into notes for ${moved} channel(s)`);
  return moved;
}
