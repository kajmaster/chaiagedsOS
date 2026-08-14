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

/**
 * Render hands services an *internal* connection string whose host has no dots
 * (`dpg-xxxx-a`). That private network is already encrypted and does not offer
 * TLS, so requesting SSL there fails. External hosts do need it.
 */
function sslFor(connectionString) {
  try {
    const host = new URL(connectionString).hostname;
    if (host === 'localhost' || host === '127.0.0.1' || !host.includes('.')) return false;
  } catch {
    /* unparseable — fall through to the safe default */
  }
  return { rejectUnauthorized: false };
}

/**
 * Columns that hold counts and must be 64-bit. `CREATE TABLE IF NOT EXISTS`
 * never alters an existing table, so a database created before these were
 * widened keeps 32-bit columns and rejects any channel past ~2.1bn views.
 */
const WIDEN_TO_BIGINT = {
  accounts: ['subscribers', 'total_views', 'video_count'],
  videos: ['views', 'likes', 'comments'],
  snapshots: ['subscribers', 'total_views'],
};

async function widenCountColumns(pool) {
  const wanted = Object.entries(WIDEN_TO_BIGINT).flatMap(([table, cols]) => cols.map((c) => ({ table, column: c })));

  const { rows } = await pool.query(
    `SELECT table_name, column_name
       FROM information_schema.columns
      WHERE table_schema = current_schema() AND data_type = 'integer'`
  );

  const narrow = new Set(rows.map((r) => `${r.table_name}.${r.column_name}`));
  const todo = wanted.filter((w) => narrow.has(`${w.table}.${w.column}`));

  for (const { table, column } of todo) {
    await pool.query(`ALTER TABLE ${table} ALTER COLUMN ${column} TYPE BIGINT`);
    console.log(`  migrated ${table}.${column} -> BIGINT`);
  }
  return todo.length;
}

/**
 * Columns added after the first release. `CREATE TABLE IF NOT EXISTS` ignores
 * them on an existing database, so they are added explicitly on boot.
 */
const ADD_COLUMNS = {
  users: [
    ['vault_salt', 'TEXT'],
    ['vault_verifier', 'TEXT'],
  ],
  accounts: [
    ["cost_model", "TEXT NOT NULL DEFAULT 'flat'"],
    ['cost_per_minute', 'REAL NOT NULL DEFAULT 0'],
    // Google refresh token for exact-revenue sync. Encrypted with the server
    // key, and necessarily server-readable: the whole point is that the server
    // can fetch earnings on a schedule without the customer being present.
    ['yt_refresh_token', 'TEXT'],
    ['yt_connected_at', 'TEXT'],
    ['yt_connected_channel', 'TEXT'],
    ['yt_revenue_synced_at', 'TEXT'],
    ['yt_revenue_error', 'TEXT'],
  ],
  videos: [['duration_seconds', 'BIGINT NOT NULL DEFAULT 0']],
};

async function existingColumns(table) {
  if (driver === 'postgres') {
    const rows = await all(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = ?`,
      [table]
    );
    return new Set(rows.map((r) => r.column_name));
  }
  const rows = await all(`PRAGMA table_info(${table})`);
  return new Set(rows.map((r) => r.name));
}

async function addMissingColumns() {
  for (const [table, columns] of Object.entries(ADD_COLUMNS)) {
    const present = await existingColumns(table);
    for (const [column, type] of columns) {
      if (present.has(column)) continue;
      await run(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
      console.log(`  added ${table}.${column}`);
    }
  }
}

export async function initDb({ retries = 5 } = {}) {
  if (driver === 'postgres') {
    const { default: pg } = await import('pg');

    // pg returns BIGINT as a string to avoid precision loss. View counts are
    // nowhere near 2^53, so parse them as numbers and keep the arithmetic sane.
    pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));

    pgPool = new pg.Pool({ connectionString: url, ssl: sslFor(url), max: 8 });

    // A freshly provisioned database can refuse connections for a few seconds.
    // Crashing here would fail the whole deploy, so back off and retry first.
    for (let attempt = 1; ; attempt++) {
      try {
        await pgPool.query(SCHEMA);
        await widenCountColumns(pgPool);
        break;
      } catch (err) {
        if (attempt > retries) {
          if (err.code === 'ENOTFOUND') {
            console.error(
              `\n  FATAL: cannot resolve the database host "${err.hostname ?? ''}".\n` +
                '  On Render this almost always means the database and the web service\n' +
                '  are in different regions. They must match — see render.yaml.\n'
            );
          }
          throw err;
        }
        const wait = Math.min(1000 * 2 ** (attempt - 1), 8000);
        console.warn(`  database not ready (${err.code || err.message}); retrying in ${wait}ms…`);
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  } else {
    const { DatabaseSync } = await import('node:sqlite');
    const dir = path.join(__dirname, '..', '.data');
    fs.mkdirSync(dir, { recursive: true });
    sqlite = new DatabaseSync(path.join(dir, 'agedaccounts.db'));
    sqlite.exec('PRAGMA journal_mode = WAL;');
    sqlite.exec(SCHEMA);
  }
  await addMissingColumns();
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
