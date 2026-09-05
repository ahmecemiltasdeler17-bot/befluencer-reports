import {
  shouldAppendCreatorSnapshot,
  type CreatorSnapshotCandidate,
} from "@/features/creator-sync/calculations";
import type {
  CreatorMetricSnapshot,
  CreatorSyncStatus,
  SyncCampaignCreatorsResult,
  SyncCreatorResult,
} from "@/features/creator-sync/types";
import { calculateCreatorCategory } from "@/features/creators/calculate-creator-category";
import type {
  CreatorCategory,
  CreatorCategorySource,
} from "@/features/creators/types";
import {
  isDefinitiveUnavailableCreatorError,
  turkishUnavailableReason,
  unavailableReasonFromProviderError,
  type CreatorUnavailableReason,
} from "@/lib/providers/tiktok/detect-unavailable-creator";
import { TikTokProviderError } from "@/lib/providers/tiktok/errors";
import { assertApprovedTikTokProfile } from "@/lib/providers/tiktok/profile-url";
import {
  isValidAvatarUrl,
  logCreatorAvatarSync,
  resolveStoredAvatarUrl,
} from "@/lib/providers/tiktok/select-creator-avatar";
import { evaluateCreatorSyncEligibility } from "@/lib/providers/tiktok/sync-eligibility";
import type { TikTokCreatorProvider } from "@/lib/providers/tiktok/types";

/**
 * Sync orchestration, expressed over ports rather than Supabase directly.
 *
 * Keeping the flow free of database and framework imports means the snapshot
 * rules, field-protection rules and failure handling are all exercised by tests
 * without a running database or a real provider.
 */

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CreatorSyncRecord = {
  id: string;
  platform: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  profileUrl: string | null;
  followerCount: number;
  category: CreatorCategory | null;
  categorySource: CreatorCategorySource;
  lastSyncedAt?: string | null;
  syncStatus?: string | null;
  accountStatus?: string | null;
};

/**
 * Fields a sync is allowed to write. Campaign fee, agreed content count and
 * notes are absent by construction. `category` is written only when
 * `category_source = auto`.
 */
export type CreatorSyncPatch = {
  follower_count: number;
  profile_url: string;
  last_synced_at: string;
  sync_status: CreatorSyncStatus;
  display_name?: string;
  avatar_url?: string;
  category?: CreatorCategory | null;
  account_status?: "active" | "unavailable";
  unavailable_reason?: string | null;
  unavailable_at?: string | null;
};

export type CreatorSyncPort = {
  loadCreator(creatorId: string): Promise<CreatorSyncRecord | null>;
  createJob(creatorId: string, startedAt: string): Promise<string>;
  getLatestSnapshot(creatorId: string): Promise<CreatorMetricSnapshot | null>;
  insertSnapshot(
    creatorId: string,
    snapshot: CreatorSnapshotCandidate
  ): Promise<void>;
  updateCreator(creatorId: string, patch: CreatorSyncPatch): Promise<void>;
  persistAvatar?(creatorId: string, sourceUrl: string): Promise<string | null>;
  markCreatorFailed(creatorId: string): Promise<void>;
  markCreatorUnavailable(
    creatorId: string,
    reason: CreatorUnavailableReason,
    at: string
  ): Promise<void>;
  completeJob(
    jobId: string,
    status: "success" | "failed",
    completedAt: string,
    errorMessage: string | null
  ): Promise<void>;
  revalidate(creatorId: string): Promise<void>;
};

function isMissingText(value: string | null | undefined): boolean {
  return !value || value.trim().length === 0;
}

function failure(message: string, followerCount: number | null): SyncCreatorResult {
  return {
    outcome: "failed",
    message,
    snapshotCreated: false,
    followerCount,
    jobId: null,
  };
}

export type RunCreatorSyncOptions = {
  force?: boolean;
  manualCooldown?: boolean;
};

