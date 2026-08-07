# Bulk TikTok Creator Import

Authenticated internal users can paste or upload a list of TikTok profile links
and create creators in bulk from `/creators/import`.

## What is imported

| Field | Value |
|-------|--------|
| `platform` | `tiktok` |
| `username` | extracted from `/@username`, stored lowercase |
| `display_name` | same as `username` initially |
| `profile_url` | `https://www.tiktok.com/@username` |
| `avatar_url` | `null` |
| `follower_count` | `0` (unknown until sync; **not** treated as micro) |
| `category` | `null` (uncategorized) |
| `category_source` | `auto` |

Audience tiers are calculated on the next successful TikTok profile sync from the
real follower count (`nano` / `micro` / `macro` / `mega`). Manual categories are
never overwritten.

Fees and unknown CSV columns are ignored. Apify is **not** called during parse
or insert. Real display name, avatar and followers come from the existing TikTok
creator profile sync after the user confirms.

## Accepted inputs

- Plain profile URLs (`https://www.tiktok.com/@user`, `www.tiktok.com/@user`)
- Tracking query strings / fragments (stripped)
- Markdown links `[label](https://www.tiktok.com/@user)`
- Google redirect URLs whose decoded `q` parameter contains a TikTok profile URL
  (never fetched)
- CSV with a URL/link/tiktok column (`.xlsx` is not supported)

Limits: 500 rows, 250 000 characters of pasted text.

## Preview statuses

- Hazır
- Sistemde mevcut
- Listede tekrar ediyor
- Geçersiz bağlantı
- Kullanıcı adı çıkarılamadı

Only **Hazır** rows are inserted. Existing creators are never overwritten.

## Duplicate safety

1. Case-insensitive username within the pasted list
2. Existing `(platform, username)` and canonical `profile_url` lookup
3. Database `unique (platform, username)` with `23505` treated as skip on race

Repeated submission is idempotent.

## Post-import sync

After a successful insert the UI offers **Yeni Eklenen TikTok Profillerini
Güncelle**. That action syncs only the newly inserted IDs via
`syncTikTokCreator` at concurrency 2. It never runs automatically. Successful
sync recalculates `category` when `category_source = auto`.

## Correcting pre-fix imports

Creators imported before category automation were inserted as `category = micro`.
After applying migration `20260805300000_creator_category_source.sql`, those rows
keep their category and receive `category_source = manual` (so sync will not
rewrite them unexpectedly).

To put a mistaken bulk-import row back on auto tiering without a mass update:

1. Open the creator edit page
2. Click **Otomatik kategoriye dön**
3. Run TikTok profile sync (or rely on the recalculation from current
   `follower_count` performed by the reset action)

Do not mutate historical report snapshots.

## Code

- `features/creator-import/parser.ts`
- `features/creator-import/actions.ts`
- `features/creator-import/queries.ts`
- `features/creator-import/components/creator-import-form.tsx`
- Route: `app/(protected)/(manage)/creators/import/page.tsx`
