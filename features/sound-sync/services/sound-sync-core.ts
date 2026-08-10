import {
  shouldAppendSoundSnapshot,
} from "@/features/sound-sync/calculations";
import { SoundSyncError } from "@/features/sound-sync/errors";
import type {
  CampaignSoundConfiguration,
  SoundMetricSnapshot,
  SoundSyncStatus,
  SyncSoundResult,
} from "@/features/sound-sync/types";
import { TikTokProviderError } from "@/lib/providers/tiktok/errors";
import { assertApprovedTikTokSoundUrl } from "@/lib/providers/tiktok/sound-url";
import { evaluateSoundSyncEligibility } from "@/lib/providers/tiktok/sync-eligibility";
import type { TikTokSoundProvider } from "@/lib/providers/tiktok/types";

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type SoundSyncPatch = {
  sound_url: string;
  tiktok_sound_id: string;
  sound_last_synced_at: string;
  sound_sync_status: SoundSyncStatus;
  sound_sync_error: null;
  tiktok_sound_title?: string;
  tiktok_sound_author?: string;
  /** Provider cover URL when present; omitted from the patch when empty. */
  tiktok_sound_cover_url?: string;
};

export type SoundSyncPort = {
  loadConfiguration(
    campaignId: string
  ): Promise<CampaignSoundConfiguration | null>;
  createJob(campaignId: string, startedAt: string): Promise<string>;
  getLatestSnapshot(campaignId: string): Promise<SoundMetricSnapshot | null>;
  insertSnapshot(
    campaignId: string,
    usageCount: number,
    source: "apify"
  ): Promise<void>;
  updateCampaign(campaignId: string, patch: SoundSyncPatch): Promise<void>;
  markCampaignFailed(
    campaignId: string,
    errorMessage: string
  ): Promise<void>;
  completeJob(
    jobId: string,
    status: "success" | "failed",
    completedAt: string,
    errorMessage: string | null
  ): Promise<void>;
  revalidate(campaignId: string): Promise<void>;
};

function isMissingText(value: string | null | undefined): boolean {
  return !value || value.trim().length === 0;
}

function failure(
  message: string,
  usageCount: number | null
): SyncSoundResult {
  return {
    outcome: "failed",
    message,
    snapshotCreated: false,
    usageCount,
    jobId: null,
  };
}

function mapProviderError(error: unknown): string {
  if (error instanceof TikTokProviderError) {
    return error.toUserMessage();
  }

  if (error instanceof SoundSyncError) {
    return error.toUserMessage();
  }

  if (error instanceof Error && error.message) {
    // Only already-sanitized Turkish messages from the port reach here.
    return error.message;
  }

  return "TikTok sesi alınırken beklenmeyen bir hata oluştu.";
}

export type RunSoundSyncOptions = {
  force?: boolean;
  manualCooldown?: boolean;
  campaignStatus?: string | null;
};

export async function runSoundSync(
  campaignId: string,
  provider: TikTokSoundProvider,
  port: SoundSyncPort,
  now: () => Date = () => new Date(),
  options?: RunSoundSyncOptions
): Promise<SyncSoundResult> {
  if (!UUID_PATTERN.test(campaignId)) {
    return failure("Geçersiz kampanya kimliği.", null);
  }

  const config = await port.loadConfiguration(campaignId);

  if (!config) {
    return failure(new SoundSyncError("campaign_not_found").message, null);
  }

  if (!config.soundUrl) {
    return failure(new SoundSyncError("sound_url_missing").message, null);
  }

  const eligibility = evaluateSoundSyncEligibility({
    lastSyncedAt: config.lastSyncedAt,
    syncStatus: config.syncStatus,
    campaignStatus: options?.campaignStatus ?? null,
    force: options?.force,
    manualCooldown: options?.manualCooldown ?? true,
    nowMs: now().getTime(),
  });

  if (!eligibility.eligible) {
    return {
      outcome: "skipped",
      message: eligibility.message,
      snapshotCreated: false,
      usageCount: null,
      jobId: null,
    };
  }

  let normalized: ReturnType<typeof assertApprovedTikTokSoundUrl>;

  try {
    normalized = assertApprovedTikTokSoundUrl(config.soundUrl);
  } catch (error) {
    return failure(mapProviderError(error), null);
  }

  const jobId = await port.createJob(campaignId, now().toISOString());

  try {
    const profile = await provider.fetchSoundProfile({
      soundUrl: normalized.normalizedUrl,
      soundId: normalized.soundId ?? config.soundId ?? undefined,
    });

    const previous = await port.getLatestSnapshot(campaignId);
    let snapshotCreated = false;

    if (
      shouldAppendSoundSnapshot(
        previous,
        profile.usageCount,
        now().getTime()
      )
    ) {
      await port.insertSnapshot(campaignId, profile.usageCount, "apify");
      snapshotCreated = true;
    }

    const syncedAt = now().toISOString();
    const patch: SoundSyncPatch = {
      sound_url: profile.soundUrl || normalized.normalizedUrl,
      tiktok_sound_id: profile.soundId,
      sound_last_synced_at: syncedAt,
      sound_sync_status: "success",
      sound_sync_error: null,
    };

    if (!isMissingText(profile.title)) {
      patch.tiktok_sound_title = profile.title as string;
    }

    if (!isMissingText(profile.authorName)) {
      patch.tiktok_sound_author = profile.authorName as string;
    }

    if (!isMissingText(profile.coverUrl)) {
      patch.tiktok_sound_cover_url = profile.coverUrl as string;
    }

    await port.updateCampaign(campaignId, patch);
    await port.completeJob(jobId, "success", syncedAt, null);
    await port.revalidate(campaignId);

    return {
      outcome: "success",
      message: snapshotCreated
        ? "TikTok ses kullanımı güncellendi ve yeni kayıt eklendi."
        : "TikTok ses kullanımı güncellendi; değer değişmediği için yeni kayıt eklenmedi.",
      snapshotCreated,
      usageCount: profile.usageCount,
      jobId,
    };
  } catch (error) {
    const message = mapProviderError(error);

    await port.markCampaignFailed(campaignId, message);
    await port.completeJob(jobId, "failed", now().toISOString(), message);
    await port.revalidate(campaignId);

    return {
      outcome: "failed",
      message,
      snapshotCreated: false,
      usageCount: null,
      jobId,
    };
  }
}
