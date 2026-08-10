import {
  CREATOR_FRESHNESS_MS,
  MANUAL_SYNC_COOLDOWN_MS,
  NON_RETRIABLE_PROVIDER_CODES,
  SYNC_UX_MESSAGES,
  soundFreshnessMsForCampaignStatus,
  videoFreshnessMsForCampaignStatus,
  type CampaignStatusForFreshness,
} from "@/lib/providers/tiktok/sync-policy";

export type VideoFreshnessDecision =
  | { eligible: true; reason: "stale" | "never_synced" | "force" }
  | {
      eligible: false;
      reason: "fresh" | "cooldown" | "archived_no_auto" | "non_retriable";
      message: string;
    };

export type CreatorFreshnessDecision =
  | { eligible: true; reason: "stale" | "never_synced" | "force" }
  | {
      eligible: false;
      reason:
        | "fresh"
        | "cooldown"
        | "archived_no_auto"
        | "non_retriable"
        | "unavailable_account";
      message: string;
    };

/** @deprecated Prefer VideoFreshnessDecision / CreatorFreshnessDecision. */
export type FreshnessDecision = CreatorFreshnessDecision;

function ageMs(iso: string | null | undefined, nowMs: number): number | null {
  if (!iso) {
    return null;
  }
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) {
    return null;
  }
  return Math.max(0, nowMs - ts);
}

/**
 * Latest successful sync/snapshot timestamp for freshness.
 * Prefer the newest among:
 * - last_synced_at when sync_status is success
 * - latest successful metric snapshot captured_at
 *
 * Never uses created_at / updated_at / failed-only markers.
 */
export function resolveLastSuccessfulSyncAt(input: {
  lastSyncedAt?: string | null;
  syncStatus?: string | null;
  latestSuccessfulSnapshotAt?: string | null;
}): string | null {
  const candidates: number[] = [];

  if (
    input.syncStatus === "success" &&
    input.lastSyncedAt &&
    Number.isFinite(new Date(input.lastSyncedAt).getTime())
  ) {
    candidates.push(new Date(input.lastSyncedAt).getTime());
  }

  if (
    input.latestSuccessfulSnapshotAt &&
    Number.isFinite(new Date(input.latestSuccessfulSnapshotAt).getTime())
  ) {
    candidates.push(new Date(input.latestSuccessfulSnapshotAt).getTime());
  }

  if (candidates.length === 0) {
    return null;
  }

  return new Date(Math.max(...candidates)).toISOString();
}

export function evaluateVideoSyncEligibility(input: {
  lastSyncedAt?: string | null;
  syncStatus?: string | null;
  latestSuccessfulSnapshotAt?: string | null;
  campaignStatus?: CampaignStatusForFreshness | null;
  lastErrorCode?: string | null;
  /**
   * Bypass freshness + cooldown only.
   * Does NOT bypass definitive non-retryable codes unless
   * `allowNonRetriableRecheck` / `recheckLoginRequired` is also set.
   */
  force?: boolean;
  nowMs?: number;
  /** When true, apply manual cooldown after recent success. */
  manualCooldown?: boolean;
  /** Explicit admin re-check of any non-retryable classification. */
  allowNonRetriableRecheck?: boolean;
  /**
   * Manual campaign sync may soft-recheck login_required videos (provider can
   * succeed later). Scheduled/auto sync must leave this false.
   */
  recheckLoginRequired?: boolean;
}): VideoFreshnessDecision {
  const now = input.nowMs ?? Date.now();

  if (
    input.lastErrorCode &&
    (NON_RETRIABLE_PROVIDER_CODES as Set<string>).has(input.lastErrorCode)
  ) {
    const softLoginRecheck =
      input.recheckLoginRequired === true &&
      input.lastErrorCode === "login_required_content";
    if (!input.allowNonRetriableRecheck && !softLoginRecheck) {
      return {
        eligible: false,
        reason: "non_retriable",
        message: SYNC_UX_MESSAGES.skippedNonRetriable,
      };
    }
  }

  if (input.force) {
    return { eligible: true, reason: "force" };
  }

  const freshnessMs = videoFreshnessMsForCampaignStatus(input.campaignStatus);
  if (!Number.isFinite(freshnessMs)) {
    return {
      eligible: false,
      reason: "archived_no_auto",
      message: "Arşiv kampanyalar otomatik senkronize edilmez.",
    };
  }

  const lastSuccessfulAt = resolveLastSuccessfulSyncAt(input);
  const age = ageMs(lastSuccessfulAt, now);
  if (age === null) {
    return { eligible: true, reason: "never_synced" };
  }

  if (input.manualCooldown && age < MANUAL_SYNC_COOLDOWN_MS) {
    return {
      eligible: false,
      reason: "cooldown",
      message: SYNC_UX_MESSAGES.recentlyUpdated,
    };
  }

  if (age < freshnessMs) {
    return {
      eligible: false,
      reason: "fresh",
      message: SYNC_UX_MESSAGES.skippedFresh,
    };
  }

  return { eligible: true, reason: "stale" };
}

