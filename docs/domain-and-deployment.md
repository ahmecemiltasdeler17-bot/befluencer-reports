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

## Vercel projects

### Management + public reports (this repository)

Environment (production example):

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

Domains attached to this project:

- `app.befluencer.co`
- `reports.befluencer.co`

Both hostnames hit the same Next.js deployment. Route groups keep management
under authenticated layouts, public reports under `(public-report)`, and public
creator lists under `(public-content)` (`/lists/<token>`).

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
