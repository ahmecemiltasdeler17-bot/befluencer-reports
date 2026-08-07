# PDF Export

Phase 8 lets an authenticated internal user download any **ready** or **archived**
report version as an A4 PDF.

## Why PDFs target immutable versions

The live report at `/campaigns/[id]/report` recalculates from current Supabase
tables on every request, so two exports minutes apart could disagree. A PDF is
an artifact people forward to clients — it must be reproducible.

Every export therefore renders `report_versions.snapshot` and nothing else. No
campaign, creator, video, metric or sound table is queried during export, no
TikTok sound provider is called, and no value is recalculated. Re-exporting
version 2 next year produces the same numbers (including frozen sound usage
charts) it produced the day it was generated.

The mutable live report has no PDF export.

## Architecture

```
Browser                Route Handler (Node)          Headless Chromium
   │                          │                              │
   │  POST .../pdf            │                              │
   ├─────────────────────────►│                              │
   │                          │ 1. verify session (RLS)      │
   │                          │ 2. version belongs to        │
   │                          │    campaign + ready/archived │
   │                          │ 3. issue one-time token      │
   │                          │ 4. build same-origin URL     │
   │                          ├─────────────────────────────►│
   │                          │                              │ GET /print?token=…
   │                          │                              │ consume token (RPC)
   │                          │                              │ render snapshot
   │                          │                              │ data-pdf-ready="true"
   │                          │◄─────────────────────────────┤ PDF buffer
   │  application/pdf         │ 5. close browser (finally)   │
   │◄─────────────────────────┤                              │
```

| Route | Method | Purpose |
|-------|--------|---------|
| `/campaigns/[id]/reports/[versionId]` | GET | Historical report, has the “PDF İndir” button |
| `/campaigns/[id]/reports/[versionId]/print` | GET | Internal print layout, session **or** token |
| `/api/campaigns/[id]/reports/[versionId]/pdf` | POST | Generates and streams the PDF |

## Print route

Lives at `app/(print)/campaigns/[id]/reports/[versionId]/print/page.tsx`.

It is deliberately **outside** the `(protected)` route group: that group's layout
calls `redirect("/login")` when there is no session, and the headless browser has
no session cookie. Access is instead gated inside the page on either

1. a valid Supabase session — a human can open the print layout to preview it, or
2. a valid single-use export token — used by the headless browser.

It is never publicly reachable, and the token must match both the campaign id and
the version id in the URL.

The layout omits the management navbar, `Panele Dön`, every navigation control
and every button. It renders the same approved report components as the on-screen
historical report plus a compact footer carrying the report number, version,
generation timestamp and page title.

## One-time token flow

Migration: `supabase/migrations/20260805240000_report_pdf_exports.sql`

`report_export_tokens` stores only the SHA-256 hash of a 32-byte random token.
The raw token exists in memory and in the print URL for a few seconds; it is
never stored, never logged and never shown in the UI.

| Property | Enforcement |
|----------|-------------|
| Hash only | `token_hash text not null unique`, checked against `^[0-9a-f]{64}$` |
| Max 5 minute lifetime | `check (expires_at <= created_at + interval '5 minutes')`; the app requests 120s |
| Single use | `used_at` set inside `consume_report_export_token()`; `authenticated` has no `update` grant |
| Owner scoped | RLS policies require `created_by = auth.uid()` for select and insert |
| No anon table access | `revoke all on public.report_export_tokens from anon` |

`consume_report_export_token(p_token_hash text)` is a `security definer` function
that atomically claims an unexpired, unused token and returns the snapshot for
that version — only when its status is `ready` or `archived`. `anon` may execute
that one function and has no table privileges whatsoever.

This replaces the need for a service-role key. The capability is narrower than a
service-role client in every dimension: one version, one use, two minutes,
read-only.

`purge_expired_report_export_tokens()` deletes tokens that expired over a day ago
and can be called manually or from a future scheduled job.

## Puppeteer lifecycle

`features/pdf/services/generate-report-pdf.ts` owns the whole lifecycle:

