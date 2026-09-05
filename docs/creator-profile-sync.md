# Creator Profile and Follower Sync

Phase 10 adds manual one-click TikTok creator profile refresh. An authenticated internal user can update follower count, display name, avatar, and profile URL from Apify, and keep an append-only history of follower counts for growth measurement.

Instagram and YouTube creators remain manual. Sound usage sync is a separate phase.
Scheduled full TikTok sync (including creators) is documented in [scheduled-sync.md](./scheduled-sync.md).

## Architecture

```
SyncCreatorButton / SyncCampaignCreatorsButton
        ↓
syncTikTokCreatorAction / syncCampaignTikTokCreatorsAction
        ↓
syncTikTokCreator / syncCampaignTikTokCreators
        ↓
TikTokCreatorProvider.fetchCreatorProfile()   ← Apify adapter
        ↓
creators (current profile) + creator_metric_snapshots (history)
        ↓
revalidatePath: /creators, creator detail, assigned campaigns, live reports
```

Presentation components never call Apify. The application sync service depends on `TikTokCreatorProvider`, not on Apify types.

| Module | Role |
|--------|------|
| `lib/providers/tiktok/types.ts` | `TikTokCreatorProfile`, `TikTokCreatorProvider` |
| `lib/providers/tiktok/profile-url.ts` | Username / profile URL normalization |
| `lib/providers/tiktok/parse-apify-creator.ts` | Dataset → normalized profile |
| `lib/providers/tiktok/apify-provider.ts` | Apify HTTP adapter |
| `features/creator-sync/services/creator-sync-core.ts` | Pure orchestration (testable ports) |
| `features/creator-sync/services/sync-tiktok-creator.ts` | Supabase port + revalidation |
| `features/creator-sync/calculations.ts` | Follower growth formulas |
| `features/creator-sync/queries.ts` | Snapshot and summary reads |
| `features/creator-sync/actions.ts` | Server actions |

## Single creator sync lifecycle

`syncTikTokCreator(creatorId)`:

1. Verify authenticated session (publishable Supabase client + RLS).
2. Load creator; reject non-TikTok platforms with a skip outcome.
3. Normalize username / profile URL via `assertApprovedTikTokProfile`.
4. Insert `sync_jobs` with `job_type = tiktok_creator_sync`, `status = running`, `creator_id` set.
5. Call `provider.fetchCreatorProfile({ username })`.
6. Verify returned username matches the requested creator.
7. Append `creator_metric_snapshots` when append rules say so (below).
8. Update `creators`:
   - `follower_count` always from a successful result
   - `display_name` / `avatar_url` only when the provider returned a non-empty value
   - `profile_url` to the normalized verified URL
   - `last_synced_at = now`, `sync_status = success`
9. When `category_source = auto`, recalculate `category` from the synced
   follower count (`nano` / `micro` / `macro` / `mega`, or null below 1k).
   When `category_source = manual`, never overwrite `category`.
   Never overwrite campaign fee, agreed content count, or notes.
10. Mark the job success and revalidate creator + assigned campaign paths (including live reports).

On failure:

- `creators.sync_status = failed`
- previous follower count, display name and avatar stay intact
- job stores a sanitized Turkish error
- snapshots are never deleted or rewritten
- raw provider payloads and secrets never reach the UI or logs

## Snapshot append rules

A new `creator_metric_snapshots` row is inserted when:

- no previous snapshot exists, or
- follower count changed, or
- another optional metric (`following_count`, `total_likes`, `video_count`) changed, or
- the previous snapshot is older than **24 hours**

Unchanged recent profiles skip the insert so the history stays meaningful. Collision on `unique (creator_id, captured_at)` retries once with `+1 second`.

## Bulk campaign sync

`syncCampaignTikTokCreators(campaignId)`:

- Validates the campaign exists.
- Loads unique assigned creators (deduplicates by creator id).
- Syncs TikTok creators only; non-TikTok count as `skipped`.
- Maximum concurrency: **2**.
- Continues after individual failures.
- One `sync_jobs` row per creator.
- Does not trigger video sync.
- Returns `{ total, success, failed, skipped, message }` with a Turkish summary.

## Follower growth formulas

Pure helpers in `features/creator-sync/calculations.ts` (no rounding):

