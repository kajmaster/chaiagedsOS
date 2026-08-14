# Exact revenue, and why other tools make people log in every week

Two separate things get confused here. Worth keeping them apart.

---

## Where the numbers come from today

| Source | How exact | Effort for the customer |
|---|---|---|
| **Niche RPM model** (default) | Estimate with a stated low/high band | None — paste a URL |
| **RPM override** | Exact, if they know their real RPM | Type one number, once |
| **Logged payouts** | **Exact.** Replaces the estimate everywhere | Type one number a month |

**Customers who say "the revenue is not exact" can already fix it today** — the
features exist, they are just not obvious enough:

- **Channel → Log payout** — enter what AdSense actually paid for a month.
  From then on, that channel reports real money, and `revenueSource` flips from
  `estimated` to `actual` across the dashboard, the charts and the CSV.
- **Channel → Edit → RPM override** — if they know their true RPM, every
  estimate for that channel uses it instead of the niche benchmark.

Point this out before promising anyone an integration. One number a month buys
exact figures with no OAuth, no permissions, and nothing to break.

---

## Fully automatic exact revenue

Requires the **YouTube Analytics API** and the channel owner granting access via
OAuth (scope `yt-analytics-monetary.readonly`). Only the owner can read their own
earnings — an API key cannot, which is why the current sync gives views but not
dollars.

Rough shape of the work:

1. OAuth client (Web application) in the same Google Cloud project.
2. `GET /api/auth/youtube` → consent screen; `GET /api/auth/youtube/callback`
   stores the **refresh token** against the account.
3. Nightly job calls `reports.query` with
   `metrics=estimatedRevenue,estimatedAdRevenue,cpm,playbackBasedCpm` and writes
   the result in as a payout — the data model already supports this, so nothing
   downstream changes.

Store refresh tokens encrypted, and note they are as sensitive as a password.

---

## The weekly re-login: it is a setting, not a bug

> *"it's just annoying i only see it for a week per month because i refuse to
> re log in 4 times"*

That tool's Google Cloud project is in **Testing** mode. Google expires refresh
tokens after **7 days** for unpublished apps — so every user has to reconnect
weekly, forever. Nothing in the code can work around it.

**The fix is to publish the OAuth app**, not to write more code:

1. Google Cloud → **APIs & Services → OAuth consent screen**
2. Set **User type: External**, fill in the app name, support email, logo, and a
   link to a real privacy policy and terms page.
3. **Publish app** → status moves from *Testing* to *In production*.
4. Because `yt-analytics-monetary.readonly` is a **sensitive scope**, Google
   requires verification: domain ownership, a privacy policy that actually
   describes this data use, and usually a short screencast of the consent flow.
   Budget **2–6 weeks** and expect at least one round of questions.

Once verified, refresh tokens last until the user revokes them. No weekly
re-login.

> Until verification completes, an unpublished app is also capped at 100 test
> users. Plan the submission before a launch, not after.

**This is a genuine competitive advantage worth taking.** Every competitor stuck
in Testing mode nags their customers weekly. Doing the verification once removes
that permanently — and it is a concrete, checkable claim to sell against.

---

## Suggested order

1. **Make payout logging obvious** — exact numbers today, zero integration risk.
2. **Start Google verification early** — it is calendar time, not work time.
3. **Build the OAuth flow while verification is pending.**

Estimates stay the default regardless: they are what makes a channel useful
thirty seconds after it is added, before anyone has connected anything.
