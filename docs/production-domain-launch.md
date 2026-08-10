# Production Domain Launch Runbook

This repository is prepared for custom-domain production. **Do not** configure DNS,
change Vercel domains, or edit Supabase Auth settings from automation — follow
these steps manually when ready.

## Canonical origins

| Surface | Env var | Production | Temporary (current) | Local |
|---------|---------|------------|---------------------|-------|
| Admin / PDF print | `APP_URL` | `https://app.befluencer.co` | `https://befluencer-reports.vercel.app` | `http://localhost:3000` |
| Public reports + lists | `PUBLIC_REPORT_URL` | `https://reports.befluencer.co` | `https://befluencer-reports.vercel.app` | `http://localhost:3000` |

Helpers:

- `getAppOrigin()` / `getAppUrl(path)`
- `getPublicReportOrigin()` / `getPublicReportUrl(path)`

Rules:

- Never trust `Host` / `X-Forwarded-Host` for absolute URLs
- Localhost env values are ignored on Vercel when a deployment URL exists
- Until custom DNS is live, keep both env vars on `befluencer-reports.vercel.app`
- Do **not** force redirects from vercel.app → app.befluencer.co before DNS is Valid

`www.befluencer.co` belongs to the **future marketing website project**, not this app.

---

## A. Vercel domains

In the BeFluencer Reports Vercel project:

1. Open **Settings → Domains**
2. Add `app.befluencer.co`
3. Add `reports.befluencer.co`
4. Copy the **exact** DNS records Vercel displays (usually CNAME or A/ALIAS)

Do not invent records — use only what Vercel shows for that project.

---

## B. DNS provider

1. In your DNS provider, create the records Vercel listed
2. Wait until each domain shows **Valid Configuration** in Vercel
3. Do not change Sitejet / marketing DNS for `befluencer.co` / `www` in this phase

---

## C. Vercel environment variables

Production (after domains are Valid):

```bash
APP_URL=https://app.befluencer.co
PUBLIC_REPORT_URL=https://reports.befluencer.co
```

Temporary (before custom DNS — keep working):

```bash
APP_URL=https://befluencer-reports.vercel.app
PUBLIC_REPORT_URL=https://befluencer-reports.vercel.app
```

Then **redeploy** Production so server actions pick up the new origins.

Never set Production `APP_URL` or `PUBLIC_REPORT_URL` to `http://localhost:3000`.

---

## D. Supabase Authentication (manual Dashboard)

**Site URL**

```text
https://app.befluencer.co
```

**Redirect URLs allowlist**

```text
http://localhost:3000/**
https://befluencer-reports.vercel.app/**
https://app.befluencer.co/**
```

Notes:

- `reports.befluencer.co` does **not** need to be an auth redirect target unless you
  introduce an authenticated flow on that host
- Public `/r/<token>` and `/lists/<token>` do not use Supabase Auth sessions
- Do not remove localhost from the allowlist while developers still sign in locally

---

## E. Smoke tests

### Admin (`https://app.befluencer.co`)

1. App loads
2. Login works
3. Dashboard loads
4. Creators directory loads
5. A campaign opens
6. Manual TikTok sync still works

### Reports

7. Create a new public report share
8. Generated URL starts with `https://reports.befluencer.co/r/`
9. Opens while logged out
10. Public PDF download works (when allowed)
11. Revoke blocks immediately

### Creator lists

12. Create a public list share
13. URL starts with `https://reports.befluencer.co/lists/`
14. Logged-out access works
15. Public CSV permission works when enabled
16. Revoke blocks immediately

### Local

17. `http://localhost:3000` admin still works
18. Locally created shares use configured `PUBLIC_REPORT_URL` (localhost when set)

---

## F. Rollback

If custom domains fail:

1. Keep serving `https://befluencer-reports.vercel.app`
2. Set Production env back to:

```bash
APP_URL=https://befluencer-reports.vercel.app
PUBLIC_REPORT_URL=https://befluencer-reports.vercel.app
```

3. Redeploy
4. Mint **new** share links (old links minted with the wrong origin stay wrong)
5. Optionally leave custom domains attached but unused until DNS is fixed

Supabase Site URL can temporarily return to:

```text
https://befluencer-reports.vercel.app
```

Keep the allowlist entries for vercel.app and localhost during rollback.

---

## Architecture notes (no action required)

- `proxy.ts` refreshes sessions and applies `private, no-store` + robots headers on
  public token routes; it does **not** enforce hostname redirects yet
- Authenticated print/PDF Puppeteer navigation uses `APP_URL` only
- Public PDF API may be hit on `PUBLIC_REPORT_URL`; print still loads `APP_URL`
  with a one-time export token (never the public share token)
