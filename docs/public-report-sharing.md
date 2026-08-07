# Public Report Sharing

Phase 13 lets an authenticated internal user create a **secure, revocable,
optionally expiring** public link for one **immutable report version**.

Recipients open `/r/<raw-token>` without logging in and see the frozen snapshot
only. Live campaign data is never queried on public routes.

## Immutable version-only model

| Allowed | Not allowed |
|---------|-------------|
| `report_versions` with status `ready` or `archived` | Live `/campaigns/[id]/report` |
| Snapshot JSON returned by security-definer RPCs | Direct table SELECT by anon |
| Creator/video external links already in the snapshot | Enrichment from current campaign tables |
| Optional PDF of that same snapshot | Generating / failed versions |

Public links never include campaign id or report version id in the URL. Knowing
a version UUID is not enough to read the report.

## Token lifecycle

1. Authenticated user creates a share → app generates **32 random bytes** (64 hex).
2. Only the **SHA-256 hex** of that token is stored (`token_hash`).
3. The raw token is returned **once** inside the absolute public URL built from
   `PUBLIC_REPORT_URL` (falls back to `APP_URL` locally).
4. After that, the raw token cannot be reconstructed. Lost links require a new share.
5. Opening `/r/<token>` resolves the share via RPC (no table privileges for anon).
6. Revocation sets `revoked_at`. Expiry uses `expires_at` (null = never).
7. Either condition makes resolve/consume return empty — public UI shows one
   generic Turkish message.

## SHA-256 storage

- Raw token: never persisted, never logged.
- DB: `token_hash ~ '^[0-9a-f]{64}$'`, unique.
- RPC hashes the raw token with
  `encode(extensions.digest(convert_to(token,'UTF8'),'sha256'),'hex')`
  (`search_path` includes `extensions`). Migration
  `20260805290000_fix_public_report_share_digest.sql` fixes the Phase 13
  failure where `digest` was missing from `search_path`.
- Absolute share URLs use `getPublicReportOrigin()` — never request Host headers.
  Production example: `https://reports.befluencer.co/r/<token>`.
- Management SELECT never exposes `token_hash` to the UI (columns stripped in mappers).

## Revocation & expiry

| Field | Behavior |
|-------|----------|
| `revoked_at` | One-way. Trigger blocks reactivation. Idempotent revoke action. |
| `expires_at` | Null or future; max 1 year from create/update. Presets: never, 24h, 7d, 30d, custom. |
| Prefer revoke | Rows are not deleted by default (cascade only if the version is deleted). |

## PDF permission

`allow_pdf_download` (default true). When false, the public page hides “PDF İndir”
and `consume_public_report_pdf_share` returns empty. Management UI may show a
distinct “PDF kapalı” message; public viewers still get the generic unavailable
copy when the link itself is dead.

## Public route

| Path | Auth | Data |
|------|------|------|
| `/r/[token]` | None | `resolve_public_report_share` → snapshot only |
| Layout | `(public-report)` — no management nav | |

- `force-dynamic`, `revalidate = 0`
- `Cache-Control: private, no-store` (proxy)
- Robots: noindex, nofollow, noarchive
- Invalid / revoked / expired → same message:
  “Bu rapor bağlantısı geçersiz veya artık kullanılamıyor.”

## Public PDF route

```
POST /api/public/reports/[token]/pdf
  1. consume_public_report_pdf_share(raw)   ← increments access once
  2. issue_public_report_print_token(hash) ← short-lived report_export_tokens row
  3. Puppeteer → existing /print?token=…   ← consume_report_export_token (no share increment)
```

Headers: `application/pdf`, `Content-Disposition: attachment`,
`Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`.

No authenticated export token from the share creator’s session is required.
The public share token is never passed into Puppeteer logs.

## Access-count semantics

| Event | Increments? |
|-------|-------------|
| SSR `resolve_public_report_share` | No |
| `generateMetadata` | No (static title only) |
| Client beacon `POST .../access` with fresh nonce | Yes, once per nonce |
| Duplicate beacon (same share + nonce) | No (unique constraint) |
| `POST .../pdf` via `consume_public_report_pdf_share` | Yes, once |
| Print route / export token consume | No |

Browser prefetch of GET `/r/...` does not call the access beacon. Prefetch of
GET cannot hit the PDF or access routes (POST only).

## Management workflow

1. Report history or historical report → **Paylaşım Linki Oluştur**
2. Choose expiry, PDF permission, optional label
3. Copy URL once (warning: cannot be shown again)
4. **Paylaşım Linkleri** lists status, access count, last access, revoke

Feature code: `features/public-reports/*`.

## Security model

- Immutable versions only; no live queries on public routes (including video thumbnails — snapshot `thumbnail` only; expired CDN covers fall back in the browser without mutating the snapshot; see [video-thumbnail-reliability.md](./video-thumbnail-reliability.md))
- No service-role in browser; anon executes only security-definer RPCs
- No host-header trust for absolute URLs (`getPublicReportOrigin()` /
  `PUBLIC_REPORT_URL`, falling back to `APP_URL`)
- No open redirects; print navigation same-origin only
- No share enumeration (empty RPC result for all failures)
- Best-effort in-memory rate limit on public PDF/access (not cross-instance)
- External report links keep existing allowlist helpers
- Public routes cannot create/update/revoke shares

## Lost-link behavior

Create a new share for the same version. Old revoked/expired links stay dead.
There is no “regenerate URL” for the same raw token.

## Cache & robots

- No static generation, no ISR, no public CDN caching
- `X-Robots-Tag: noindex, nofollow, noarchive`
- Do not put raw tokens in analytics or error breadcrumbs

## Migration

```bash
npx supabase migration up
# or
npx supabase db push   # only when you intend to apply locally/remotely
```

File: `supabase/migrations/20260805280000_public_report_shares.sql`

Do not apply remotely until you are ready.

## Environment

```
APP_URL=https://app.befluencer.co
PUBLIC_REPORT_URL=https://reports.befluencer.co
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

Locally both origins may be `http://localhost:3000`. See
[platform-architecture.md](./platform-architecture.md).

## Future (not in this phase)

- Password-protected shares
- Custom domains
- Email delivery of the link
- Social previews with sensitive data (avoid by default)
- Public live reports (explicitly out of scope)

## Tests

```bash
npx tsx --test features/public-reports/public-reports.test.ts
```
