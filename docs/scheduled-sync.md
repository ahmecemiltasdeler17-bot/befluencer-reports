# Scheduled Automatic TikTok Sync

Phase 12 adds a Vercel Cron orchestrator that refreshes TikTok videos, creator profiles, and campaign sounds without a browser session.

## Architecture

```
Vercel Cron (every 6h) ──GET──► /api/cron/tiktok-sync
                                      │
                                      ├─ Authorization: Bearer CRON_SECRET
                                      ├─ advisory lock
                                      ├─ service-role Supabase client
                                      └─ existing sync services
                                           ├─ syncCampaignTikTokVideos
                                           ├─ syncCampaignTikTokCreators
                                           └─ syncTikTokSound

Authenticated UI ──POST──► /api/internal/tiktok-sync/run
                                      │
                                      └─ same orchestrator (triggered_by=manual)
```

Manual campaign/video/creator/sound buttons keep working unchanged.

## Schedule

`vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/tiktok-sync",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

Route runtime: Node.js, `maxDuration = 300` (Pro). Hobby plans may cap lower — document your plan’s limit in Vercel.

## Environment

Server-only:

| Variable | Purpose |
|----------|---------|
| `CRON_SECRET` | Bearer token for `/api/cron/tiktok-sync` |
| `SUPABASE_SERVICE_ROLE_KEY` | DB writes without a user session (never `NEXT_PUBLIC_`) |
| `APIFY_API_TOKEN` / `APIFY_TIKTOK_ACTOR_ID` | Existing TikTok providers |

Optional: `SCHEDULED_SYNC_DEBUG=1`, `APIFY_TIKTOK_SOUND_ACTOR_ID`.

## Locking

PostgreSQL advisory lock via:

- `try_acquire_scheduled_sync_lock()`
- `release_scheduled_sync_lock()`

If the lock is held, the run returns `status: skipped` and does not process campaigns.

## Eligibility

Non-archived campaigns that have at least one of:

- TikTok video (not unavailable)
- TikTok creator assignment
- Valid TikTok `/music/` sound URL

## Concurrency

- Campaigns: max **2** in flight
- Within a campaign: videos → creators → sound (sequential)
- Creator bulk: max 2 (existing)
- Video bulk: max 2 (existing)

When remaining time is low (`maxDuration − 45s`), unstarted campaigns are marked skipped.

## Audit

Parent rows: `scheduled_sync_runs` (SELECT-only for authenticated users).

Child rows: existing `sync_jobs` per video/creator/sound sync.

## Historical reports

- No automatic report-version generation
- Immutable versions and PDF snapshot-only behavior unchanged
- Live report paths are revalidated after campaign work

## Local testing

```bash
# Cron (replace secret)
curl.exe -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/tiktok-sync

# Manual: use Settings → “Tüm TikTok Verilerini Güncelle” while logged in
```

## Vercel deployment

1. Apply migration `20260805270000_scheduled_sync.sql` (do not rely on this doc to push).
2. Set `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, Apify vars in the Vercel project.
3. Deploy so `vercel.json` cron is registered.
4. Confirm cron invocations in the Vercel dashboard (Production).
5. Open `/settings/sync` and verify run history.
