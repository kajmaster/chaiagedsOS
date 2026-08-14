# Chai's Aged Accounts OS

**The operating system for an aged-YouTube-channel portfolio.**
Every channel you own, what it earns, what it cost, and whether it is actually
making money — on one screen.

---

## The problem it solves

Someone who buys aged channels ends up with a spreadsheet, a notes app full of
logins, and no idea which channel is actually profitable. Chai's OS replaces all
of that with a single dashboard:

- **One-eye view.** Net profit, revenue, spend and 30-day cashflow across the
  whole portfolio, then one card per channel with the same four numbers.
- **Click for depth.** Every channel opens into a full P&L: break-even progress,
  monthly performance, per-video profit, and its login details.
- **Almost no typing.** Paste a YouTube URL and the app pulls subscribers, views
  and every upload itself. The niche is guessed from the channel's own text, and
  earnings are modelled from that niche's RPM.

---

## What it does

### Automatic, not manual
- **YouTube sync** — channel stats and all uploads with live view counts, pulled
  through the YouTube Data API. One button syncs the whole portfolio.
- **Niche detection** — the channel's title and description are matched against
  26 niche profiles to pick the right one automatically.
- **RPM estimation** — each niche carries a benchmark RPM, scaled by the
  audience region (Tier 1 US/UK/CA/AU down to Tier 4). Override it per channel
  once you know your real AdSense number.
- **Bulk cost entry** — "every video on this channel cost me $120" instead of
  filling in dozens of rows.

### The money model
| Input | Where it comes from |
|---|---|
| Revenue | `views ÷ 1000 × effective RPM`, replaced by real payouts the moment you log one |
| Cost | purchase price + per-video production + monthly running cost × months held |
| Profit / ROI / margin | derived, per video, per channel, and portfolio-wide |
| Cashflow | trailing-30-day revenue minus trailing-30-day cost |
| Break-even | how much of total spend has been earned back, and roughly when it clears |

Every channel gets a one-word verdict — **Scaling · Profitable · Recovering ·
Near break-even · Burning cash · Not monetised** — so a portfolio of forty
channels is still readable at a glance.

### Login details
Username, email, password, 2FA/secret code and recovery email live with the
channel they belong to. They are encrypted with **AES-256-GCM** before they
reach the database, shown masked by default, and decrypted only when explicitly
revealed — and any channel can be exported as a plain **.txt** file the customer
keeps for themselves.

### Demo mode
The login screen has a **"See it with sample data"** button. It builds a
throwaway read-only workspace with an eight-channel portfolio — winners, a
break-even grinder, a money pit and an unmonetised channel — so a prospect sees
the whole product in about two seconds without signing up.

---

## Stack

```
web/     React 18 · TypeScript · Vite · Tailwind · Recharts · Framer Motion
server/  Node · Express · Postgres (SQLite locally, zero install)
```

No ORM, no build step on the server, no native dependencies — it starts
anywhere Node 22+ runs.

```
server/src/
  db.js              portable data layer (Postgres in prod, node:sqlite in dev)
  schema.sql         one schema that runs on both
  lib/crypto.js      AES-256-GCM credential envelope
  lib/rpm.js         niche + audience-tier RPM benchmarks
  lib/metrics.js     the financial engine — every number in the UI
  lib/youtube.js     YouTube Data API client
  lib/portfolio.js   read paths, serialisation
  lib/plans.js       plan limits (the Stripe hook)
  routes/            auth · accounts · videos · payouts · sync
web/src/
  pages/             Login · Dashboard · Channels · ChannelDetail · Analytics · Settings
  components/        UI kit, charts, command palette, add-channel flow
  lib/               API client, formatters, types
```

---

## Quick start

```bash
npm run install:all

cd server && cp .env.example .env && npm run dev   # :4000
cd web && npm run dev                              # :5173
```

Open <http://localhost:5173> → **See it with sample data**.

Locally the API uses a SQLite file in `server/.data/` — nothing to install. Set
`DATABASE_URL` and it switches to Postgres automatically.

---

## Configuration

| Variable | Required | What it does |
|---|---|---|
| `JWT_SECRET` | yes in prod | signs login sessions |
| `ENCRYPTION_KEY` | yes in prod | encrypts stored credentials — **back this up** |
| `YOUTUBE_API_KEY` | no | enables automatic syncing |
| `DATABASE_URL` | no | Postgres; falls back to local SQLite |
| `CORS_ORIGIN` | no | comma-separated allowed frontend origins |
| `VITE_API_URL` | no | only if the frontend is hosted without the /api proxy |

---

## Going live

See **[DEPLOY.md](DEPLOY.md)** — Render for the API + Postgres, Netlify for the
app, with a Stripe checklist at the end.

---

## Keyboard

| Shortcut | Action |
|---|---|
| `⌘K` / `Ctrl+K` | command palette — jump to any channel or run any action |
| `↑` `↓` `↵` | navigate and open |
| `Esc` | close |
