# Report Interactions and Media Reliability

Creator profiles and video posts are reachable directly from every report surface: the live report, historical report versions, the internal print route, and the downloaded PDF.

Nothing here fetches data on the client, and no report component queries Supabase. Links are resolved from the normalized report view model, which is built server-side by `features/reports/mapper.ts` for live reports and read from `report_versions.snapshot` for historical ones.

## Link resolution

```
Report view model (Creator / Video)
        ↓
lib/report-links/  →  normalize + validate + fallback
        ↓
ReportLink | null
        ↓
ReportCreatorLink / ReportVideoLink  →  <a href> | plain content
```

| Module | Responsibility |
|--------|----------------|
| `lib/report-links/types.ts` | `ReportLink`, `ResolvedProfileUrl`, link kinds |
| `lib/report-links/is-safe-external-url.ts` | Protocol + host allowlist |
| `lib/report-links/normalize-social-url.ts` | Canonicalizes a stored URL, normalizes usernames |
| `lib/report-links/build-platform-profile-url.ts` | Deterministic profile URL from platform + username |
| `lib/report-links/resolve-report-links.ts` | `resolveCreatorLink`, `resolveVideoLink`, Turkish labels |

A resolver returns `null` rather than a broken href. `null` means "render plain, non-clickable content" — reports never show a dead or fake action.

## Safe URL policy

Only absolute `http:` and `https:` URLs on an approved social host become links. Everything else resolves to `null`:

- `javascript:`, `data:`, `file:`, `blob:` and any other scheme
- protocol-relative values such as `//www.tiktok.com/@user`
- malformed URLs, empty strings and non-string values
- look-alike hosts such as `tiktok.com.evil.example` or `faketiktok.com`
- a URL whose host contradicts the platform recorded on the row

Approved hosts:

| Platform | Hosts |
|----------|-------|
| TikTok | `tiktok.com`, `www.tiktok.com`, `vm.tiktok.com`, `vt.tiktok.com` |
| Instagram | `instagram.com`, `www.instagram.com` |
| YouTube | `youtube.com`, `www.youtube.com`, `m.youtube.com`, `youtu.be` |

Normalization forces `https:`, lowercases the host, strips credentials, ports, fragments and trailing slashes, and keeps only meaningful query parameters (`v`, `t`, `list` on YouTube). Share trackers such as `is_from_webapp` are dropped so a link stays stable across snapshots.

Every external anchor renders with `target="_blank"` and `rel="noopener noreferrer"`. The Next.js client router is never used for these destinations.

## Profile URL fallback

`resolveCreatorProfileUrl()` prefers `creators.profile_url`. When that column is empty or fails validation, a deterministic URL is built from platform + username:

| Platform | Pattern |
|----------|---------|
| TikTok | `https://www.tiktok.com/@<username>` |
| Instagram | `https://www.instagram.com/<username>` |
| YouTube | `https://www.youtube.com/@<username>` |

The username is normalized first (leading `@` stripped, path and query remnants trimmed) and must be ASCII word characters, dot, dash or underscore. Anything else yields no link.

