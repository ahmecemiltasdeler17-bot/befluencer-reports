/**
 * TikTok sync cost/speed policy — single source of truth for freshness,
 * cooldown, batching, concurrency, and retry bounds.
 */

/** Video freshness windows by campaign status. */
export const VIDEO_FRESHNESS_MS = {
  active: 15 * 60 * 1000,
  completed: 24 * 60 * 60 * 1000,
  /** Archived / other: no automatic scrape unless force. */
  archived: Number.POSITIVE_INFINITY,
} as const;

export const CREATOR_FRESHNESS_MS = 24 * 60 * 60 * 1000;

export const SOUND_FRESHNESS_MS = {
  activeCampaign: 6 * 60 * 60 * 1000,
  otherwise: 24 * 60 * 60 * 1000,
} as const;

/** Manual single-item cooldown after a successful sync. */
export const MANUAL_SYNC_COOLDOWN_MS = 2 * 60 * 1000;

/** Max video URLs per Apify actor run (Clockworks postURLs). */
export const VIDEO_BATCH_SIZE = 10;

/** Max creator usernames per Apify actor run. */
export const CREATOR_BATCH_SIZE = 5;

/** Concurrent Apify batch runs (not per-entity floods). */
export const PROVIDER_BATCH_CONCURRENCY = 2;

/** Campaign-level concurrency for scheduled/global sync. */
export const SCHEDULED_CAMPAIGN_CONCURRENCY = 2;

/** Max automatic retries for transient provider errors only. */
export const TRANSIENT_RETRY_MAX = 1;

/** Short-lived preview cache for video-import URL scrapes. */
export const VIDEO_IMPORT_PREVIEW_CACHE_TTL_MS = 2 * 60 * 1000;

export const NON_RETRIABLE_PROVIDER_CODES = new Set([
  "login_required_content",
  "invalid_url",
  "unavailable_video",
  "username_mismatch",
  "malformed_result",
  "private_profile",
  "creator_not_found",
  "sound_not_found",
  "sound_identity_mismatch",
  "invalid_sound_url",
  "unsupported_sound_url",
  "not_configured",
  "payment_required",
  "actor_not_found",
  "auth_failure",
] as const);

export const TRANSIENT_PROVIDER_CODES = new Set([
  "upstream_failure",
  "rate_limit",
  "provider_timeout",
  "actor_run_failed",
] as const);

export type CampaignStatusForFreshness =
  | "active"
  | "completed"
  | "archived"
  | "draft"
  | "paused"
  | string;

export function videoFreshnessMsForCampaignStatus(
  status: CampaignStatusForFreshness | null | undefined
): number {
  const normalized = (status ?? "").toLowerCase();
  if (normalized === "active" || normalized === "draft" || normalized === "paused") {
    return VIDEO_FRESHNESS_MS.active;
  }
  if (normalized === "completed") {
    return VIDEO_FRESHNESS_MS.completed;
  }
  if (normalized === "archived") {
    return VIDEO_FRESHNESS_MS.archived;
  }
  // Unknown statuses: treat like active (safer to refresh).
  return VIDEO_FRESHNESS_MS.active;
}

export function soundFreshnessMsForCampaignStatus(
  status: CampaignStatusForFreshness | null | undefined
): number {
  const normalized = (status ?? "").toLowerCase();
  if (normalized === "active") {
    return SOUND_FRESHNESS_MS.activeCampaign;
  }
  return SOUND_FRESHNESS_MS.otherwise;
}

export const SYNC_UX_MESSAGES = {
  planning: "Planlanıyor…",
  updating: "Güncelleniyor…",
  recentlyUpdated: "Yakın zamanda güncellendi",
  skippedFresh: "Zaten güncel",
  skippedNonRetriable: "Yeniden denenmeyecek",
  skippedUnavailableAccount: "Hesap erişilemiyor / pasif",
} as const;
