/**
 * Portable data layer.
 *
 *   DATABASE_URL set  -> PostgreSQL (Render / Supabase / Neon)
 *   DATABASE_URL unset-> local SQLite file via node:sqlite (zero install, dev only)
 *
 * Everything above this layer writes plain SQL with `?` placeholders.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

const url = process.env.DATABASE_URL;
export const driver = url ? 'postgres' : 'sqlite';

let pgPool = null;
let sqlite = null;

/** `SELECT ? , ?` -> `SELECT $1, $2` for postgres. */
function toPg(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

/** SQLite only accepts null | number | bigint | string | Uint8Array. */
function normalize(params) {
  return params.map((p) => {
    if (p === undefined || p === null) return null;
    if (typeof p === 'boolean') return p ? 1 : 0;
    if (p instanceof Date) return p.toISOString();
    if (typeof p === 'object') return JSON.stringify(p);
    return p;
  });
}

export async function initDb() {
  if (driver === 'postgres') {
    const { default: pg } = await import('pg');
    pgPool = new pg.Pool({
      connectionString: url,
      ssl: url.includes('localhost') ? false : { rejectUnauthorized: false },
      max: 8,
    });
    // Postgres is happy with the portable schema as-is.
    await pgPool.query(SCHEMA);
  } else {
    const { DatabaseSync } = await import('node:sqlite');
    const dir = path.join(__dirname, '..', '.data');
    fs.mkdirSync(dir, { recursive: true });
    sqlite = new DatabaseSync(path.join(dir, 'agedaccounts.db'));
    sqlite.exec('PRAGMA journal_mode = WAL;');
    sqlite.exec(SCHEMA);
  }
  return driver;
}

/** Returns an array of row objects. */
export async function all(sql, params = []) {
  const p = normalize(params);
  if (driver === 'postgres') {
    const res = await pgPool.query(toPg(sql), p);
    return res.rows;
  }
  return sqlite.prepare(sql).all(...p);
}

/** Returns the first row or null. */
export async function one(sql, params = []) {
  const rows = await all(sql, params);
  return rows.length ? rows[0] : null;
}

/** INSERT / UPDATE / DELETE. */
export async function run(sql, params = []) {
  const p = normalize(params);
  if (driver === 'postgres') {
    const res = await pgPool.query(toPg(sql), p);
    return { changes: res.rowCount };
  }
  const res = sqlite.prepare(sql).run(...p);
  return { changes: Number(res.changes ?? 0) };
}

export async function closeDb() {
  if (pgPool) await pgPool.end();
  if (sqlite) sqlite.close();
}