export async function runCreatorSync(
  creatorId: string,
  provider: TikTokCreatorProvider,
  port: CreatorSyncPort,
  now: () => Date = () => new Date(),
  options?: RunCreatorSyncOptions
): Promise<SyncCreatorResult> {
  if (!UUID_PATTERN.test(creatorId)) {
    return failure("Geçersiz içerik üreticisi kimliği.", null);
  }

  const creator = await port.loadCreator(creatorId);

  if (!creator) {
    return failure("İçerik üreticisi bulunamadı.", null);
  }

  if (creator.platform !== "tiktok") {
    return {
      outcome: "skipped",
      message:
        "Otomatik profil güncelleme şu anda yalnızca TikTok için kullanılabilir.",
      snapshotCreated: false,
      followerCount: creator.followerCount,
      jobId: null,
    };
  }

  let normalized: { username: string; profileUrl: string };

  try {
    normalized = assertApprovedTikTokProfile({
      username: creator.username,
      profileUrl: creator.profileUrl,
    });
  } catch (error) {
    return failure(
      error instanceof TikTokProviderError
        ? error.toUserMessage()
        : "Geçersiz TikTok kullanıcı adı.",
      creator.followerCount
    );
  }

  const previousForEligibility = await port.getLatestSnapshot(creatorId);
  const eligibility = evaluateCreatorSyncEligibility({
    lastSyncedAt: creator.lastSyncedAt,
    syncStatus: creator.syncStatus,
    latestSuccessfulSnapshotAt: previousForEligibility?.captured_at,
    accountStatus: creator.accountStatus,
    force: options?.force,
    manualCooldown: options?.manualCooldown ?? true,
    nowMs: now().getTime(),
  });

  if (!eligibility.eligible) {
    return {
      outcome: "skipped",
      message: eligibility.message,
      snapshotCreated: false,
      followerCount: creator.followerCount,
      jobId: null,
    };
  }

  const jobId = await port.createJob(creatorId, now().toISOString());

  try {
    const profile = await provider.fetchCreatorProfile({
      username: normalized.username,
    });

    const candidate: CreatorSnapshotCandidate = {
      followerCount: profile.followerCount,
      followingCount: profile.followingCount,
      totalLikes: profile.totalLikes,
      videoCount: profile.videoCount,
    };

    const previous = previousForEligibility;
    let snapshotCreated = false;

    if (shouldAppendCreatorSnapshot(previous, candidate, now().getTime())) {
      await port.insertSnapshot(creatorId, candidate);
      snapshotCreated = true;
    }

    const syncedAt = now().toISOString();

    const patch: CreatorSyncPatch = {
      follower_count: profile.followerCount,
      profile_url: profile.profileUrl,
      last_synced_at: syncedAt,
      sync_status: "success",
      // Recovery: a successful profile fetch clears soft-unavailable state.
      account_status: "active",
      unavailable_reason: null,
      unavailable_at: null,
    };

    // An empty provider value must not blank out a manually curated one.
    if (!isMissingText(profile.displayName)) {
      patch.display_name = profile.displayName as string;
    }

    const avatarDecision = resolveStoredAvatarUrl(
      creator.avatarUrl,
      profile.avatarUrl
    );
    let persistedAvatarUrl = avatarDecision.url;
    // Provider CDN URLs are signed and temporary. Mirror every valid provider
    // image, even when its URL string matches the stored value, so an old
    // remote URL can recover to durable Storage on the next successful sync.
    if (isValidAvatarUrl(profile.avatarUrl) && port.persistAvatar) {
      persistedAvatarUrl =
        (await port.persistAvatar(creatorId, profile.avatarUrl)) ??
        (isMissingText(creator.avatarUrl) ? avatarDecision.url : creator.avatarUrl);
    }
    if (
      persistedAvatarUrl &&
      (!creator.avatarUrl || persistedAvatarUrl !== creator.avatarUrl)
    ) {
      patch.avatar_url = persistedAvatarUrl;
    }
    let avatarHost: string | null = null;
    try {
      avatarHost = persistedAvatarUrl ? new URL(persistedAvatarUrl).hostname : null;
    } catch {
      avatarHost = null;
    }
    logCreatorAvatarSync({
      updated: avatarDecision.updated,
      preservedExisting: avatarDecision.preservedExisting,
      missingProviderImage: avatarDecision.missingProviderImage,
      host: avatarHost,
    });

    // Manual tiers are never overwritten. Auto tiers follow the live count.
    if (creator.categorySource === "auto") {
      patch.category = calculateCreatorCategory(profile.followerCount);
    }

    await port.updateCreator(creatorId, patch);
    await port.completeJob(jobId, "success", syncedAt, null);
    await port.revalidate(creatorId);

    return {
      outcome: "success",
      message: snapshotCreated
        ? "TikTok profili güncellendi ve yeni takipçi kaydı eklendi."
        : "TikTok profili güncellendi; takipçi verisi değişmediği için yeni kayıt eklenmedi.",
      snapshotCreated,
      followerCount: profile.followerCount,
      jobId,
    };
  } catch (error) {
    // Only sanitized Turkish text is persisted or returned. The provider payload,
    // the API token and the upstream response body never reach this point.
    const message =
      error instanceof TikTokProviderError
        ? error.toUserMessage()
        : error instanceof Error
          ? error.message
          : "TikTok profili alınırken beklenmeyen bir hata oluştu.";

    if (isDefinitiveUnavailableCreatorError(error)) {
      const reason = unavailableReasonFromProviderError(error);
      const at = now().toISOString();
      await port.markCreatorUnavailable(creatorId, reason, at);
      await port.completeJob(jobId, "failed", at, message);
      await port.revalidate(creatorId);

      return {
        outcome: "unavailable",
        message: `Hesap erişilemiyor: ${turkishUnavailableReason(reason)}.`,
        snapshotCreated: false,
        followerCount: creator.followerCount,
        jobId,
      };
    }

    // Follower count, display name and avatar are deliberately untouched: a
    // failed sync must not erase the last known good profile.
    await port.markCreatorFailed(creatorId);
    await port.completeJob(jobId, "failed", now().toISOString(), message);
    await port.revalidate(creatorId);

    return {
      outcome: "failed",
      message,
      snapshotCreated: false,
      followerCount: creator.followerCount,
      jobId,
    };
  }
}

