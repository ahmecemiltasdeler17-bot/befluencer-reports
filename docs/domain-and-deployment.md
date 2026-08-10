# Domain and Deployment

## Target DNS (document only — do not change now)

| Hostname | Target |
|----------|--------|
| `befluencer.co` | Corporate Vercel project |
| `www.befluencer.co` | Corporate project or canonical redirect to apex |
| `app.befluencer.co` | Management Vercel project (this repo) |
| `reports.befluencer.co` | Same management Vercel project (initially) |

## Constraints for this phase

- Existing Sitejet website remains untouched until the new site is ready
- Do **not** delete or rewrite production DNS records now
- Corporate site first ships on a Vercel **preview** domain
- DNS cutover only after explicit approval
- Full launch checklist: [production-domain-launch.md](./production-domain-launch.md)
- One-page go-live: [go-live-checklist.md](./go-live-checklist.md)

## Vercel projects

### Management + public reports (this repository)

Environment (production custom domains):

```bash
APP_URL=https://app.befluencer.co
PUBLIC_REPORT_URL=https://reports.befluencer.co
MARKETING_SITE_URL=https://befluencer.co
NEXT_PUBLIC_SUPABASE_URL=…
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=…
# server-only secrets — never NEXT_PUBLIC_*
APIFY_API_TOKEN=…
APIFY_TIKTOK_ACTOR_ID=…
CRON_SECRET=…
SUPABASE_SERVICE_ROLE_KEY=…
```

Temporary single-host (before DNS):

```bash
APP_URL=https://befluencer-reports.vercel.app
PUBLIC_REPORT_URL=https://befluencer-reports.vercel.app
```

Domains attached to this project (when ready):

- `app.befluencer.co`
- `reports.befluencer.co`

Both hostnames hit the same Next.js deployment. Route groups keep management
under authenticated layouts, public reports under `(public-report)`, and public
creator lists under `(public-content)` (`/lists/<token>`).

Absolute URL helpers (server-only):

- `getAppOrigin()` / `getAppUrl(path)` → admin origin
- `getPublicReportOrigin()` / `getPublicReportUrl(path)` → public shares

Never derive share URLs from request `Host` headers. Localhost env values are
ignored on Vercel when a deployment URL is available.

### Corporate website (future separate repository)

- No `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, or `APIFY_*`
- No admin application code
- May read only explicitly public marketing content
- Preview URL first; apex/www later

## Local development

```bash
APP_URL=http://localhost:3000
PUBLIC_REPORT_URL=http://localhost:3000
MARKETING_SITE_URL=http://localhost:3001
```

Local share links remain `http://localhost:3000/r/<token>` and
`http://localhost:3000/lists/<token>`. Behavior is unchanged from single-origin
development.

## Supabase Auth (manual)

Site URL (production): `https://app.befluencer.co`

Redirect allowlist:

```text
http://localhost:3000/**
https://befluencer-reports.vercel.app/**
https://app.befluencer.co/**
```

`reports.befluencer.co` is not required for auth redirects. See
[production-domain-launch.md](./production-domain-launch.md).

## Cron

Vercel Cron continues to call this project's `/api/cron/tiktok-sync` on the
management deployment. Use `APP_URL` / the project URL for scheduling — not the
marketing domain.

## Cutover checklist (future)

1. Corporate site ready on Vercel preview  
2. Management project live on `app` + `reports` hostnames with env set  
3. Smoke-test login, dashboard, share link, public PDF, cron  
4. Approve DNS changes for apex/www  
5. Keep Sitejet until cutover succeeds  
