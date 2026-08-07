# Live Campaign Report

Phase 6 binds the approved report UI to live Supabase campaign data at:

`/campaigns/[id]/report`

The mock design preview remains at `/` using `lib/mock-data.ts`.

Generated historical reports are separate — they render from immutable `report_versions.snapshot` JSON. See [report-generation.md](./report-generation.md).

## Architecture

```
Live report page (server)
        ↓
getCampaignReportData(campaignId)
        ↓
Parallel Supabase reads (campaign, videos, snapshots, sound snapshots, report)
        ↓
mapCampaignReportData()
        ↓
Approved report components (presentation only)
```

Presentation components never query Supabase directly. All aggregation happens server-side in `features/reports/`.

## Data loader

`getCampaignReportData(campaignId)`:

- Verifies authenticated user via publishable Supabase key + RLS
- Returns `notFound()` for invalid campaign IDs
- Excludes videos with `status = unavailable`
- Loads all metric snapshots for active videos in one query
- Maps rows into `CampaignReportData` (compatible with approved report components)

## Latest snapshot semantics

Headline KPIs use the **latest** `video_metric_snapshots` row per active video:

- Total views = sum of latest views
- Total engagement = sum(likes + comments + shares + saves)
- Engagement rate = total engagement / total views × 100

Videos without snapshots contribute zero to totals and appear with “Henüz metrik yok” in the gallery.

## Historical timeline algorithm

The performance trend chart uses a **cumulative campaign timeline**:

1. Collect distinct snapshot dates across all active videos
2. For each date, for each video, take the latest snapshot captured on or before that date
3. Sum views and engagement across videos
4. Do **not** sum every raw snapshot row (avoids double-counting)

Growth since campaign start compares current total views against the earliest timeline aggregate. Returns `null` when fewer than two timeline points exist — UI shows “Henüz karşılaştırma yok”.

## Creator contribution

Per assigned creator (from videos in campaign):

- Sum latest views across their active videos
- Contribution % = creator views / campaign total views
- Engagement rate from latest snapshots
- Sorted descending by views

Top creators feed:

- Creator Contribution section (top 4 + “Diğerleri”)
- Creator Leaderboard
- Avatar stack

Avatars and handles in all three link to the creator's social profile. `creators.profile_url` is preferred; when it is empty the mapper derives a deterministic URL from platform + username without writing it back to the database. See [report-interactions.md](./report-interactions.md).

Follower counts and avatars come from `creators` (current values). After a manual TikTok profile sync, live report paths are revalidated so “Takipçi Ağı”, leaderboard followers and avatar stack refresh. Historical report versions are not rewritten — generate a new version to capture updated follower data. See [creator-profile-sync.md](./creator-profile-sync.md).

## Featured video selection

1. Highest latest views
2. Tie-break: highest engagement rate
3. Tie-break: earliest published date

Requires at least one video with metrics.

## Sound growth

Uses real `sound_metric_snapshots` (manual entry and Apify sound sync). No provider call during report render:

- Earliest snapshot = initial usage
- Latest snapshot = current usage
- Absolute growth = current − initial
- Multiplier = current / initial (only when initial > 0)
- Chart requires at least two snapshots
- Usage count is TikTok sound post count, not reach or campaign video count

See [tiktok-sound-sync.md](./tiktok-sound-sync.md).

## Empty states

| Condition | Behavior |
|-----------|----------|
| No creators | Leaderboard empty message |
| No videos | Gallery empty message |
| Videos without metrics | “Henüz metrik yok” on cards |
| < 2 timeline points | Performance trend empty state |
| < 2 sound snapshots | Sound growth empty state |
| All engagement zero | Donut chart hidden |
| No featured video | Featured section empty message |
| No growth comparison | “Henüz karşılaştırma yok” |

Never falls back to mock metrics silently.

## Media and links

Video posters and play buttons open the real post via `videos.video_url`; a video URL is never invented, so media without one stays non-clickable. Thumbnails use `videos.thumbnail_url` when present (via `ReportVideoThumbnail`) and otherwise a deterministic BeFluencer CSS poster — never stock imagery. The mock design preview at `/dev/report-preview` keeps its mock images.

TikTok CDN thumbnail URLs are signed and expire. A failed load falls back immediately without retrying, and the video link keeps working. Live reports refresh the stored cover only after the next video sync. Full behaviour is documented in [video-thumbnail-reliability.md](./video-thumbnail-reliability.md) and [report-interactions.md](./report-interactions.md).

## Data freshness

Report metadata area shows:

- **Son veri güncelleme** — latest successful video sync
- **Metriksiz içerik** — videos without snapshots
- **Güncelliğini yitirmiş içerik** — last sync older than 24 hours

Sync error details are not shown on the report.

## Report record

`reports` rows are **not** auto-created during page render.

- Fallback report number: `campaigns.report_number`
- Explicit action: `ensureCampaignReport(campaignId)` from management UI (“Rapor Kaydı Oluştur”)
- Public slugs not implemented yet

## Content gallery sorting

Sort via URL search params on the live report route:

- `?sort=views` (default)
- `?sort=engagement`
- `?sort=date`

Videos without metrics sort after videos with metrics.

## Future roadmap

1. Sound usage provider sync
2. Scheduled automatic video / creator sync (cron)
3. Public share links
4. Media persistence in Supabase Storage
5. Creator growth section inside the approved report UI

## Testing

```bash
npx tsx --test features/reports/calculations.test.ts
npx tsx --test features/reports/report-interactions.test.tsx
```

Covers latest snapshot selection, aggregation, timeline double-counting prevention, featured video selection, empty metrics, and sound multiplier rules. The interaction suite covers profile and video link resolution, URL safety and media fallbacks.
