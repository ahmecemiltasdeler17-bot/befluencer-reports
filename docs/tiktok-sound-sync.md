# TikTok Sound Usage Sync

Phase 11 adds manual one-click sync of a campaign’s TikTok sound (music) usage count. Manual snapshot entry remains available. Scheduled full sync is covered in [scheduled-sync.md](./scheduled-sync.md).

## Architecture

```
Internal UI (“Sesi Güncelle”)
        ↓
features/sound-sync/actions.ts
        ↓
features/sound-sync/services/sync-tiktok-sound.ts
        ↓
TikTokSoundProvider (lib/providers/tiktok/types.ts)
        ↓
ApifyTikTokProvider.fetchSoundProfile
        ↓
parseApifyTikTokSoundDataset
        ↓
sound_metric_snapshots (append-only) + campaigns sound metadata
```

Application services depend on `TikTokSoundProvider`, never Apify directly.

## Environment

| Variable | Required | Purpose |
|----------|----------|---------|
| `APIFY_API_TOKEN` | yes | Apify API token (server-only) |
| `APIFY_TIKTOK_ACTOR_ID` | yes | Default actor; used when no sound actor is set |
| `APIFY_TIKTOK_SOUND_ACTOR_ID` | optional | Dedicated sound actor (e.g. `clockworks/tiktok-sound-scraper`) |
| `TIKTOK_SOUND_SYNC_DEBUG` | optional | `1` enables sanitized candidate diagnostics |

Never prefix these with `NEXT_PUBLIC_`. Tokens are never logged.

## Supported sound URL forms

Accepted:

- `https://www.tiktok.com/music/<slug>-<numericId>`
- `https://tiktok.com/music/...` / `m.tiktok.com/music/...`
- Short links `vm.tiktok.com` / `vt.tiktok.com` (resolved only inside Apify)

Rejected:

- Video URLs (`/@user/video/...`)
- Profile URLs (`/@user`)
- Unsafe schemes (`javascript:`, `data:`, protocol-relative `//…`)
- Arbitrary hosts

Tracking query params are stripped. Numeric sound IDs are parsed from the music slug when present.

## Provider strategy

Preferred input to Apify:

```json
{
  "musics": ["https://www.tiktok.com/music/<slug>-<id>"],
  "resultsPerPage": 1,
  "shouldDownloadCovers": false,
  "shouldDownloadVideos": false,
  "shouldDownloadSubtitles": false,
  "shouldDownloadSlideshowImages": false,
  "shouldDownloadAvatars": false,
  "shouldDownloadMusicCovers": false,
  "searchQueries": []
}
```

Actor selection:

1. `APIFY_TIKTOK_SOUND_ACTOR_ID` when set (recommended: dedicated sound scraper)
2. Otherwise `APIFY_TIKTOK_ACTOR_ID` with the same `musics` input

### Explicit usage count requirement

Total usage **must** come from an explicit field, for example:

- `searchMusic.videos` (clockworks sound scraper page total, often compact like `"80.3K"`)
- `musicMeta.videoCount` / `musicMeta.usageCount` / `musicMeta.totalVideos`
- Dedicated sound object `videoCount` / `usageCount`

Never inferred from:

- dataset item count
- pagination length
- video `playCount` / `diggCount` / `shareCount`
- campaign-tracked video count

If no explicit total is present, sync fails with `sound_usage_unavailable`.

### Candidate selection

`selectSoundProfileCandidate` priority:

1. Dedicated sound/music object with exact sound ID match
2. Dedicated sound object when request has no parseable ID and canonical URL matches
3. Video row `musicMeta` with exact sound ID match
4. Otherwise `sound_identity_mismatch` or `sound_usage_unavailable`

`dataset[0]` is never trusted blindly.

## Snapshot append rules

A new `sound_metric_snapshots` row is inserted when:

- no previous snapshot exists, or
- usage count changed, or
- latest snapshot is at least 24 hours old

Source values:

| Source | Meaning |
|--------|---------|
| `manual` | Form entry (`Ses Kullanımı Ekle`) |
| `apify` | Provider sync |

Both sources feed live report charts and generated report versions. Manual rows are never overwritten.

On `unique(campaign_id, captured_at)` collision, insert retries once with `captured_at + 1s`.

## Growth formulas

```
currentUsage   = latest.usage_count
initialUsage   = earliest.usage_count
absoluteGrowth = currentUsage - initialUsage
growthPercentage = initialUsage > 0 ? absoluteGrowth / initialUsage * 100 : null
```

No rounding inside calculation helpers. Negative growth is valid.

## Campaign fields

Reuses existing `campaigns.sound_url` as the canonical TikTok music URL.

Added:

- `tiktok_sound_id`, `tiktok_sound_title`, `tiktok_sound_author`
- `sound_last_synced_at`, `sound_sync_status`, `sound_sync_error`

Failed syncs set `sound_sync_status = failed` and preserve previous metadata / snapshots.

## Live report

`getCampaignReportData` already loads `sound_metric_snapshots` ascending. `buildSoundGrowthData` maps them into the approved sound-growth section. No provider call during report render.

## Historical reports & PDF

Generated report versions freeze `soundGrowth` (timeline + usage) at generation time. Historical pages and PDF export read only the stored snapshot — never live sound rows and never Apify.

## Current limitations

- Dedicated sound media persistence is out of scope
- Public report sharing is out of scope
- Cover/CDN URLs are not copied into storage

## Manual test steps

1. Apply migration `20260805260000_tiktok_sound_sync.sql` locally.
2. Set `APIFY_API_TOKEN` + `APIFY_TIKTOK_ACTOR_ID` (optionally `APIFY_TIKTOK_SOUND_ACTOR_ID`).
3. Open a campaign → **TikTok Ses Takibi**.
4. Save a `/music/` sound URL.
5. Click **Sesi Güncelle**.
6. Confirm usage summary, history row with source `Apify`, and sync job `tiktok_sound_sync`.
7. Open live report → sound growth uses real snapshots.
8. Generate a report version → sound series frozen; PDF matches without provider calls.
