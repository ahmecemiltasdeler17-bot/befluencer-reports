# BeFluencer Reports

Internal management and reporting platform for BeFluencer (TikTok music campaigns).

This repository is **not** the public corporate website.

## Platform surfaces

| Surface | Origin (production) | Notes |
|---------|---------------------|--------|
| Management app | `https://app.befluencer.co` | This repo — authenticated |
| Public reports | `https://reports.befluencer.co` | Same deployment initially — `/r/<token>` |
| Public creator lists | `https://reports.befluencer.co` | `/lists/<token>` (live public creator fields) |
| Corporate site | `https://befluencer.co` | **Separate** future Next.js project |

See [docs/platform-architecture.md](./docs/platform-architecture.md) and
[docs/domain-and-deployment.md](./docs/domain-and-deployment.md).

## Getting started

```bash
npm install
cp .env.example .env.local
# fill Supabase + APP_URL (and optional PUBLIC_REPORT_URL)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in via Supabase Auth.

### Local origin example

```bash
APP_URL=http://localhost:3000
PUBLIC_REPORT_URL=http://localhost:3000
MARKETING_SITE_URL=http://localhost:3001
```

### Production origin example (custom domains)

```bash
APP_URL=https://app.befluencer.co
PUBLIC_REPORT_URL=https://reports.befluencer.co
MARKETING_SITE_URL=https://befluencer.co
```

### Temporary Vercel origin (before custom DNS)

```bash
APP_URL=https://befluencer-reports.vercel.app
PUBLIC_REPORT_URL=https://befluencer-reports.vercel.app
```

Do not put `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, or `APIFY_API_TOKEN` in
`NEXT_PUBLIC_*` variables. Never set Production `APP_URL` /
`PUBLIC_REPORT_URL` to localhost.

Launch checklist: [docs/production-domain-launch.md](./docs/production-domain-launch.md).
One-page go-live: [docs/go-live-checklist.md](./docs/go-live-checklist.md).

```bash
npm run domain:check
npm run domain:check -- --production
npm run domain:smoke -- --app https://befluencer-reports.vercel.app --reports https://befluencer-reports.vercel.app
```


## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npx tsc --noEmit
npx tsx --test features/**/*.test.ts lib/**/*.test.ts
```

## Documentation

- [Production domain launch](./docs/production-domain-launch.md)
- [Domain and deployment](./docs/domain-and-deployment.md)
- [Admin dashboard](./docs/admin-dashboard.md)
- [Creator list builder](./docs/creator-list-builder.md)
- [Public report sharing](./docs/public-report-sharing.md)
- [PDF export](./docs/pdf-export.md)
- [Roadmap](./docs/roadmap.md)
