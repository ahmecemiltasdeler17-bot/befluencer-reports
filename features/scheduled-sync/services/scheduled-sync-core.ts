import {
  CAMPAIGN_CONCURRENCY,
  deriveRunStatus,
  emptyTaskCounts,
  mapWithConcurrency,
  shouldStopAcceptingWork,
  summarizeCampaignOutcomes,
} from "@/features/scheduled-sync/calculations";
import type {
  CampaignTaskResult,
  EligibleCampaign,
  ScheduledSyncSummary,
  ScheduledSyncTrigger,
  TaskCountSummary,
} from "@/features/scheduled-sync/types";
import type { SyncCampaignResult } from "@/features/sync/types";
import type { SyncCampaignCreatorsResult } from "@/features/creator-sync/types";
import type { SyncSoundResult } from "@/features/sound-sync/types";
import { isTikTokSoundUrl } from "@/lib/providers/tiktok/sound-url";

export type ScheduledSyncPort = {
  tryAcquireLock(): Promise<boolean>;
  releaseLock(): Promise<void>;
  listEligibleCampaigns(): Promise<EligibleCampaign[]>;
  createRun(input: {
    triggeredBy: ScheduledSyncTrigger;
    startedAt: string;
  }): Promise<string>;
  completeRun(
    runId: string,
    patch: {
      status: ScheduledSyncSummary["status"];
      completedAt: string;
      totalCampaigns: number;
      successfulCampaigns: number;
      failedCampaigns: number;
      skippedCampaigns: number;
      videoSuccess: number;
      videoFailed: number;
      creatorSuccess: number;
      creatorFailed: number;
      soundSuccess: number;
      soundFailed: number;
      errorMessage: string | null;
    }
  ): Promise<void>;
  syncCampaignVideos(campaignId: string): Promise<SyncCampaignResult>;
  syncCampaignCreators(campaignId: string): Promise<SyncCampaignCreatorsResult>;
  syncCampaignSound(campaignId: string): Promise<SyncSoundResult>;
  revalidateCampaign(campaignId: string): Promise<void>;
  /** Optional: build freshness plan before spending Apify runs. */
  buildSyncPlan?(campaignIds: string[]): Promise<
    NonNullable<ScheduledSyncSummary["plan"]>
  >;
  /**
   * Optional: batch-fetch all unique stale creators across campaigns once,
   * before per-campaign apply. Prevents one-actor-run-per-creator.
   */
  prefetchCreatorBatches?(campaignIds: string[]): Promise<void>;
};

function asTaskCounts(
  result: { success: number; failed: number; skipped: number }
): TaskCountSummary {
  return {
    success: result.success,
    failed: result.failed,
    skipped: result.skipped,
  };
}

function soundResultToCounts(result: SyncSoundResult): TaskCountSummary {
  if (result.outcome === "success") {
    return { success: 1, failed: 0, skipped: 0 };
  }
  if (result.outcome === "failed") {
    return { success: 0, failed: 1, skipped: 0 };
  }
  return { success: 0, failed: 0, skipped: 1 };
}

function campaignHasWork(campaign: EligibleCampaign): boolean {
  return (
    campaign.hasTikTokVideo ||
    campaign.hasTikTokCreator ||
    (campaign.hasSoundUrl &&
      Boolean(campaign.soundUrl && isTikTokSoundUrl(campaign.soundUrl)))
  );
}