export const BULK_CONCURRENCY = 2;

/**
 * Runs `worker` over `items` with at most `limit` in flight.
 *
 * `onConcurrencyChange` exists so a test can assert the ceiling is respected;
 * production passes nothing.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
  onConcurrencyChange?: (inFlight: number) => void
): Promise<R[]> {
  const results: R[] = [];
  let inFlight = 0;

  for (let index = 0; index < items.length; index += limit) {
    const batch = items.slice(index, index + limit);

    const batchResults = await Promise.all(
      batch.map(async (item) => {
        inFlight += 1;
        onConcurrencyChange?.(inFlight);

        try {
          return await worker(item);
        } finally {
          inFlight -= 1;
          onConcurrencyChange?.(inFlight);
        }
      })
    );

    results.push(...batchResults);
  }

  return results;
}

export type CampaignCreatorSyncPort = {
  campaignExists(campaignId: string): Promise<boolean>;
  listAssignedCreators(
    campaignId: string
  ): Promise<Array<{ id: string; platform: string }>>;
  syncCreator(creatorId: string): Promise<SyncCreatorResult>;
  revalidate(campaignId: string): Promise<void>;
};

export async function runCampaignCreatorSync(
  campaignId: string,
  port: CampaignCreatorSyncPort,
  onConcurrencyChange?: (inFlight: number) => void
): Promise<SyncCampaignCreatorsResult> {
  const empty = (message: string): SyncCampaignCreatorsResult => ({
    total: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    unavailable: 0,
    message,
  });

  if (!UUID_PATTERN.test(campaignId)) {
    return empty("Geçersiz kampanya kimliği.");
  }

  if (!(await port.campaignExists(campaignId))) {
    return empty("Kampanya bulunamadı.");
  }

  const assigned = await port.listAssignedCreators(campaignId);

  // A creator assigned twice must be synced once: a duplicate would double the
  // provider cost and write two snapshots one second apart.
  const uniquePlatformById = new Map<string, string>();

  for (const creator of assigned) {
    if (!uniquePlatformById.has(creator.id)) {
      uniquePlatformById.set(creator.id, creator.platform);
    }
  }

  const tiktokIds = [...uniquePlatformById.entries()]
    .filter(([, platform]) => platform === "tiktok")
    .map(([id]) => id);

  const nonTikTokCount = uniquePlatformById.size - tiktokIds.length;

  if (tiktokIds.length === 0) {
    return {
      total: uniquePlatformById.size,
      success: 0,
      failed: 0,
      skipped: nonTikTokCount,
      unavailable: 0,
      message: "Kampanyada güncellenebilecek TikTok profili bulunamadı.",
    };
  }

  const results = await mapWithConcurrency(
    tiktokIds,
    BULK_CONCURRENCY,
    // One failure must not abort the batch, so each result is collected as-is.
    (creatorId) => port.syncCreator(creatorId),
    onConcurrencyChange
  );

  let success = 0;
  let failed = 0;
  let unavailable = 0;
  let skipped = nonTikTokCount;

  for (const result of results) {
    if (result.outcome === "success") {
      success += 1;
    } else if (result.outcome === "failed") {
      failed += 1;
    } else if (result.outcome === "unavailable") {
      unavailable += 1;
    } else {
      skipped += 1;
    }
  }

  await port.revalidate(campaignId);

  const skippedSuffix = skipped > 0 ? `, ${skipped} atlandı` : "";
  const unavailableSuffix =
    unavailable > 0 ? `, ${unavailable} hesap erişilemiyor / pasif` : "";

  return {
    total: uniquePlatformById.size,
    success,
    failed,
    skipped,
    unavailable,
    message:
      failed === 0
        ? `${success} TikTok profili güncellendi${skippedSuffix}${unavailableSuffix}.`
        : `${success} başarılı, ${failed} başarısız${skippedSuffix}${unavailableSuffix}.`,
  };
}