The derived URL is a **display-time fallback only**. Report rendering never writes it back to the database. The creator detail page surfaces the same preview so the gap can be filled properly — see [Management warnings](#management-warnings).

Video URLs are never invented. Without a safe `videos.video_url` in the snapshot, the media area stays inert.

## Creator links

`components/report/links/report-creator-link.tsx` wraps an avatar, a handle, or both. With a link it renders a native anchor carrying the accessible label `@username profilini aç`; without one it renders a `<span>` with the same classes, so there is no layout shift between the two states.

Applied in:

- creator avatar stack in the hero (individual avatars only — the `+N` overflow represents many creators and is never a link)
- creator contribution list (avatar and handle link separately; the progress bar stays non-clickable)
- creator leaderboard rows (avatar, handle, and the trailing external-link icon)
- featured content creator block
- content gallery card creator header

`components/report/links/report-external-link-icon.tsx` is the hover affordance. It is always mounted at `opacity-0` and revealed on hover or keyboard focus, so nothing reflows, and it is hidden in print where it has no meaning.

## Video links

`components/report/links/report-video-link.tsx` renders a full-bleed anchor **overlay** rather than wrapping the media. This matters for two reasons: the poster, gradient, play button and platform badge keep their exact dimensions, and none of them end up nested inside an anchor. The overlay sits last in the DOM so it captures clicks across the whole 9:16 area, including the play button.

Labels are platform-specific: `TikTok videosunu aç`, `Instagram videosunu aç`, `YouTube videosunu aç`.

Applied to the featured content poster and every content gallery card. Metric rows, contribution bars and category headings remain non-clickable.

## Thumbnail priority

1. Real thumbnail URL from the provider, stored on `videos.thumbnail_url` and carried into the snapshot
2. Any other image URL already present in the snapshot
3. Deterministic CSS poster from `MediaFallback` — seeded by video id, so the same video always gets the same colours

A valid real thumbnail is never replaced by a generic image, and live or historical reports never fall back to stock photography. The mock design preview at `/` keeps its mock images. The 9:16 box is fixed by the container, so all three tiers occupy identical space and a failed image cannot resize the layout.

`shouldUseMediaFallback()` in `lib/media-fallback-styles.ts` makes the decision, and `SafeThumbnail` / `SafeAvatar` render the fallback instead of a broken `<img>`, so the browser's broken-image icon never appears.

## TikTok CDN thumbnail expiry

TikTok serves thumbnails from signed CDN URLs that expire. The consequences differ by surface:

- **Live reports** recover on their own: each TikTok sync writes a fresh `thumbnail_url`, so the current URL is normally valid.
- **Historical snapshots** are immutable by design. Their stored thumbnail URLs are never rewritten, so an old report version will eventually show the deterministic poster instead of the original image. This is expected degradation, not a failure.

Handling when a load fails:

- the deterministic fallback replaces the image immediately
- the failed URL is recorded, so it is not retried during that render; a genuinely different URL after a sync still gets one attempt
- the report snapshot is never mutated and Apify is never called during rendering
- the featured poster adds a discreet `Görsel kullanılamıyor` note; gallery cards stay clean
- **the video link keeps working** — it does not depend on the thumbnail

A future phase could copy thumbnails into Supabase Storage at generation time so historical PDFs keep their original imagery permanently. See [roadmap.md](./roadmap.md).

## Screen versus PDF behaviour

| | Screen | Print / PDF |
|--|--------|-------------|
| Anchor `href` | Yes | Yes — Chrome writes clickable link annotations |
| Cursor | `pointer` on media | Default |
| Hover | Subtle opacity change, external-link icon | None |
| Keyboard | `focus-visible` ring in accent orange | n/a |
| External-link icons | Visible on hover | Hidden via `screen-only` / `print:hidden` |
| URL text | Not printed | Not printed |
| Layout | — | Identical to screen |

Interactive-only affordances are hidden individually. Print CSS never disables pointer events globally and never hides anchors, because that would strip the PDF's clickable links. The leaderboard's trailing icon anchor is screen-only; in the PDF the handle and avatar carry the same link.

## PDF generation compatibility

`features/pdf/services/print-request-policy.ts` decides what the print page may load:

| Request | Decision |
|---------|----------|
| Navigation to the same-origin print URL | Continue |
| Navigation anywhere else, including social links | **Abort** |
| `image`, `font`, `media` from any host | Continue |
| `data:` URLs | Continue |
| Documents, scripts, styles from another origin | Abort |

External social links must survive in the DOM so the PDF gets clickable annotations, but they must never be *followed* during generation — a navigation away from the print page would capture the wrong document. Aborting every non-print navigation enforces that.

Thumbnails and avatars are allowed from any host because provider CDN hostnames are not predictable: TikTok shards and signs them per region (`p16-sign-va.tiktokcdn.com`, `p77-sign-va-lite.tiktokcdn-us.com`, …). They are passive assets that cannot execute scripts or navigate, and a blocked or expired one degrades to the deterministic poster. `next/image` runs `unoptimized` for report media, so `next.config.ts` `remotePatterns` does not gate these hosts.

Broken images never stall the export: `waitForAssets()` resolves on both `load` and `error` under a bounded timeout, and the `data-pdf-ready` marker remains the real gate.

## Backward compatibility

The snapshot schema version is **unchanged**. The new fields are optional, so every snapshot written before this phase still validates and renders:

| Field | Location | Type |
|-------|----------|------|
| `platform` | `data.creators[]` | `Platform` (optional) |
| `profileUrl` | `data.creators[]` | `string \| null` (optional) |
| `creatorProfileUrl` | `data.videos[]`, `topVideo`, `featuredVideo` | `string \| null` (optional) |

No migration was needed — `creators.profile_url`, `creators.platform` and `videos.thumbnail_url` already existed; the report query simply did not select `profile_url`.

Historical snapshots are not backfilled. A pre-Phase-9 version links only what its own stored snapshot contains, and the live database is never queried to enrich it. In practice such snapshots still get creator links, because the deterministic fallback works from the handle that was always stored. Video links require a stored `url`, which snapshots have always carried.

## Management warnings

Data quality gaps are surfaced where they can be fixed, and never block report rendering:

| Screen | Condition | Message |
|--------|-----------|---------|
| Video detail | `thumbnail_url` empty | `Thumbnail bulunamadı`, plus `Senkronize ederek görseli yenile` for TikTok videos |
| Creator detail | `profile_url` empty | `Profil bağlantısı eksik`, plus a preview of the deterministic URL reports will use |

## Public shared reports

Public `/r/[token]` pages reuse the same `CampaignReportView` and link helpers.
Allowlisted creator/video anchors stay clickable; there is no management nav and
no live enrichment. See [public-report-sharing.md](./public-report-sharing.md).

## Tests

```bash
npx tsx --test features/reports/report-interactions.test.tsx
```

Covers URL validation and rejection, username normalization, fallback profile URL generation, the guarantee that video URLs are never invented, anchor versus plain-content rendering, absence of nested anchors, platform-specific accessible labels, thumbnail fallback and no-retry behaviour, print request policy including external-link navigation refusal, legacy snapshot validation, and the print stylesheet keeping anchors intact.

Component assertions use `react-dom/server` markup. No test touches the network, Supabase, Apify or a real Chromium instance.