async function processCampaign(
  campaign: EligibleCampaign,
  port: ScheduledSyncPort
): Promise<CampaignTaskResult> {
  if (!campaignHasWork(campaign)) {
    return {
      campaignId: campaign.id,
      outcome: "skipped",
      video: emptyTaskCounts(),
      creators: emptyTaskCounts(),
      sound: emptyTaskCounts(),
    };
  }

  let video = emptyTaskCounts();
  let creators = emptyTaskCounts();
  let sound = emptyTaskCounts();

  try {
    if (campaign.hasTikTokVideo) {
      video = asTaskCounts(await port.syncCampaignVideos(campaign.id));
    } else {
      video = { success: 0, failed: 0, skipped: 0 };
    }

    if (campaign.hasTikTokCreator) {
      creators = asTaskCounts(await port.syncCampaignCreators(campaign.id));
    }

    if (
      campaign.hasSoundUrl &&
      campaign.soundUrl &&
      isTikTokSoundUrl(campaign.soundUrl)
    ) {
      sound = soundResultToCounts(await port.syncCampaignSound(campaign.id));
    } else if (campaign.hasSoundUrl) {
      sound = { success: 0, failed: 0, skipped: 1 };
    }

    await port.revalidateCampaign(campaign.id);

    const anyFailed =
      video.failed > 0 || creators.failed > 0 || sound.failed > 0;
    const anySuccess =
      video.success > 0 || creators.success > 0 || sound.success > 0;

    return {
      campaignId: campaign.id,
      outcome: anyFailed
        ? anySuccess
          ? "failed"
          : "failed"
        : anySuccess
          ? "success"
          : "skipped",
      video,
      creators,
      sound,
    };
  } catch {
    return {
      campaignId: campaign.id,
      outcome: "failed",
      video,
      creators,
      sound: addFailedIfEmpty(sound),
    };
  }
}

function addFailedIfEmpty(counts: TaskCountSummary): TaskCountSummary {
  if (counts.success + counts.failed + counts.skipped === 0) {
    return { success: 0, failed: 1, skipped: 0 };
  }
  return counts;
}

export type RunScheduledSyncInput = {
  triggeredBy: ScheduledSyncTrigger;
  /** Absolute deadline (Date.now() + maxDuration budget). */
  deadlineMs: number;
  now?: () => Date;
};

/**
 * Global TikTok sync orchestrator. Testable via ports; production wires
 * service-role Supabase + existing domain sync services.
 */
