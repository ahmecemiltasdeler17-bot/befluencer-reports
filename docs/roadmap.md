# BeFluencer Reports — Roadmap

## Completed

| Phase | Scope | Status |
|-------|--------|--------|
| 1 | Report UI (mock data) | Done |
| 2 | Supabase foundation + internal auth | Done |
| 3 | Campaign CRUD | Done |
| 4 | Creator management + campaign assignments | Done |
| 5 | Video management (manual) | Done |
| 6 | Manual metric snapshot engine | Done |
| 7 | TikTok provider adapter + manual sync | Done |
| 8 | Live campaign report (authenticated) | Done |
| 9 | Versioned report generation engine | Done |
| 10 | PDF export from report version snapshots (authenticated) | Done |
| 11 | Report interactions + media reliability (profile/video links) | Done |
| 12 | Creator profile / follower sync (manual TikTok) | Done |
| 13 | TikTok sound usage sync (manual one-click) | Done |
| 14 | Scheduled automatic TikTok sync (Vercel Cron) | Done |
| 15 | Public share links (immutable report versions) | Done |
| 16 | Admin dashboard home (`/`) | Done |
| 17 | Platform / domain architecture foundation | Done |
| 18 | Video thumbnail reliability | Done |
| 19 | Bulk TikTok creator import | Done |
| 20 | Creator List Builder (selection, CSV, public share, campaign handoff) | Done |

## Next phases

| Phase | Scope |
|-------|--------|
| 21 | Report watermark |
| 22 | Report visual refinement |
| 23 | Corporate website project bootstrap |
| 24 | Corporate website design system |
| 25 | Case studies and client references |
| 26 | Bilingual corporate content |
| 27 | Production deployment and domain connection |
| — | Scheduled report generation |
| — | PDF persistence in Supabase Storage + email delivery |
| — | Report media persistence in Supabase Storage |
| — | Creator growth section in the approved report UI |
| — | Frozen creator-list snapshots / proposal PDF / fees |

## Principles

- Internal tool first — single agency, manual user provisioning
- Publishable Supabase key only in the app
- Snapshots over overwrites for auditability
- Approved report UI changes only when explicitly scheduled
- Provider secrets server-side only (`APIFY_*` never in client bundles)
- Generated report versions are immutable historical records
- PDFs are exported from immutable version snapshots, never from live data
- External links are allowlisted by scheme and host; a missing URL renders plain content rather than a dead action
- Report media degrades to a deterministic fallback, never to stock imagery or a broken image
- Creator profile sync is append-only for follower history; campaign-specific fields stay manual
- Sound usage sync is append-only; manual and Apify snapshots both feed live/historical reports
- Scheduled TikTok sync uses a server-only service-role client + CRON_SECRET; never in the browser
- Public report shares target immutable report versions only; raw tokens are hashed (SHA-256) and revocable/expirable
- Creator-list shares use the same token pattern on `/lists/<token>` with live public creator fields and fixed membership
- `/` is the authenticated admin dashboard; mock report preview lives at `/dev/report-preview`
- Management (`APP_URL`), public reports (`PUBLIC_REPORT_URL`) and marketing (`MARKETING_SITE_URL`) origins are configured server-side; corporate site stays a separate project

See also: [platform-architecture.md](./platform-architecture.md), [domain-and-deployment.md](./domain-and-deployment.md), [creator-list-builder.md](./creator-list-builder.md), [corporate-website-plan.md](./corporate-website-plan.md), [admin-dashboard.md](./admin-dashboard.md), [tiktok-sync.md](./tiktok-sync.md), [tiktok-sound-sync.md](./tiktok-sound-sync.md), [scheduled-sync.md](./scheduled-sync.md), [creator-profile-sync.md](./creator-profile-sync.md), [live-report.md](./live-report.md), [report-generation.md](./report-generation.md), [pdf-export.md](./pdf-export.md), [report-interactions.md](./report-interactions.md), [public-report-sharing.md](./public-report-sharing.md)
