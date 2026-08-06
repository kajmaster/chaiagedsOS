# Putting Chai's Aged Accounts OS online

**Short answer: use both. Render for the API + database, Netlify for the app.**

Netlify cannot run a always-on Node server or host a database — it serves static
files and short-lived functions. Render can do both, and its free Postgres is
exactly what this needs. Splitting them also means the marketing-facing app sits
on Netlify's fast global CDN while the API stays where the data is.

| Piece | Where | Why |
|---|---|---|
| React app (`web/`) | **Netlify** | Instant global CDN, free SSL, custom domain, previews per commit |
| API (`server/`) | **Render** | Long-running Node process, env secrets, cron-friendly |
| Postgres | **Render** | Free tier, wired to the API automatically |

> If you would rather run one service instead of two, you can: build the web app
> and let the API serve it (`server/src/index.js` already serves `web/dist` when
> it exists). Deploy only Render in that case. It's simpler but slower for users
> far from your Render region.

---

## Step 1 — push this folder to GitHub

**First, tell Git who you are.** Skip this and the commit fails with
*"Author identity unknown"* — and then the push fails too, because there is
nothing to push. You only ever do this once per machine:

```bash
git config --global user.email "kajslier@gmail.com"
git config --global user.name "Kajsl"
```

Then create an **empty** repository on GitHub (no README, no .gitignore — this
folder already has both) and copy its URL. Now:

```bash
git init
git add .
git commit -m "Chai's Aged Accounts OS"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/chai-aged-accounts-os.git
git push -u origin main
```

> **Replace `YOUR-USERNAME` with your real GitHub username.** Do not type angle
> brackets around it — in Windows `cmd.exe`, `<` and `>` mean "read from a file",
> so a URL like `https://github.com/<you>/…` fails with *"The system cannot find
> the file specified"*.

`.gitignore` already keeps `node_modules`, `.env` files and the local SQLite
database out of the repo.

### If something went wrong

| Error | Cause | Fix |
|---|---|---|
| `Author identity unknown` | Git has no name/email | run the two `git config` lines above, then re-run `git commit` |
| `src refspec main does not match any` | no commit exists yet | the commit failed — fix the identity, commit, then push |
| `The system cannot find the file specified` on `git remote add` | you typed the `<>` brackets | re-run without them; use `git remote set-url origin …` if the remote already exists |
| `remote origin already exists` | you ran `git remote add` twice | `git remote set-url origin <url>` instead |
| `LF will be replaced by CRLF` | harmless line-ending notice on Windows | ignore — `.gitattributes` handles it |

---

## Step 2 — get a YouTube API key (5 minutes, free)

This is what makes the app automatic instead of manual.

1. Go to <https://console.cloud.google.com/>
2. Create a project (any name).
3. **APIs & Services → Library →** search **"YouTube Data API v3" → Enable**.
4. **APIs & Services → Credentials → Create credentials → API key**.
5. Copy the key. Optionally restrict it to the YouTube Data API.

Free quota is 10,000 units/day — roughly **300–600 channel syncs per day**, plenty
for a first cohort of customers.

---

## Step 3 — deploy the API on Render

1. <https://dashboard.render.com> → **New → Blueprint**.
2. Pick your repo. Render reads `render.yaml` and creates:
   - `chai-aged-accounts-api` (web service)
   - `chai-aged-accounts-db` (Postgres)
3. It generates `JWT_SECRET` and `ENCRYPTION_KEY` for you.
4. Add the two remaining variables under **Environment**:

   | Key | Value |
   |---|---|
   | `YOUTUBE_API_KEY` | the key from step 2 |
   | `CORS_ORIGIN` | your Netlify URL, e.g. `https://chai-os.netlify.app` |

5. Deploy. Check `https://<your-api>.onrender.com/api/health` — you want
   `{"ok":true,"database":"postgres","youtubeSync":true}`.

> ### ⚠ Back up `ENCRYPTION_KEY`
> Every stored password, 2FA seed and recovery email is encrypted with it. If it
> is ever lost or changed, those values can never be decrypted again. Copy it
> into your password manager the day you deploy.

> Render's free tier sleeps after 15 minutes idle, so the first request after a
> quiet period takes ~30 seconds. The $7/month Starter instance removes that —
> worth it the moment you have paying customers.

---

## Step 4 — deploy the app on Netlify

1. <https://app.netlify.com> → **Add new site → Import an existing project** →
   pick the repo.
2. Netlify reads `web/netlify.toml`, so build settings are already correct
   (base `web`, command `npm run build`, publish `dist`).
3. **Site settings → Environment variables** → add:

   | Key | Value |
   |---|---|
   | `VITE_API_URL` | `https://<your-api>.onrender.com` (no trailing slash) |

4. Deploy. Then go back to Render and make sure `CORS_ORIGIN` matches the
   Netlify URL exactly.

---

## Step 5 — custom domain

- Netlify → **Domain management → Add domain** → point your DNS at Netlify.
- Update `CORS_ORIGIN` on Render to the new domain (comma-separate to allow
  several: `https://app.chaiaccounts.com,https://chai-os.netlify.app`).

---

## Running it locally

```bash
npm run install:all

# terminal 1 — API on :4000 (uses a local SQLite file, no database to install)
cd server && cp .env.example .env && npm run dev

# terminal 2 — app on :5173, proxying /api to the API
cd web && npm run dev
```

Open <http://localhost:5173> and press **See it with sample data**.

---

## Adding Stripe later

Everything the paywall needs already exists:

- `users.plan` column, defaulting to `starter`.
- `server/src/lib/plans.js` holds the limits per plan.
- `server/src/routes/accounts.js` already returns **402 + `code: PLAN_LIMIT`**
  when a customer exceeds their channel allowance.

To switch billing on:

1. `npm i stripe` in `server/`.
2. Add a checkout route that creates a Stripe Checkout Session with
   `client_reference_id = user.id`.
3. Add a webhook route for `checkout.session.completed` and
   `customer.subscription.deleted` that runs
   `UPDATE users SET plan = ? WHERE id = ?`.
4. Lower `PLANS.starter.channelLimit` to whatever the free tier should be.

No other code has to change — the limit check and the 402 response are already
wired through to the UI.