export async function runScheduledTikTokSync(
  port: ScheduledSyncPort,
  input: RunScheduledSyncInput
): Promise<ScheduledSyncSummary> {
  const now = input.now ?? (() => new Date());
  const startedAt = now().toISOString();

  const lockAcquired = await port.tryAcquireLock();

  if (!lockAcquired) {
    return {
      runId: null,
      status: "skipped",
      startedAt,
      completedAt: now().toISOString(),
      totalCampaigns: 0,
      successfulCampaigns: 0,
      failedCampaigns: 0,
      skippedCampaigns: 0,
      video: emptyTaskCounts(),
      creators: emptyTaskCounts(),
      sound: emptyTaskCounts(),
      message: "Başka bir senkronizasyon çalışıyor.",
    };
  }

  let runId: string | null = null;

  try {
    runId = await port.createRun({
      triggeredBy: input.triggeredBy,
      startedAt,
    });

    const eligible = await port.listEligibleCampaigns();

    let plan: ScheduledSyncSummary["plan"] | undefined;
    if (port.buildSyncPlan && eligible.length > 0) {
      plan = await port.buildSyncPlan(eligible.map((item) => item.id));
    }

    if (eligible.length === 0) {
      const completedAt = now().toISOString();
      const summary: ScheduledSyncSummary = {
        runId,
        status: "skipped",
        startedAt,
        completedAt,
        totalCampaigns: 0,
        successfulCampaigns: 0,
        failedCampaigns: 0,
        skippedCampaigns: 0,
        video: emptyTaskCounts(),
        creators: emptyTaskCounts(),
        sound: emptyTaskCounts(),
        message: "Uygun kampanya yok.",
      };

      await port.completeRun(runId, {
        status: "skipped",
        completedAt,
        totalCampaigns: 0,
        successfulCampaigns: 0,
        failedCampaigns: 0,
        skippedCampaigns: 0,
        videoSuccess: 0,
        videoFailed: 0,
        creatorSuccess: 0,
        creatorFailed: 0,
        soundSuccess: 0,
        soundFailed: 0,
        errorMessage: null,
      });

      return summary;
    }

    const toProcess: EligibleCampaign[] = [];
    let timeSkipped = 0;

    for (const campaign of eligible) {
      if (shouldStopAcceptingWork(input.deadlineMs, now().getTime())) {
        timeSkipped += 1;
        continue;
      }
      toProcess.push(campaign);
    }

    // Creator Apify spend happens here in multi-profile batches — not inside
    // per-campaign loops that would collapse to profiles: [one].
    if (port.prefetchCreatorBatches && toProcess.length > 0) {
      await port.prefetchCreatorBatches(toProcess.map((item) => item.id));
    }

    const processed = await mapWithConcurrency(
      toProcess,
      CAMPAIGN_CONCURRENCY,
      (campaign) => processCampaign(campaign, port)
    );

    const timeSkippedResults: CampaignTaskResult[] = Array.from(
      { length: timeSkipped },
      (_, index) => ({
        campaignId: `skipped-time-${index}`,
        outcome: "skipped" as const,
        video: emptyTaskCounts(),
        creators: emptyTaskCounts(),
        sound: emptyTaskCounts(),
      })
    );

    const totals = summarizeCampaignOutcomes([
      ...processed,
      ...timeSkippedResults,
    ]);

    const status = deriveRunStatus({
      lockAcquired: true,
      totalCampaigns: eligible.length,
      ...totals,
    });

    const completedAt = now().toISOString();

    await port.completeRun(runId, {
      status,
      completedAt,
      totalCampaigns: eligible.length,
      successfulCampaigns: totals.successfulCampaigns,
      failedCampaigns: totals.failedCampaigns,
      skippedCampaigns: totals.skippedCampaigns,
      videoSuccess: totals.video.success,
      videoFailed: totals.video.failed,
      creatorSuccess: totals.creators.success,
      creatorFailed: totals.creators.failed,
      soundSuccess: totals.sound.success,
      soundFailed: totals.sound.failed,
      errorMessage: null,
    });

    return {
      runId,
      status,
      startedAt,
      completedAt,
      totalCampaigns: eligible.length,
      successfulCampaigns: totals.successfulCampaigns,
      failedCampaigns: totals.failedCampaigns,
      skippedCampaigns: totals.skippedCampaigns,
      video: totals.video,
      creators: totals.creators,
      sound: totals.sound,
      plan,
      // Do not report estimatedProviderRuns as "used" — executeScheduledTikTokSync
      // overlays the real Apify start counter after the run.
      message: plan
        ? [
            `Plan: ${plan.totalEntities} varlık`,
            `${plan.freshSkipped} zaten günceldi`,
            `${plan.staleEligible} senkronize edilecek`,
            plan.skippedUnavailable > 0
              ? `${plan.skippedUnavailable} hesap erişilemiyor / pasif`
              : null,
            plan.nonRetriable > 0
              ? `${plan.nonRetriable} yeniden denenmeyecek`
              : null,
            `Video ${totals.video.success}/${totals.video.failed}`,
            `Profil ${totals.creators.success}/${totals.creators.failed}`,
            `Ses ${totals.sound.success}/${totals.sound.failed}`,
          ]
            .filter(Boolean)
            .join(" · ")
        : undefined,
    };
  } catch (error) {
    const completedAt = now().toISOString();
    const message =
      error instanceof Error
        ? error.message
        : "Zamanlanmış senkronizasyon başarısız oldu.";

    if (runId) {
      await port.completeRun(runId, {
        status: "failed",
        completedAt,
        totalCampaigns: 0,
        successfulCampaigns: 0,
        failedCampaigns: 0,
        skippedCampaigns: 0,
        videoSuccess: 0,
        videoFailed: 0,
        creatorSuccess: 0,
        creatorFailed: 0,
        soundSuccess: 0,
        soundFailed: 0,
        errorMessage: message,
      });
    }

    return {
      runId,
      status: "failed",
      startedAt,
      completedAt,
      totalCampaigns: 0,
      successfulCampaigns: 0,
      failedCampaigns: 0,
      skippedCampaigns: 0,
      video: emptyTaskCounts(),
      creators: emptyTaskCounts(),
      sound: emptyTaskCounts(),
      message,
    };
  } finally {
    await port.releaseLock();
  }
}
