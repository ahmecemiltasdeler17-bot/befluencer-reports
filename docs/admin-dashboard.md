# Admin Dashboard Home

Phase 14 replaces the mock report at `/` with an authenticated internal
management dashboard.

## Route

| Path | Purpose |
|------|---------|
| `/` | Admin dashboard (under `(protected)/(manage)`) |
| `/dev/report-preview` | Former mock report UI — authenticated, `notFound()` in production |

Internal navigation is relative. Absolute public share links use
`PUBLIC_REPORT_URL` (see [platform-architecture.md](./platform-architecture.md));
the dashboard itself does not hardcode production domains.

## Sections

1. **Header** — title, date, description, quick actions  
2. **KPI cards** — active campaigns, creators, videos, ready reports, active shares  
3. **Campaign overview** — recent non-archived campaigns with counts and deep links  
4. **Attention required** — deterministic warnings (critical / warning / info)  
5. **Sync status** — latest scheduled sync + manual “Tüm TikTok Verilerini Güncelle”  
6. **Recent reports** — immutable versions with view / PDF / share  
7. **Recent activity** — lightweight feed from existing timestamps (no audit table)

## Data sources

`features/dashboard/queries.ts` loads data with parallel Supabase queries under RLS:

- head counts on `campaigns`, `creators`, `videos`, `report_versions`
- slim campaign rows with nested `campaign_creators(count)` / `videos(count)`
- recent `report_versions` metadata (**no `snapshot` JSON**)
- `public_report_shares` without `token_hash`
- `scheduled_sync_runs` via existing scheduled-sync queries
- sound usage from latest `sound_metric_snapshots` rows

No Apify / TikTok provider calls. Opening the dashboard never starts a sync.

## Warning logic

Implemented in `buildCampaignWarnings()` (`features/dashboard/calculations.ts`):

| Code | Typical severity |
|------|------------------|
| `failed_video_sync` / `failed_creator_sync` / `failed_sound_sync` | critical |
| `no_creators` / `no_videos` / `no_ready_report` / `stale_sync` | warning (info when draft+empty) |
| `no_sound_url` / `missing_thumbnail` | info |

Stale sync threshold: **48 hours** (`STALE_SYNC_THRESHOLD_MS`).

Empty draft campaigns use neutral “henüz…” wording instead of sounding broken.

Expired/revoked shares are excluded from the active-share KPI and are not
attention warnings by default.

## Quick actions

| Action | Target |
|--------|--------|
| Yeni Kampanya | `/campaigns/new` |
| Creator Ekle | `/creators/new` |
| Video Ekle | first active campaign `/campaigns/[id]/videos/new`, else `/campaigns` |
| Raporları Görüntüle | `/reports` |
| Tüm TikTok Verilerini Güncelle | existing `RunScheduledSyncButton` |

## Performance decisions

- Server Component page; no client fetch for initial load  
- Parallel independent queries  
- Limited list sizes (`DASHBOARD_RECENT_LIMIT = 8`)  
- No heavy charts  
- `revalidatePath("/")` after campaign / report / share mutations  

## Navigation

`ManagementNav` labels `/` as **Genel Bakış**, highlights the active route, and
keeps the BeFluencer logo linking home.

## Mock preview relocation

Approved report components remain in the codebase. The mock composition that
previously lived at `/` is at `/dev/report-preview` and is not linked in nav.

## Future ideas (not in this phase)

- Campaign health score charts  
- Stored media thumbnails on the dashboard  
- Email digest of attention items  
- Cross-campaign report analytics  
- Dedicated audit / activity table  

## Tests

```bash
npx tsx --test features/dashboard/dashboard.test.ts
```
