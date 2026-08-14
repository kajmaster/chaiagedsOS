-- Chai's Aged Accounts OS — portable schema (SQLite + PostgreSQL compatible).
-- All ids are app-generated UUID strings. All timestamps are ISO-8601 TEXT.
-- Booleans are INTEGER 0/1. Money is REAL (USD).
--
-- View and subscriber counts are BIGINT, never INTEGER. Postgres INTEGER stops
-- at 2,147,483,647 and large channels pass that in lifetime views, which fails
-- the insert outright. SQLite's INTEGER is already 64-bit, so this only ever
-- breaks in production — see the migration in db.js.

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT,
  plan          TEXT NOT NULL DEFAULT 'starter',
  is_demo       INTEGER NOT NULL DEFAULT 0,
  currency      TEXT NOT NULL DEFAULT 'USD',
  created_at    TEXT NOT NULL,

  -- Zero-knowledge vault. The salt derives the key in the customer's browser;
  -- the verifier proves a passphrase is right. The passphrase itself is never
  -- sent here, so credentials sealed with it cannot be read server-side.
  vault_salt     TEXT,
  vault_verifier TEXT
);

CREATE TABLE IF NOT EXISTS accounts (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL,
  nickname          TEXT NOT NULL,
  niche             TEXT NOT NULL DEFAULT 'Other',
  audience_tier     TEXT NOT NULL DEFAULT 'tier1',
  status            TEXT NOT NULL DEFAULT 'active',

  channel_url       TEXT,
  channel_id        TEXT,
  handle            TEXT,
  thumbnail         TEXT,

  account_created_at TEXT,
  acquired_at       TEXT,
  acquisition_cost  REAL NOT NULL DEFAULT 0,
  monthly_cost      REAL NOT NULL DEFAULT 0,

  subscribers       BIGINT NOT NULL DEFAULT 0,
  total_views       BIGINT NOT NULL DEFAULT 0,
  video_count       BIGINT NOT NULL DEFAULT 0,

  monetized         INTEGER NOT NULL DEFAULT 0,
  rpm_override      REAL,

  -- How production is billed. 'flat' = a price per video; 'per_minute' = a rate
  -- per finished minute, which is how pay-as-you-go editing services charge.
  cost_model        TEXT NOT NULL DEFAULT 'flat',
  cost_per_minute   REAL NOT NULL DEFAULT 0,

  notes             TEXT,

  cred_username     TEXT,
  cred_email        TEXT,
  cred_password     TEXT,
  cred_2fa          TEXT,
  cred_recovery     TEXT,

  last_synced_at    TEXT,
  sync_error        TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS videos (
  id             TEXT PRIMARY KEY,
  account_id     TEXT NOT NULL,
  user_id        TEXT NOT NULL,
  yt_video_id    TEXT,
  title          TEXT NOT NULL,
  thumbnail      TEXT,
  published_at   TEXT,
  duration_seconds BIGINT NOT NULL DEFAULT 0,
  views          BIGINT NOT NULL DEFAULT 0,
  likes          BIGINT NOT NULL DEFAULT 0,
  comments       BIGINT NOT NULL DEFAULT 0,
  cost           REAL NOT NULL DEFAULT 0,
  revenue_actual REAL,
  source         TEXT NOT NULL DEFAULT 'manual',
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payouts (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  account_id TEXT NOT NULL,
  period     TEXT NOT NULL,
  amount     REAL NOT NULL DEFAULT 0,
  note       TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS snapshots (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  account_id  TEXT NOT NULL,
  taken_on    TEXT NOT NULL,
  subscribers BIGINT NOT NULL DEFAULT 0,
  total_views BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_accounts_user   ON accounts (user_id);
CREATE INDEX IF NOT EXISTS idx_videos_account  ON videos (account_id);
CREATE INDEX IF NOT EXISTS idx_videos_user     ON videos (user_id);
CREATE INDEX IF NOT EXISTS idx_payouts_account ON payouts (account_id);
CREATE INDEX IF NOT EXISTS idx_snap_account    ON snapshots (account_id);