export function evaluateCreatorSyncEligibility(input: {
  lastSyncedAt?: string | null;
  syncStatus?: string | null;
  latestSuccessfulSnapshotAt?: string | null;
  lastErrorCode?: string | null;
  /** Soft account lifecycle — unavailable accounts skip automatic Apify sync. */
  accountStatus?: string | null;
  force?: boolean;
  nowMs?: number;
  manualCooldown?: boolean;
}): CreatorFreshnessDecision {
  const now = input.nowMs ?? Date.now();

  if (input.force) {
    return { eligible: true, reason: "force" };
  }

  if ((input.accountStatus ?? "active") === "unavailable") {
    return {
      eligible: false,
      reason: "unavailable_account",
      message: SYNC_UX_MESSAGES.skippedUnavailableAccount,
    };
  }

  if (
    input.lastErrorCode &&
    (NON_RETRIABLE_PROVIDER_CODES as Set<string>).has(input.lastErrorCode)
  ) {
    return {
      eligible: false,
      reason: "non_retriable",
      message: SYNC_UX_MESSAGES.skippedNonRetriable,
    };
  }

  const lastSuccessfulAt = resolveLastSuccessfulSyncAt(input);
  const age = ageMs(lastSuccessfulAt, now);
  if (age === null) {
    return { eligible: true, reason: "never_synced" };
  }

  if (input.manualCooldown && age < MANUAL_SYNC_COOLDOWN_MS) {
    return {
      eligible: false,
      reason: "cooldown",
      message: SYNC_UX_MESSAGES.recentlyUpdated,
    };
  }

  if (age < CREATOR_FRESHNESS_MS) {
    return {
      eligible: false,
      reason: "fresh",
      message: SYNC_UX_MESSAGES.skippedFresh,
    };
  }

  return { eligible: true, reason: "stale" };
}

export function evaluateSoundSyncEligibility(input: {
  lastSyncedAt?: string | null;
  syncStatus?: string | null;
  latestSuccessfulSnapshotAt?: string | null;
  campaignStatus?: CampaignStatusForFreshness | null;
  lastErrorCode?: string | null;
  force?: boolean;
  nowMs?: number;
  manualCooldown?: boolean;
}): VideoFreshnessDecision {
  const now = input.nowMs ?? Date.now();

  if (input.force) {
    return { eligible: true, reason: "force" };
  }

  if (
    input.lastErrorCode &&
    (NON_RETRIABLE_PROVIDER_CODES as Set<string>).has(input.lastErrorCode)
  ) {
    return {
      eligible: false,
      reason: "non_retriable",
      message: SYNC_UX_MESSAGES.skippedNonRetriable,
    };
  }

  const freshnessMs = soundFreshnessMsForCampaignStatus(input.campaignStatus);
  const lastSuccessfulAt = resolveLastSuccessfulSyncAt(input);
  const age = ageMs(lastSuccessfulAt, now);
  if (age === null) {
    return { eligible: true, reason: "never_synced" };
  }

  if (input.manualCooldown && age < MANUAL_SYNC_COOLDOWN_MS) {
    return {
      eligible: false,
      reason: "cooldown",
      message: SYNC_UX_MESSAGES.recentlyUpdated,
    };
  }

  if (age < freshnessMs) {
    return {
      eligible: false,
      reason: "fresh",
      message: SYNC_UX_MESSAGES.skippedFresh,
    };
  }

  return { eligible: true, reason: "stale" };
}

/** Deduplicate keys while preserving first-seen order. */
export function dedupePreserveOrder(keys: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const key of keys) {
    const trimmed = key.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

export function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) {
    return [items];
  }
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}
