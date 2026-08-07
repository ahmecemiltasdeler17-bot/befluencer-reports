# Video Thumbnail Reliability

Reports should show the real TikTok cover whenever the provider returns one.
Deterministic BeFluencer CSS posters remain the final safety net — never stock
photography, Unsplash, or unrelated remote placeholders.

## Field precedence

During TikTok video parse (`selectVideoThumbnail` in
`lib/providers/tiktok/select-video-thumbnail.ts`), candidates are considered in
this order:

1. Stable / original cover (`videoMeta.originalCover`, `originCover`, …)
2. Large static cover (`coverLarge`)
3. Standard cover / thumbnail aliases (`cover`, `coverUrl`, `thumbnailUrl`, …)
4. Medium cover (`coverMedium`)
5. Dynamic cover (`dynamicCover`) — last real-media option

Rules:

- Only absolute `http:` / `https:` URLs are accepted
- CDN query strings required for signed access are preserved
- Avatar and music-cover URLs from the same payload are rejected
- `data:`, `blob:`, `file:`, `javascript:`, and relative paths are rejected

## Sync preservation

When writing `videos.thumbnail_url` after a successful sync:

| Provider thumbnail | Existing thumbnail | Result |
|--------------------|--------------------|--------|
| Valid URL | any | Store the new URL |
| Missing / invalid | Valid URL | Preserve existing |
| Missing / invalid | Empty | Keep `null` (UI fallback) |

Provider failures never clear or rewrite `thumbnail_url` — the catch path only
marks `sync_status = failed`.

Live reports pick up a refreshed CDN URL only after the next successful video
sync. Historical / public / PDF reports never query live `videos` rows for a
newer thumbnail.

## Report data flow

```
Apify item → selectVideoThumbnail → videos.thumbnail_url
        → live report query → mapper (`thumbnail`)
        → report snapshot at generation time
        → historical / public / PDF render (snapshot only)
```

Existing snapshots without a thumbnail still validate (`thumbnail: ""`).
New versions freeze whatever URL was available at generation.

## Rendering

Shared component: `components/report/media/report-video-thumbnail.tsx`.

- Prefer the real cover; `object-fit: cover` inside a fixed 9:16 box
- On load error, switch immediately to the branded CSS fallback
- Remember the failed URL for the component instance; retry only when `src` changes
- Keep play overlay and video anchor intact so links stay clickable
- No Unsplash / stock URLs in live, historical, public, or PDF reports

## Branded fallback

`MediaFallback` (video / featured variants) uses a dark gradient, subtle orange
glow, creator initial, platform badge, and a small BeFluencer mark (`BF`).
When a real CDN URL failed, featured media may show “Görsel kullanılamıyor”.
It never invents a fake photograph.

## CDN expiry

TikTok signed CDN URLs expire. When they do:

- The image fails once and falls back immediately (no retry loop)
- Report HTML / public pages still complete
- PDF readiness treats `load` **and** `error` as settled, with a bounded asset timeout
- Snapshots are not mutated when a historical image fails
- A live refresh requires another video sync

## Diagnostics (development only)

`logThumbnailDiagnostics` logs field name, validation, preservation, and host —
never signed query strings, raw payloads, tokens, or cookies.

## Future work

Persist covers into Supabase Storage at sync time so historical PDFs keep a
durable copy after CDN expiry. That work is intentionally deferred.
