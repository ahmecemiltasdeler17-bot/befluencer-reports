# Marketing Leads

Brand inquiries and creator applications submitted on the marketing site
(`befluencer-web` → `befluencer.co`) land in this app as `leads` rows and are
worked from `/leads` — **Gelen Talepler**.

The two repositories stay separate. The marketing site holds no database
credential and no Supabase key; it posts to one authenticated endpoint here.

## Flow

```
befluencer-web form (/marka-iletisim, /creator-basvuru)
  → its own Zod validation + honeypot
  → POST https://app.befluencer.co/api/public/leads
     Authorization: Bearer <FORM_WEBHOOK_SECRET>
  → ingestLead(): secret check → re-validation → sanitize
  → create_marketing_lead() (security definer)
  → public.leads
  → /leads
```

## Files

| File | Role |
|---|---|
| `app/api/public/leads/route.ts` | Public POST endpoint, body size cap, rate limit |
| `features/leads/services/ingest-lead.ts` | Secret check, validation, RPC write |
| `features/leads/verify-ingest-secret.ts` | Constant-time bearer comparison |
| `features/leads/schemas.ts` | Ingest contract, payload sanitization, admin action schemas |
| `features/leads/calculations.ts` | Identity extraction, field labels, TikTok handle parsing |
| `features/leads/queries.ts` | List, status counts, single read |
| `features/leads/actions.ts` | Status, note, convert-to-creator |
| `features/leads/components/lead-card.tsx` | One submission with its actions |
| `app/(protected)/(manage)/leads/page.tsx` | Inbox with filters and counters |

## Security

- The endpoint is **POST only**. A crawler or link preview cannot create rows.
- `LEADS_INGEST_SECRET` must be at least 24 characters; anything shorter counts
  as unconfigured and ingest answers `503`, so a placeholder cannot guard a
  public URL.
- The bearer comparison is constant-time (`verify-ingest-secret.ts`).
- Every rejection returns the same Turkish sentence — a prober cannot tell a
  wrong secret from a malformed body.
- `anon` has **no privilege on `leads`**. Writes go through
  `create_marketing_lead`, a security-definer function, exactly like the public
  share RPCs.
- Body is capped at 32 KB, 40 fields, 4 000 characters per field. Nested objects
  are rejected.
- `consent` and the `website` honeypot are stripped before storage.
- Rate limiting reuses `consumePublicRateLimit` — best-effort, in-memory, not
  shared across serverless instances. The secret is the real control.

## Validation

The marketing site validates its own forms, but this app re-validates: identity
fields (`fullName` plus `workEmail` or `email`, by kind) are required, and
everything else is stored as submitted. Unknown fields are accepted on purpose,
so the marketing site can add a question without a deploy here — they appear in
the UI under their raw key.

## Creator applications are not creators

An application never creates a creator row on its own. An admin presses
**Creator olarak ekle**, and only then:

- the TikTok handle is parsed from the submitted URL — a shortlink with no
  `@handle` is refused rather than guessed;
- an existing `(tiktok, username)` creator is **linked**, not duplicated;
- a new creator is stored with the handle, the applicant's name and the profile
  URL. `follower_count` stays `0` and `category` stays null until a real TikTok
  sync fills them. A self-reported "100K–500K" is never stored as a metric.
- the lead moves to `qualified` and keeps `creator_id`.

This mirrors the unmatched-submission rule: no creator record appears from
unverified input.

## Statuses

`new` → `contacted` → `qualified`, or `archived`. Counters on the page are
computed across all leads, so narrowing the filter does not shrink them.

## Environment

| Repo | Variable | Value |
|---|---|---|
| `befluencer-reports` | `LEADS_INGEST_SECRET` | 32+ random chars |
| `befluencer-web` | `FORM_SUBMISSION_PROVIDER` | `webhook` |
| `befluencer-web` | `FORM_WEBHOOK_URL` | `https://app.befluencer.co/api/public/leads` |
| `befluencer-web` | `FORM_WEBHOOK_SECRET` | same value as `LEADS_INGEST_SECRET` |

Rotating the secret means updating both sides; while they differ, submissions
are rejected with `401` and the marketing form shows its generic Turkish retry
message.

## Migration

`supabase/migrations/20260904200000_marketing_leads.sql`
