# TikTok Automatic Sync

Phase 5 adds manual TikTok video synchronization through a provider adapter. Instagram and YouTube remain manual-only in this phase.

## Architecture

```
Internal UI (Sync buttons)
        ↓
features/sync/actions.ts (server actions)
        ↓
features/sync/services/sync-tiktok-video.ts
        ↓
TikTokMetricsProvider interface
        ↓
ApifyTikTokProvider (lib/providers/tiktok/apify-provider.ts)
        ↓
Apify HTTP API (run-sync-get-dataset-items)
```

Application code depends on `TikTokMetricsProvider`, not Apify directly. Provider-specific parsing lives in `parse-apify-item.ts`. Video cover selection and sync preservation rules live in `select-video-thumbnail.ts` — see [video-thumbnail-reliability.md](./video-thumbnail-reliability.md).

## Environment variables

Server-only (never prefix with `NEXT_PUBLIC_`):

| Variable | Purpose |
|----------|---------|
| `APIFY_API_TOKEN` | Apify API token |
| `APIFY_TIKTOK_ACTOR_ID` | Default actor ID or `username~actor-name` slug |
| `APIFY_TIKTOK_VIDEO_ACTOR_ID` | Optional dedicated video actor (falls back to `APIFY_TIKTOK_ACTOR_ID`) |
| `APIFY_TIKTOK_CREATOR_ACTOR_ID` | Optional dedicated creator actor |
| `APIFY_TIKTOK_SOUND_ACTOR_ID` | Optional dedicated sound actor |

Validated in `lib/env.server.ts` using the `server-only` package. Client bundles must not import this module.

Public client-safe variables remain in `lib/env.ts`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

If sync is invoked without Apify configuration, the UI shows a Turkish configuration error.

## Apify configuration

1. Create or select a TikTok video scraper actor on Apify.
2. Copy the actor ID into `APIFY_TIKTOK_ACTOR_ID`.
3. Add `APIFY_API_TOKEN` from Apify account settings.

### Video metrics run path

Video metrics use the async Apify runs API (start + wait/poll + dataset), not
`run-sync-get-dataset-items`, so a finished run id is available when the dataset
is empty:

1. `POST /v2/acts/{actorId}/runs?waitForFinish=120`
2. Poll until a terminal status when needed
3. `GET /v2/datasets/{datasetId}/items`
4. On SUCCEEDED with zero usable items: best-effort `GET /v2/actor-runs/{runId}/log`

Input (batched when multiple URLs are eligible):

```json
{
  "postURLs": [
    "https://www.tiktok.com/@user/video/123...",
    "https://www.tiktok.com/@user/video/456..."
  ],
  "resultsPerPage": 2
}
```

Batch size / concurrency / freshness windows live in
`lib/providers/tiktok/sync-policy.ts`. Results are rematched by
`platform_video_id` or normalized URL — never by dataset order.

Timeout is capped at 120 seconds server-side.

Sound sync still uses `run-sync-get-dataset-items` (one music URL per run).

### Cost + speed (Phase 27)

- **Stale-only sync**: skip entities within freshness windows unless `force`
- **Manual cooldown**: recent successful single-item sync shows “Yakın zamanda güncellendi”
- **Request dedupe**: same URL / video id / username scraped once per operation
- **Global planner**: “Tüm TikTok Verilerini Güncelle” builds a plan before Apify spend
- **Observability**: internal logs with provider run counts (no tokens / payloads)

### Login-required / sensitive content

Some TikTok posts are invisible to anonymous scrapers. Clockworks-style actors
often finish as `SUCCEEDED` with an empty dataset and a log line such as:

> The video is with sensitive content. The scraper is not able to see posts that require login, skipping

Detection:

- Prefer matching known phrases in the Apify run log
- Also scan sparse dataset error/skip markers when present
- **Conservative fallback:** if the log cannot be read or does not match, keep
  `empty_result` — do **not** invent `login_required_content` without evidence

`login_required_content` is distinct from temporary upstream failures, malformed
URLs, and deleted/unavailable videos. The anonymous actor is **not** automatically
retried for that classification (no second paid run in the same request).

Apify only retains the trailing ~5M characters of a run log, and actor wording can
change — treat log parsing as best-effort.

## URL validation

Approved hostnames only:

- `www.tiktok.com`, `tiktok.com`, `m.tiktok.com`
- `vm.tiktok.com`, `vt.tiktok.com` (short links preserved for provider resolution)

Rules:

- HTTP/HTTPS only
- Query parameters stripped on canonical URLs
- Video ID extracted when present in path
- No arbitrary redirect fetching
- Invalid URLs return Turkish validation errors

