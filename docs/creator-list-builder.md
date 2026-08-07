# Creator List Builder

Phase 18 adds curated creator selections for internal pitching and client sharing. Lists are **not** campaign reports and **not** immutable snapshots.

## Workflow

1. Filter creators on `/creators` (platform, category, follower range, sync status, campaign assignment, avatar, search).
2. Select creators with checkboxes (max 500; selection stays stable when filters change — hidden rows are not auto-selected).
3. **Liste Oluştur** → name + optional public description + internal notes.
4. Manage at `/creator-lists` and `/creator-lists/[id]`.
5. Export CSV, share a public link, or hand off to a campaign.

## Data model

| Table | Purpose |
|-------|---------|
| `creator_lists` | Named list metadata (`draft` / `ready` / `archived`) |
| `creator_list_items` | Membership + position + public/internal notes |
| `creator_list_shares` | SHA-256 token hashes, expiry, revoke, CSV flag |
| `creator_list_share_access_events` | Idempotent access nonces |

Migrations:

- `supabase/migrations/20260805310000_creator_lists.sql` — tables + initial RPCs
- `supabase/migrations/20260805320000_fix_creator_list_public_share.sql` —
  public share digest/`search_path` fix (same pattern as public report shares)

Apply before using the feature against a linked project:

```bash
npx supabase db push
```

If `20260805310000` is missing remotely, create-list fails with a schema-cache /
relation-missing error (`PGRST205` / `42P01`). In development the UI maps that
to an explicit “migration required” message.

If `20260805320000` is missing, share rows can insert successfully but
`/lists/<token>` always shows unavailable: anon RPC cannot resolve
`digest()` (`SQLSTATE 42883`) when `search_path` omits `extensions`.

## Internal vs public notes

| Field | Internal UI | Public share / public CSV |
|-------|-------------|---------------------------|
| `creator_lists.description` | yes | yes |
| `creator_lists.internal_notes` | yes | **never** |
| `creator_list_items.public_note` | yes | yes |
| `creator_list_items.internal_note` | yes | **never** |
| fees / contact / sync errors | n/a | **never** |

## Live public data (v1)

Public shares resolve **current** creator public fields at access time:

- Membership is fixed by `creator_list_items`
- follower count / avatar / display name may change after TikTok sync
- revoked or expired links stop immediately
- this is **not** an immutable campaign report

Future optional phase: freeze a creator-list snapshot at share creation.

## Public token lifecycle

- 32 random bytes → 64 hex raw token (shown once)
- store SHA-256 only
- Node: `createHash("sha256").update(rawToken, "utf8").digest("hex")`
- Postgres: `encode(extensions.digest(convert_to(token,'UTF8'),'sha256'),'hex')`
- URL: `{PUBLIC_REPORT_URL}/lists/<raw-token>` via `getPublicReportOrigin()` (falls back to `APP_URL`; never Host headers)
- SSR: `resolve_public_creator_list` (no access increment)
- Client beacon: `consume_public_creator_list` with nonce
- CSV: `consume_public_creator_list_csv` (requires `allow_csv_download`)
- Public RPCs are `SECURITY DEFINER` with `search_path = public, extensions, pg_temp` and executable by `anon`

## CSV

Authenticated: `GET /api/creator-lists/[id]/csv`  
Public: `GET|POST /api/public/creator-lists/[token]/csv`

- UTF-8 BOM
- semicolon delimiter (Excel TR-friendly)
- formula-injection prefix for `= + - @`
- filename: `befluencer-creator-listesi-<slug>.csv`
- no IDs, fees, or internal notes

## Campaign handoff

**Kampanyaya Ekle** assigns only missing creators to `campaign_creators` with default empty campaign fields. Existing rows (including fees/notes) are left untouched.

## Future (out of scope)

- creator fees / role-based pricing visibility
- proposal PDF
- frozen creator-list snapshots
- email delivery