1. Re-validate that the print URL is same-origin.
2. Launch a browser (`features/pdf/services/get-browser.ts`).
3. Set a 1240×1754 viewport at DPR 2 so the report keeps its desktop layout.
4. `emulateMediaType("screen")` — the dark design lives in screen styles.
5. Enable request interception via `decidePrintRequest()` — see
   [Request interception](#request-interception).
6. `page.goto(printUrl, { waitUntil: "networkidle0" })`.
7. Wait for `[data-pdf-ready="true"]`.
8. Settle fonts and images with a bounded wait.
9. `page.pdf(...)` with `displayHeaderFooter: false`.
10. Close the browser in a `finally` block — always, on success and failure.

No browser instance is cached or shared, so a failed export cannot leak a process
into the next request.

### Request interception

`features/pdf/services/print-request-policy.ts` holds the rules as a pure,
testable function:

| Request | Decision |
|---------|----------|
| Navigation to the same-origin print URL | Continue |
| Navigation anywhere else, including social links | **Abort** |
| `image`, `font`, `media` from any host | Continue |
| `data:` URLs | Continue |
| Documents, scripts, styles from another origin | Abort |

Reports link out to creator profiles and video posts. Those `href` attributes
must stay in the DOM so Chrome writes clickable link annotations into the PDF,
but they must never be *followed* during generation — a navigation away from the
print page would capture the wrong document. Aborting every non-print navigation
enforces that regardless of what the page contains.

Thumbnails and avatars are allowed from any host because provider CDN hostnames
are not predictable (TikTok signs and shards them per region). They are passive
assets that cannot execute or navigate, and a blocked or expired one degrades to
a deterministic CSS poster. `next/image` runs `unoptimized` for report media, so
`remotePatterns` in `next.config.ts` does not gate these hosts.

### Links inside the PDF

Print CSS keeps anchors intact — `.pdf-document a` only resets colour and
decoration. Interactive-only affordances such as the external-link icon are
hidden individually with `screen-only` / `print:hidden`, and pointer events are
never disabled globally, since either would strip the clickable links.

Thumbnails in a historical PDF may show the deterministic fallback poster if the
provider's signed CDN URL has expired since generation. Snapshots are immutable,
so the stored URL is never rewritten. Video and profile links keep working
regardless. Image requests remain passively allowed; failed CDN loads settle the
readiness marker via `error` listeners and a bounded asset timeout. See
[video-thumbnail-reliability.md](./video-thumbnail-reliability.md) and
[report-interactions.md](./report-interactions.md).

### Readiness marker

`features/pdf/components/pdf-ready-marker.tsx` is a client component that renders
`data-pdf-ready="false"` and flips it to `"true"` only after fonts are ready,
every image has settled (loaded **or** errored), two animation frames have passed
and a chart settle delay has elapsed. Each wait is capped, so a broken remote
image delays the export by a few seconds instead of hanging it.

### Timeouts

| Stage | Limit |
|-------|-------|
| Navigation | 30s |
| Readiness marker | 20s |
| Font/image settle | 8s |
| `page.pdf()` | 30s |
| Whole export | 60s |
| Response size | 25 MB |

## Local Chrome configuration

The launcher resolves a binary in this order:

1. `CHROME_EXECUTABLE_PATH` if set — must be executable.
2. Bundled `@sparticuz/chromium` when running on Vercel or Lambda.
3. An installed Chrome, Chromium or Edge from the standard locations for
   Windows, macOS and Linux.

Most local setups need no configuration. Set `CHROME_EXECUTABLE_PATH` only when
auto-detection fails. Executable paths are never logged.

## Vercel configuration

- `serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"]` in
  `next.config.ts` — the bundler cannot trace the native binary.
- The route declares `runtime = "nodejs"`. Chromium cannot run on Edge.
- The route exports `maxDuration = 60`. This is the supported way to set duration
  for App Router handlers; no `vercel.json` is used. A `functions` pattern in
  `vercel.json` would be risky here because those patterns are PCRE-compatible,
  so the `[id]` and `[versionId]` segments would be read as character classes
  rather than literal directory names.
- **Memory must be raised in the Vercel dashboard** under Project → Functions.
  Chromium needs roughly 1600–2048 MB; the default 1024 MB can OOM on
  chart-heavy reports. With Fluid compute enabled, memory cannot be set in
  `vercel.json` at all.
- Nothing launches Chromium at build time and no test launches a real browser.

Required Vercel environment variables (Production and Preview):

```
APP_URL=https://app.befluencer.co
PUBLIC_REPORT_URL=https://reports.befluencer.co
```

Authenticated PDF print navigation always uses `APP_URL`. Public PDF endpoints
may be served on `PUBLIC_REPORT_URL`, but Puppeteer still loads the internal
print route on `APP_URL` with a one-time export token (never the public share
token). See [platform-architecture.md](./platform-architecture.md).

On Preview deployments the URL differs per deployment; set `APP_URL` per
environment, or rely on the `VERCEL_PROJECT_PRODUCTION_URL` fallback.

## Environment variables

| Variable | Scope | Required | Purpose |
|----------|-------|----------|---------|
| `APP_URL` | server | when export is invoked | Internal origin the headless browser loads the print route from |
| `PUBLIC_REPORT_URL` | server | no (falls back to `APP_URL`) | Public report origin; does not replace print origin |
| `CHROME_EXECUTABLE_PATH` | server | no | Explicit Chrome binary when auto-detection fails |

`.env.local`:

```
APP_URL=http://localhost:3000
PUBLIC_REPORT_URL=http://localhost:3000
# optional
# CHROME_EXECUTABLE_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
```

Origins are validated as absolute http(s) **origins** (no path/query/credentials)
in `lib/origins` / `lib/env.server.ts`. They are read **only** from server
configuration — never from `Host` or `X-Forwarded-Host`.

## Security model

- Authentication is required to request a PDF; RLS governs the version lookup.
- No service-role or secret Supabase key is used anywhere in this feature.
- No public or unauthenticated report access is introduced.
- Puppeteer may navigate only to the configured origin. The print URL is built
  from validated UUIDs and a validated token — a user-supplied URL is never
  accepted, so there is no open-redirect or SSRF surface.
- Chromium runs with extensions, background networking, sync, default apps and
  the GPU disabled.
- Session cookies are never forwarded into the browser; the token is the only
  credential it holds.
- The raw token is never logged, never returned to the client and never shown in
  a UI message.
- `POST` only, `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`.
- A 25 MB size limit and a 60s total timeout bound resource use.

## Error handling

`features/pdf/errors.ts` defines one typed error per failure mode, each with a
sanitized Turkish message and an HTTP status:

| Code | Status | Turkish message |
|------|--------|-----------------|
| `report_not_found` | 404 | Rapor sürümü bulunamadı. |
| `report_not_ready` | 409 | Bu rapor sürümü indirilemez… |
| `invalid_snapshot` | 422 | Rapor anlık görüntüsü okunamadı. |
| `export_token_failed` | 500 | PDF indirme izni oluşturulamadı… |
| `browser_launch_failed` | 500 | PDF oluşturucu başlatılamadı… |
| `print_route_timeout` | 504 | Rapor sayfası zamanında yüklenemedi… |
| `print_ready_timeout` | 504 | Rapor grafikleri zamanında hazırlanamadı… |
| `pdf_generation_failed` | 500 | PDF oluşturulamadı… |
| `pdf_too_large` | 500 | PDF dosyası beklenenden büyük… |
| `app_origin_invalid` | 500 | PDF dışa aktarma yapılandırması eksik. |

Stack traces, executable paths, tokens, cookies and raw Supabase errors never
reach the browser. `logPdfDiagnostics()` prints the error code and a short detail
in development only.

A failed export never modifies the report version — export is strictly read-only
against `report_versions`, so snapshot immutability is preserved. An unused token
simply expires.

## Current no-storage behavior

PDFs are generated on demand and streamed straight to the browser. Nothing is
written to Supabase Storage and nothing is cached, so a download always reflects
the stored snapshot and there is no stale artifact to invalidate.

## Future work

- **Supabase Storage persistence** — write the buffer to a private bucket keyed
  by `report_version_id` and serve a signed URL, turning repeat downloads into a
  storage read instead of a Chromium launch.
- **Public download links** — done in Phase 13. Long-lived share tokens are
  separate from short-lived `report_export_tokens`. Public PDF uses
  `POST /api/public/reports/[token]/pdf`, then issues a one-time print token
  so the existing print route loads the snapshot without a second share
  increment. See [public-report-sharing.md](./public-report-sharing.md).
- **Email attachment workflow** — generate on a schedule and attach to a client
  email, reusing `generateReportPdf()` unchanged.
- **Export audit table** — a `report_pdf_exports` row per attempt with status,
  size and error. Deliberately deferred; the token table already records who
  requested an export and when.
- **Media persistence** — copy thumbnails and avatars into Supabase Storage at
  generation time so historical PDFs keep their original imagery after provider
  CDN URLs expire.

## Manual test steps

```bash
# 1. Apply the migration locally
npx supabase db push

# 2. Configure the origin
#    .env.local -> APP_URL=http://localhost:3000

# 3. Run the app
npm run dev
```

1. Open a campaign and generate a report version if none is ready.
2. Open `/campaigns/[id]/reports` and click **PDF İndir** on a ready row.
3. The button shows “PDF hazırlanıyor…”, then the browser downloads
   `befluencer-<campaign>-<report-number>-v<n>.pdf`.
4. Open the historical report page and use its **PDF İndir** button.
5. Archive the version and export it again — archived versions must still work.
6. Confirm a `generating` or `failed` row shows no export button.
7. Open the print URL without a token while signed in: the layout renders with no
   navbar and no buttons.
8. Reuse a token twice: the second load returns 404.
9. Open the downloaded PDF and click a creator handle and a video poster — both
   must open the real social destination in a browser.

## Tests

```bash
npx tsx --test features/pdf/pdf.test.ts
npx tsx --test features/reports/report-interactions.test.tsx
```

The interaction suite covers the request interception policy, including the
refusal to navigate to external social links.

No test launches a real Chromium, calls Supabase or calls Apify.