## Sync lifecycle

### Single video (`syncTikTokVideo`)

1. Verify authenticated user (RLS via publishable Supabase key)
2. Load video and confirm TikTok + not unavailable
3. Insert `sync_jobs` row (`tiktok_video_sync`, `running`)
4. Call provider with stored video URL
5. Optionally append `video_metric_snapshots` row
6. Update `videos` metadata and `sync_status = success`
   - `thumbnail_url` is updated only when the provider returns a validated cover URL
   - Missing/invalid provider thumbnails preserve the existing non-empty URL
7. Fill missing creator fields only (never overwrite manual values)
8. Mark job success and revalidate pages

On failure: `videos.sync_status = failed`, job marked failed with sanitized Turkish message. Existing metric snapshots and `thumbnail_url` are preserved.

### Campaign bulk (`syncCampaignTikTokVideos`)

- Loads active TikTok videos for the campaign
- Processes with concurrency limit of 2
- Continues when individual videos fail
- One `sync_jobs` row per video
- Returns `{ total, success, failed, skipped }`

## Snapshot append rules

Automatic sync uses the same `video_metric_snapshots` table as manual entry.

A new snapshot is appended only when:

1. No previous snapshot exists, **or**
2. At least one metric changed, **or**
3. The latest snapshot is older than 6 hours

Snapshots are append-only. `captured_at` uses server time. Unique index on `(video_id, captured_at)` prevents duplicates; one retry uses a +1s timestamp adjustment.

Engagement calculations continue using existing helpers in `features/metrics/calculations.ts`.

## Failure handling

Provider errors are mapped to typed codes:

- `invalid_url`
- `unavailable_video`
- `login_required_content`
- `auth_failure`
- `rate_limit`
- `empty_result`
- `malformed_result`
- `upstream_failure`
- `not_configured`

Secrets and raw provider payloads are never stored in `sync_jobs` or returned to the client.

## Manual fallback

Manual metric entry (`/campaigns/[id]/videos/[videoId]/metrics/new`) remains available. Provider sync and manual snapshots coexist.

## Creator profile sync

Creator profile and follower sync reuses this same Apify infrastructure via `TikTokCreatorProvider.fetchCreatorProfile`. See [creator-profile-sync.md](./creator-profile-sync.md).

Optional env when the video actor cannot scrape profiles:

```
APIFY_TIKTOK_CREATOR_ACTOR_ID=...
```

Video sync still only *fills* missing creator fields. Dedicated creator sync *overwrites* `follower_count` / `profile_url` and appends `creator_metric_snapshots`.

## Sound usage sync

Campaign sound usage sync uses `TikTokSoundProvider.fetchSoundProfile` and appends `sound_metric_snapshots` (`source = apify`). Manual sound entry remains available (`source = manual`).

See [tiktok-sound-sync.md](./tiktok-sound-sync.md).

Optional dedicated sound actor:

```
APIFY_TIKTOK_SOUND_ACTOR_ID=clockworks~tiktok-sound-scraper
```

## Limitations (current phase)

- Manual sync only — no cron scheduling yet
- TikTok only — Instagram/YouTube manual
- Saves may be `0` when the provider does not expose collect/favorite counts
- Real Apify calls are not made during build or unit tests

## Future cron

Scheduled jobs call the same `syncTikTokVideo` / `syncCampaignTikTokVideos`,
`syncTikTokCreator` / `syncCampaignTikTokCreators`, and `syncTikTokSound`
services through the Phase 12 orchestrator. See [scheduled-sync.md](./scheduled-sync.md).

## UI

Internal management only:

- Video detail: **TikTok Verisini Güncelle**
- Campaign videos section: **Tüm TikTok Videolarını Güncelle**
- Creator detail / list / campaign creator row: **TikTok Profilini Güncelle**
- Campaign creators section: **Tüm TikTok Profillerini Güncelle**
- Campaign **TikTok Ses Takibi**: **Sesi Güncelle**
- Settings: **Tüm TikTok Verilerini Güncelle** + `/settings/sync` history
- Campaign page: sync history (latest 20 jobs)

Public report page is unchanged.

## Testing

Parser fixtures:

- `lib/providers/tiktok/__fixtures__/apify-responses.ts` (video)
- `lib/providers/tiktok/__fixtures__/apify-creator-responses.ts` (creator)

```bash
npx tsx --test lib/providers/tiktok/parse-apify-item.test.ts
npx tsx --test lib/providers/tiktok/parse-apify-creator.test.ts
```
