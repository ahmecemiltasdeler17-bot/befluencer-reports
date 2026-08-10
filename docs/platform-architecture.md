# BeFluencer Platform Architecture

## Long-term structure

| Surface | Origin | Repository | Role |
|---------|--------|------------|------|
| Corporate / marketing | `https://befluencer.co` | **Separate** Next.js project | Public Turkish/English site |
| Management platform | `https://app.befluencer.co` | **This** repository | Authenticated admin |
| Public reports | `https://reports.befluencer.co` | Same deployment as management (initially) | Immutable shared reports + public PDF |

Do **not** merge the corporate website into this repository.

## This repository

Owns:

- Authenticated dashboard, campaigns, creators, creator lists, videos, metrics
- TikTok sync (manual + scheduled)
- Live and historical reports
- PDF export (authenticated + public)
- Public share links (`/r/<token>` for reports, `/lists/<token>` for creator lists)

Does **not** own:

- Marketing pages, blog, lead forms, bilingual corporate content

## Origin configuration (server-only)

| Variable | Purpose | Local | Production |
|----------|---------|-------|------------|
| `APP_URL` | Internal app origin (PDF print, admin absolute URLs) | `http://localhost:3000` | `https://app.befluencer.co` (temp: vercel.app) |
| `PUBLIC_REPORT_URL` | Public share absolute URLs | `http://localhost:3000` (fallback = `APP_URL`) | `https://reports.befluencer.co` (temp: vercel.app) |
| `MARKETING_SITE_URL` | Future corporate site helper | optional `http://localhost:3001` | `https://befluencer.co` |

Helpers: `getAppOrigin()`, `getAppUrl(path)`, `getPublicReportOrigin()`,
`getPublicReportUrl(path)`.

Rules:

- Absolute http(s) origins only
- No path, query, fragment or credentials
- Never trust `Host` / `X-Forwarded-Host` for canonical URLs
- Internal navigation stays relative

## Public report vs management

- Share links are minted with `PUBLIC_REPORT_URL`
- Recipients open `/r/<token>` (immutable report versions) or `/lists/<token>` (creator lists) without login
- No management navbar on public layouts
- Report shares: snapshots only — never live campaign tables
- Creator-list shares: fixed membership with **live** public creator fields (not report snapshots)

See [creator-list-builder.md](./creator-list-builder.md).

## PDF origin strategy

| Flow | API / page origin | Puppeteer print origin |
|------|-------------------|------------------------|
| Authenticated PDF | `APP_URL` | `APP_URL` (`…/print?token=`) |
| Public PDF | `PUBLIC_REPORT_URL` (reports host) | `APP_URL` with **one-time export token only** |

The raw public share token is never passed to the internal print URL.

## Why separate projects for marketing

- Independent deployments and rollback
- Lower risk of breaking admin features
- Separate caching and SEO policies
- Smaller bundles / clearer auth boundaries
- Marketing design can evolve independently
- Easier future team ownership

See also: [domain-and-deployment.md](./domain-and-deployment.md),
[production-domain-launch.md](./production-domain-launch.md),
[corporate-website-plan.md](./corporate-website-plan.md).
