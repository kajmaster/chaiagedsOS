import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { initDb, driver } from './db.js';
import authRoutes, { purgeStaleDemos } from './routes/auth.js';
import accountRoutes from './routes/accounts.js';
import { NICHES, AUDIENCE_TIERS } from './lib/rpm.js';
import { isConfigured } from './lib/youtube.js';
import { requireAuth } from './lib/auth.js';
import { loadPortfolio } from './lib/portfolio.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 4000);

/* Fail fast and loudly rather than half-booting with insecure defaults. */
function assertConfig() {
  const missing = [];
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) missing.push('JWT_SECRET');
  if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length < 16) missing.push('ENCRYPTION_KEY');
  if (missing.length && process.env.NODE_ENV === 'production') {
    console.error(`\n  FATAL: missing required env vars: ${missing.join(', ')}\n`);
    process.exit(1);
  }
  if (missing.length) {
    // Dev convenience only — never used in production because of the guard above.
    process.env.JWT_SECRET ||= 'dev-only-insecure-jwt-secret-change-me';
    process.env.ENCRYPTION_KEY ||= 'dev-only-insecure-encryption-key-change-me';
    console.warn(`  ⚠  Using insecure dev values for: ${missing.join(', ')}`);
  }
}
assertConfig();

const origins = (process.env.CORS_ORIGIN || '*')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: origins.includes('*') ? true : origins,
    credentials: false,
  })
);
app.use(express.json({ limit: '1mb' }));
app.disable('x-powered-by');

/* Lightweight in-memory rate limit — enough to stop credential stuffing. */
const hits = new Map();
app.use('/api/auth', (req, res, next) => {
  if (req.method !== 'POST') return next();
  const key = req.ip || 'anon';
  const now = Date.now();
  const window = hits.get(key)?.filter((t) => now - t < 60_000) ?? [];
  window.push(now);
  hits.set(key, window);
  if (window.length > 20) return res.status(429).json({ error: 'Too many attempts. Wait a minute and try again.' });
  next();
});

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: "Chai's Aged Accounts OS",
    version: '1.0.0',
    database: driver,
    youtubeSync: isConfigured(),
    time: new Date().toISOString(),
  });
});

/* Reference data the UI needs to render selects and RPM explainers. */
app.get('/api/meta', (req, res) => {
  res.json({ niches: NICHES, audienceTiers: AUDIENCE_TIERS, syncAvailable: isConfigured() });
});

app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);

/* CSV export — accountants ask for this on day one. */
app.get('/api/export.csv', requireAuth, async (req, res, next) => {
  try {
    const { accounts } = await loadPortfolio(req.userId);
    const head = [
      'Channel', 'Niche', 'Status', 'Subscribers', 'Videos', 'Views',
      'Revenue', 'Acquisition Cost', 'Production Cost', 'Overhead', 'Total Cost',
      'Profit', 'ROI %', 'Net 30d Cashflow', 'Effective RPM', 'Health',
    ];
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [head.join(',')];
    for (const a of accounts) {
      const m = a.metrics;
      lines.push(
        [
          a.nickname, a.nicheLabel, a.status, a.subscribers, m.videoCount, m.totalViews,
          m.revenue, m.acquisitionCost, m.productionCost, m.overheadCost, m.totalCost,
          m.profit, m.roi ?? '', m.netCashflow30d, m.rpm.rpm, m.health.label,
        ]
          .map(esc)
          .join(',')
      );
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="chai-portfolio-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(lines.join('\n'));
  } catch (err) {
    next(err);
  }
});

/* Optional single-service deploy: if the built SPA is present, serve it. */
const spaDir = path.join(__dirname, '..', '..', 'web', 'dist');
if (fs.existsSync(spaDir)) {
  app.use(express.static(spaDir));
  app.get(/^\/(?!api).*/, (req, res) => res.sendFile(path.join(spaDir, 'index.html')));
}

app.use((req, res) => res.status(404).json({ error: 'Not found.' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // A reference the customer can quote, so an opaque 500 is still traceable
  // to one line in the logs instead of "it just said something went wrong".
  const ref = Math.random().toString(36).slice(2, 8).toUpperCase();
  console.error(`[error ${ref}] ${req.method} ${req.originalUrl}`, err);

  // Postgres numeric overflow — surfaced because the generic message once hid
  // exactly this bug for a channel with more than 2.1bn lifetime views.
  if (err.code === '22003') {
    return res.status(400).json({ error: 'One of those numbers is too large to store. Please report this.', ref });
  }

  res.status(err.status || 500).json({
    error: err.expose ? err.message : `Something went wrong on our side. Reference ${ref}.`,
    ref,
  });
});

const started = await initDb();
console.log(`\n  Chai's Aged Accounts OS — API`);
console.log(`  database : ${started}`);
console.log(`  yt sync  : ${isConfigured() ? 'enabled' : 'disabled (set YOUTUBE_API_KEY)'}`);

purgeStaleDemos().catch(() => {});
setInterval(() => purgeStaleDemos().catch(() => {}), 3_600_000).unref();

app.listen(PORT, () => console.log(`  listening: http://localhost:${PORT}\n`));
