import type {
  CampaignTaskResult,
  ScheduledSyncStatus,
  TaskCountSummary,
} from "@/features/scheduled-sync/types";

export const CAMPAIGN_CONCURRENCY = 2;

/** Soft stop accepting new campaigns when less than this remains. */
export const REMAINING_TIME_BUDGET_MS = 45_000;

export function emptyTaskCounts(): TaskCountSummary {
  return { success: 0, failed: 0, skipped: 0 };
}

export function addTaskCounts(
  left: TaskCountSummary,
  right: TaskCountSummary
): TaskCountSummary {
  return {
    success: left.success + right.success,
    failed: left.failed + right.failed,
    skipped: left.skipped + right.skipped,
  };
}

export function deriveRunStatus(input: {
  lockAcquired: boolean;
  totalCampaigns: number;
  successfulCampaigns: number;
  failedCampaigns: number;
  skippedCampaigns: number;
  video: TaskCountSummary;
  creators: TaskCountSummary;
  sound: TaskCountSummary;
  fatal?: boolean;
}): ScheduledSyncStatus {
  if (input.fatal) {
    return "failed";
  }

  if (!input.lockAcquired) {
    return "skipped";
  }

  if (input.totalCampaigns === 0) {
    return "skipped";
  }

  const attemptedSuccess =
    input.video.success + input.creators.success + input.sound.success;
  const attemptedFailed =
    input.video.failed + input.creators.failed + input.sound.failed;

  if (attemptedSuccess === 0 && attemptedFailed === 0) {
    // Campaigns existed but every task was skipped (e.g. no TikTok targets).
    if (input.skippedCampaigns === input.totalCampaigns) {
      return "skipped";
    }
    return input.failedCampaigns > 0 ? "failed" : "success";
  }

  if (attemptedFailed === 0) {
    return "success";
  }

  if (attemptedSuccess === 0) {
    return "failed";
  }

  return "partial";
}

export function summarizeCampaignOutcomes(
  results: CampaignTaskResult[]
): {
  successfulCampaigns: number;
  failedCampaigns: number;
  skippedCampaigns: number;
  video: TaskCountSummary;
  creators: TaskCountSummary;
  sound: TaskCountSummary;
} {
  let successfulCampaigns = 0;
  let failedCampaigns = 0;
  let skippedCampaigns = 0;
  let video = emptyTaskCounts();
  let creators = emptyTaskCounts();
  let sound = emptyTaskCounts();

  for (const result of results) {
    if (result.outcome === "success") {
      successfulCampaigns += 1;
    } else if (result.outcome === "failed") {
      failedCampaigns += 1;
    } else {
      skippedCampaigns += 1;
    }

    video = addTaskCounts(video, result.video);
    creators = addTaskCounts(creators, result.creators);
    sound = addTaskCounts(sound, result.sound);
  }

  return {
    successfulCampaigns,
    failedCampaigns,
    skippedCampaigns,
    video,
    creators,
    sound,
  };
}

/**
 * Processes items with at most `limit` in flight, sequentially in batches.
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

export function shouldStopAcceptingWork(
  deadlineMs: number,
  nowMs: number = Date.now()
): boolean {
  return nowMs >= deadlineMs - REMAINING_TIME_BUDGET_MS;
}
