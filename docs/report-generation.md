# Versioned Report Generation

Phase 7 adds immutable, versioned campaign report snapshots generated from live data.

## Live report vs generated report

| Concept | Route | Data source |
|---------|-------|-------------|
| **Live report** | `/campaigns/[id]/report` | Current Supabase tables |
| **Generated report version** | `/campaigns/[id]/reports/[versionId]` | `report_versions.snapshot` JSON only |

The mock preview at `/` remains unchanged.

## Report series vs report version

- **`reports`** — one logical report series per campaign (unique `campaign_id`)
- **`report_versions`** — immutable snapshots with incrementing `version_number`

## Immutable snapshot strategy

Snapshot validation runs in two stages, because version number, version id and
generation time only exist after the `generating` row is inserted. Placeholder
values are never used to satisfy validation.

| Stage | Schema | Contains |
|-------|--------|----------|
| A — content snapshot | `reportContentSnapshotSchema` | `reportContext` (report id, report number, source sync time), `sourceCounts`, `data` |
| B — finalized snapshot | `reportSnapshotSchema` | `reportMetadata` (context + version number, version id, generated at/by), `sourceCounts`, `data` |

When a version is generated:

1. Live data is loaded via `getCampaignReportData()`
2. Normalized with `normalizeReportSnapshotInput()` and validated as a content
   snapshot via `buildReportContentSnapshot()` — before any row exists
3. Hashed for duplicate detection
4. A `generating` row is inserted, allocating the version number
5. Real version metadata is attached and re-validated via `finalizeReportSnapshot()`
6. Stored in `report_versions.snapshot` with status `ready`

A validation failure in step 2 returns a controlled failed result without
creating a row. A failure in step 5 marks the existing row `failed`, so no row
is ever stranded in `generating`. Zod issues are logged server-side in
development as paths, messages and codes only — never snapshot values — and the
browser only receives a sanitized Turkish message.

Historical pages **never** query live campaign/creator/video/metric tables for rendering.

### Normalization

`normalizeReportSnapshotInput()` runs before every validation and:

- drops `undefined` object properties so optional fields stay absent
- preserves `null` where the schema allows it (e.g. `growthSinceStart`)
- converts `Date` values to ISO strings
- rejects `BigInt`, `NaN`, `Infinity`, functions and symbols
- keeps arrays as arrays and rejects `undefined` array entries

It never invents metric values. Only genuinely optional display sections
(summary text, empty sound growth) get explicit empty defaults.

Sound growth (`data.soundGrowth`) captures the sound usage series available at
generation time (manual + Apify snapshots). Optional fields such as
`absoluteGrowth`, `growthPercentage`, `soundId`, `soundAuthor`, and `soundUrl`
are backwards-compatible — older snapshots without them still validate. Historical
renders never re-query live `sound_metric_snapshots`. See
[tiktok-sound-sync.md](./tiktok-sound-sync.md).

### Link fields and schema compatibility

Snapshots carry the URLs needed to make a historical report interactive:

| Field | Location | Type |
|-------|----------|------|
| `platform` | `data.creators[]` | `Platform` (optional) |
| `profileUrl` | `data.creators[]` | `string \| null` (optional) |
| `creatorProfileUrl` | `data.videos[]`, `topVideo`, `featuredVideo` | `string \| null` (optional) |
| `url` | `data.videos[]` | `string` (always present) |
| `thumbnail` | `data.videos[]` | `string`, empty when unavailable |

`thumbnail` freezes `videos.thumbnail_url` at generation time. Historical
renders never re-read live video rows for a newer CDN cover. Empty strings
remain valid for older snapshots and degrade to the branded poster. See
[video-thumbnail-reliability.md](./video-thumbnail-reliability.md).

These fields are **optional**, so `snapshotSchemaVersion` stayed at `1` and every
snapshot written before they existed still validates and renders. Old versions
are not backfilled: a historical report links only what its own snapshot
contains, and the live database is never queried to enrich it. In practice
creator links still resolve on old snapshots, because the deterministic fallback
URL is derived from the stored handle. See
[report-interactions.md](./report-interactions.md).

## Content hash duplicate prevention

SHA-256 hash of canonical JSON over `snapshotSchemaVersion`, `reportContext`,
`sourceCounts` and `data`, which excludes:

- `generatedAt`
- `generatedBy`
- `versionNumber`
- `reportVersionId`

The content snapshot and its finalized snapshot hash identically.

If the latest ready/archived version has the same hash, generation returns:

> Rapor verilerinde değişiklik olmadığı için yeni sürüm oluşturulmadı.

## Generation lifecycle

```
generating → ready
generating → failed
ready → archived
```

- Failed rows remain in history; retry creates a **new** version attempt
- Archived versions remain viewable and comparable
- No permanent delete UI

## Database immutability trigger

`guard_report_version_immutability()` blocks changes to snapshot content after status becomes `ready` or `archived`.

Migration: `supabase/migrations/20260805230000_versioned_report_snapshots.sql`

## Routes

| Route | Purpose |
|-------|---------|
| `/campaigns/[id]/report` | Live report |
| `/campaigns/[id]/reports` | Version history (management) |
| `/campaigns/[id]/reports/[versionId]` | Historical report view |
| `/campaigns/[id]/reports/[versionId]/print` | Internal PDF print layout |
| `/campaigns/[id]/reports/compare?from=&to=` | Version comparison |

## PDF export

Ready and archived versions can be downloaded as a PDF rendered from the stored
snapshot alone. The live report has no PDF export, because a client-facing
artifact must be reproducible.

See [pdf-export.md](./pdf-export.md).

## Comparison rules

Compares snapshot JSON only — no live queries. Shows old value, new value, absolute delta, percent delta (null when divide-by-zero).

## Creator sync and immutability

Creator profile sync updates live `creators.follower_count` (and related fields) and revalidates live report routes. It never rewrites `report_versions.snapshot`. Capturing new follower data in a client-facing artifact requires generating a new report version. See [creator-profile-sync.md](./creator-profile-sync.md).

## Public sharing

Public links (`/r/<token>`) always target one `report_versions` row — never the
live report. See [public-report-sharing.md](./public-report-sharing.md).

Creating a share does **not** generate a new version. Revoking a share does not
change the snapshot.

## Future reuse

- PDF export renders a specific `report_versions` row (done)
- Public share links target an immutable version (done)
- Scheduled generation will call `generateCampaignReportVersion()`
- Optional creator growth section in the approved report UI (roadmap)

## Testing

```bash
npx tsx --test features/report-generation/report-generation.test.ts
npx tsx --test features/reports/report-interactions.test.tsx
```

The interaction suite asserts that a snapshot written before Phase 9 still
validates without the link fields, and that a current snapshot preserves them.

## Apply migration

```bash
supabase db push
```

Or run the SQL file manually in Supabase Dashboard SQL editor.

Do not push remotely unless you intend to apply schema changes.