| Value | Definition |
|-------|------------|
| `currentFollowers` | Latest snapshot `follower_count`, else `creators.follower_count` |
| `initialFollowers` | Earliest snapshot `follower_count` |
| `absoluteGrowth` | `currentFollowers - initialFollowers` |
| `growthPercentage` | `absoluteGrowth / initialFollowers * 100` when initial > 0, else `null` |
| `latestDelta` | Latest − previous snapshot |
| `latestDeltaPercentage` | `latestDelta / previous * 100` when previous > 0, else `null` |
| `campaignCreatorAudience` | Sum of current followers for unique assigned creators |
| `campaignAudienceGrowth` | Sum of current − sum of earliest available, per unique creator |

Negative growth is valid. Follower count is never labeled as reach.

### Where each surface reads growth from

| Surface | Read path |
|---------|-----------|
| Creator detail | `listCreatorMetricSnapshots` → full series → `buildCreatorMetricSummary` / `buildCreatorMetricHistory` |
| Creator list, campaign creator summaries | `creator_growth_bounds` RPC → earliest + latest row per creator → `buildCreatorGrowthFromBounds` |

A multi-creator surface **must not** read the full snapshot series. Doing so hits
PostgREST's default row cap, which truncates silently and — because rows arrive
ordered by capture time — keeps each creator's *oldest* snapshots. The list then
reports a months-old follower count as current and sorts by it, while the detail
page (one creator, well under the cap) shows the right number. That is what
`20260904190000_creator_growth_bounds.sql` fixed; both paths produce identical
figures for the same history, asserted in `calculations.test.ts`.

## Creator versus campaign-specific fields

| Field | Owner | Sync may change? |
|-------|-------|------------------|
| `follower_count`, `display_name`, `avatar_url`, `profile_url` | `creators` | Yes (on success) |
| `category` | `creators` | Only when `category_source = auto` |
| `fee`, `agreed_content_count`, `notes` | `campaign_creators` | **Never** |

Manual creator editing remains available at all times.

## Provider adapter

Creator sync uses the same Apify infrastructure as video sync:

| Variable | Required | Purpose |
|----------|----------|---------|
| `APIFY_API_TOKEN` | yes | Server-only Apify token |
| `APIFY_TIKTOK_ACTOR_ID` | yes | Default actor (video + often profile) |
| `APIFY_TIKTOK_CREATOR_ACTOR_ID` | no | Dedicated creator actor when the video actor cannot scrape profiles |

`getTikTokCreatorActorId()` returns the dedicated actor when set; otherwise the video actor is used. Build and tests never call Apify.

Input accepts `@username`, `username`, or `https://www.tiktok.com/@username`. Only approved TikTok profile hosts are accepted; video URLs and arbitrary domains are rejected. The deterministic profile URL is always `https://www.tiktok.com/@username`.

`followerCount` is required. Missing identity or follower count is a `malformed_result`. Private / not-found profiles map to typed errors. A returned username that does not match the requested creator is rejected (`username_mismatch`).

### Candidate selection and metric safety

`clockworks~tiktok-scraper` typically returns **video rows** for a profile scrape. The parser never trusts `dataset[0]`. It selects, in order:

1. A dedicated profile row matching the requested username
2. A top-level creator/stats row matching the username
3. A video row whose `author` / `authorMeta` matches the username
4. Otherwise `username_mismatch` — no creator update, no snapshot

Creator metrics are read from author-level paths only (`authorStats` → `authorMeta` → top-level profile fields). Video engagement fields (`diggCount`, `playCount`, `shareCount`, `commentCount`, `collectCount`) and dataset length are never mapped to creator totals.

Counts are parsed by `parseProviderCount`, which supports grouped (`773,000` / `773.000`) and compact (`773K` / `1.2M`) forms and rejects percentages, negatives and ambiguous fractions.

### Incorrect historical snapshots

Snapshots written by the faulty parser are not deleted automatically. After deploying this fix:

1. Open the creator detail page
2. Delete incorrect follower history rows (confirmation required)
3. Run **TikTok Profilini Güncelle** again — a corrected snapshot is appended because metrics changed

Historical report versions are never rewritten.

## sync_jobs target semantics

| `job_type` | Target columns |
|------------|----------------|
| `tiktok_video_sync` | `campaign_id` + `video_id` |
| `tiktok_creator_sync` | `creator_id` (`campaign_id` stays null — a creator is global) |

