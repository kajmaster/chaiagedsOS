-- Chai's Aged Accounts OS — portable schema (SQLite + PostgreSQL compatible).
-- All ids are app-generated UUID strings. All timestamps are ISO-8601 TEXT.
-- Booleans are INTEGER 0/1. Money is REAL (USD).

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT,
  plan          TEXT NOT NULL DEFAULT 'starter',
  is_demo       INTEGER NOT NULL DEFAULT 0,
  currency      TEXT NOT NULL DEFAULT 'USD',
  created_at    TEXT NOT NULL
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

  subscribers       INTEGER NOT NULL DEFAULT 0,
  total_views       INTEGER NOT NULL DEFAULT 0,
  video_count       INTEGER NOT NULL DEFAULT 0,

  monetized         INTEGER NOT NULL DEFAULT 0,
  rpm_override      REAL,

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
  views          INTEGER NOT NULL DEFAULT 0,
  likes          INTEGER NOT NULL DEFAULT 0,
  comments       INTEGER NOT NULL DEFAULT 0,
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
  subscribers INTEGER NOT NULL DEFAULT 0,
  total_views INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_accounts_user   ON accounts (user_id);
CREATE INDEX IF NOT EXISTS idx_videos_account  ON videos (account_id);
CREATE INDEX IF NOT EXISTS idx_videos_user     ON videos (user_id);
CREATE INDEX IF NOT EXISTS idx_payouts_account ON payouts (account_id);
CREATE INDEX IF NOT EXISTS idx_snap_account    ON snapshots (account_id);