`job_type` has no database check constraint, so new types need no schema change. Existing video sync rows remain valid.

## Management UI

| Surface | Action |
|---------|--------|
| Creator detail | **TikTok Profilini Güncelle**, follower summary, history table with delete |
| Creator list | Growth, sync status, last sync, compact **Güncelle** for TikTok |
| Campaign creators | Per-row **Güncelle**, **Tüm TikTok Profillerini Güncelle** |

Non-TikTok profiles show: *Otomatik profil güncelleme şu anda yalnızca TikTok için kullanılabilir.*

Opening a page never triggers a provider call. Buttons disable while pending.

## Live report effect

Live reports read `creators.follower_count` into leaderboard / contribution / “Takipçi Ağı”. After a successful sync, those paths are revalidated so the live report refreshes.

Generated historical report versions are **immutable**. Creator sync does not rewrite `report_versions.snapshot`. Capture new follower data by generating a new report version.

## Historical and PDF safety

- Existing immutable snapshots stay unchanged.
- Historical reports and PDF export render only from stored snapshots.
- Creator sync never enriches historical versions from live tables.
- No provider calls during PDF generation.

## Avatar URL reliability

Provider avatar CDN URLs may expire. `SafeAvatar` / `CreatorAvatar` fall back to initials. A missing avatar does not fail the sync. Failed URLs are not retried during one render. Future media persistence in Supabase Storage is a separate roadmap item.

## Security

- Provider calls are server-side only.
- `APIFY_API_TOKEN` never enters client bundles.
- No Supabase service-role key.
- Auth required for every sync and delete action.
- Creator UUID, platform and username validated before the provider call.
- Profile URLs restricted to approved TikTok hosts.
- Upstream errors sanitized to Turkish UI messages.
- Tokens, raw provider payloads and full URL query strings are not logged.
- Bounded Apify request timeout (same as video sync).
- RLS enforced; `creator_metric_snapshots` has no UPDATE privilege.

## Migration

```bash
npx supabase db push
```

Or run `supabase/migrations/20260805250000_creator_profile_snapshots.sql` in the Supabase SQL editor.

Do not push remotely unless you intend to apply schema changes.

## Environment

Reuse:

```
APIFY_API_TOKEN=...
APIFY_TIKTOK_ACTOR_ID=...
```

Optional, only when the video actor cannot scrape profiles:

```
APIFY_TIKTOK_CREATOR_ACTOR_ID=...
```

## Manual test steps

1. Apply the migration locally.
2. Confirm Apify env vars in `.env.local`.
3. `npm run dev`.
4. Open a TikTok creator detail page → **TikTok Profilini Güncelle**.
5. Confirm follower count, display name, avatar and profile URL refresh; a history row appears when append rules apply.
6. Sync again immediately with unchanged metrics — no new snapshot (unless > 24h old).
7. From `/creators`, use compact **Güncelle** and confirm growth / sync status cells.
8. From a campaign with TikTok creators, use per-row **Güncelle** and **Tüm TikTok Profillerini Güncelle**.
9. Sync a non-TikTok creator — expect the TikTok-only message; no provider call.
10. Force a failure (invalid username) — `sync_status = failed`, previous followers intact.
11. Open the live report for an assigned campaign — “Takipçi Ağı” reflects the new count.
12. Open an existing historical report version — values unchanged.
13. Manually edit category / campaign fee — sync must not overwrite manual
    categories (`category_source = manual`) or campaign fee fields.

## Testing

```bash
npx tsx --test lib/providers/tiktok/parse-apify-creator.test.ts
npx tsx --test features/creator-sync/calculations.test.ts
npx tsx --test features/creator-sync/creator-sync.test.ts
npx tsx --test features/creator-sync/report-compatibility.test.ts
```

Optional verbose candidate-shape diagnostics in development:

```
TIKTOK_CREATOR_SYNC_DEBUG=1
```

Logs top-level key names and identity flags only — never tokens, raw payloads or URL query strings.

No test calls real Apify, remote Supabase, or Chromium.

## Future work

- Scheduled creator sync (cron)
- Creator growth section inside the approved report UI
- Media persistence for avatars in Supabase Storage
- Instagram / YouTube creator providers
