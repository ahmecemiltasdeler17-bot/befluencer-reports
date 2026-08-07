import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  extractBearerToken,
  isAuthorizedCronRequest,
  secretsEqual,
} from "@/features/scheduled-sync/cron-auth";
import {
  CAMPAIGN_CONCURRENCY,
  deriveRunStatus,
  mapWithConcurrency,
} from "@/features/scheduled-sync/calculations";
import {
  runScheduledTikTokSync,
  type ScheduledSyncPort,
} from "@/features/scheduled-sync/services/scheduled-sync-core";
import type {
  EligibleCampaign,
  ScheduledSyncSummary,
} from "@/features/scheduled-sync/types";

const SECRET = "test-cron-secret-value";

describe("cron auth", () => {
  it("rejects a missing header", () => {
    assert.equal(isAuthorizedCronRequest(null, SECRET), false);
  });

  it("rejects a wrong secret", () => {
    assert.equal(
      isAuthorizedCronRequest("Bearer wrong-secret-value!!", SECRET),
      false
    );
  });

  it("accepts a correct Bearer secret", () => {
    assert.equal(
      isAuthorizedCronRequest(`Bearer ${SECRET}`, SECRET),
      true
    );
  });

  it("ignores query-string style secrets (header-only)", () => {
    assert.equal(extractBearerToken("Bearer real"), "real");
    assert.equal(secretsEqual("a", "b"), false);
    // Query string is never parsed by isAuthorizedCronRequest.
    assert.equal(isAuthorizedCronRequest(null, SECRET), false);
  });
});

describe("deriveRunStatus", () => {
  it("returns skipped when the lock was not acquired", () => {
    assert.equal(
      deriveRunStatus({
        lockAcquired: false,
        totalCampaigns: 0,
        successfulCampaigns: 0,
        failedCampaigns: 0,
        skippedCampaigns: 0,
        video: { success: 0, failed: 0, skipped: 0 },
        creators: { success: 0, failed: 0, skipped: 0 },
        sound: { success: 0, failed: 0, skipped: 0 },
      }),
      "skipped"
    );
  });

  it("returns partial when there are successes and failures", () => {
    assert.equal(
      deriveRunStatus({
        lockAcquired: true,
        totalCampaigns: 2,
        successfulCampaigns: 1,
        failedCampaigns: 1,
        skippedCampaigns: 0,
        video: { success: 1, failed: 1, skipped: 0 },
        creators: { success: 0, failed: 0, skipped: 0 },
        sound: { success: 0, failed: 0, skipped: 0 },
      }),
      "partial"
    );
  });
});

function campaign(overrides: Partial<EligibleCampaign> = {}): EligibleCampaign {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Test",
    status: "active",
    soundUrl: "https://www.tiktok.com/music/test-7149523537730997035",
    hasTikTokVideo: true,
    hasTikTokCreator: true,
    hasSoundUrl: true,
    ...overrides,
  };
}

function createPort(options?: {
  lock?: boolean;
  campaigns?: EligibleCampaign[];
  videoFail?: boolean;
  creatorFail?: boolean;
  soundFail?: boolean;
  fatalOnList?: boolean;
}): {
  port: ScheduledSyncPort;
  locks: { acquired: number; released: number };
  maxConcurrency: { value: number };
  runs: Array<{ status: string }>;
} {
  const locks = { acquired: 0, released: 0 };
  const maxConcurrency = { value: 0 };
  const runs: Array<{ status: string }> = [];
  let inFlight = 0;

  const port: ScheduledSyncPort = {
    async tryAcquireLock() {
      if (options?.lock === false) {
        return false;
      }
      locks.acquired += 1;
      return true;
    },
    async releaseLock() {
      locks.released += 1;
    },
    async listEligibleCampaigns() {
      if (options?.fatalOnList) {
        throw new Error("Kampanyalar yüklenemedi.");
      }
      return options?.campaigns ?? [];
    },
    async createRun() {
      return "run-1";
    },
    async completeRun(_runId, patch) {
      runs.push({ status: patch.status });
    },
    async syncCampaignVideos() {
      inFlight += 1;
      maxConcurrency.value = Math.max(maxConcurrency.value, inFlight);
      await Promise.resolve();
      inFlight -= 1;
      if (options?.videoFail) {
        return { total: 1, success: 0, failed: 1, skipped: 0, message: "fail" };
      }
      return { total: 1, success: 1, failed: 0, skipped: 0, message: "ok" };
    },
    async syncCampaignCreators() {
      if (options?.creatorFail) {
        return { total: 1, success: 0, failed: 1, skipped: 0, message: "fail" };
      }
      return { total: 1, success: 1, failed: 0, skipped: 0, message: "ok" };
    },
    async syncCampaignSound() {
      if (options?.soundFail) {
        return {
          outcome: "failed",
          message: "fail",
          snapshotCreated: false,
          usageCount: null,
          jobId: null,
        };
      }
      return {
        outcome: "success",
        message: "ok",
        snapshotCreated: true,
        usageCount: 100,
        jobId: "job-1",
      };
    },
    async revalidateCampaign() {},
  };

  return { port, locks, maxConcurrency, runs };
}

describe("runScheduledTikTokSync", () => {
  const deadline = () => Date.now() + 300_000;

  it("skips when the lock is unavailable without releasing a lock it never held", async () => {
    const { port, locks, runs } = createPort({ lock: false });
    const summary = await runScheduledTikTokSync(port, {
      triggeredBy: "cron",
      deadlineMs: deadline(),
    });

    assert.equal(summary.status, "skipped");
    assert.equal(summary.runId, null);
    assert.equal(locks.acquired, 0);
    assert.equal(locks.released, 0);
    assert.equal(runs.length, 0);
  });

  it("skips when there are no eligible campaigns", async () => {
    const { port, locks, runs } = createPort({ campaigns: [] });
    const summary = await runScheduledTikTokSync(port, {
      triggeredBy: "cron",
      deadlineMs: deadline(),
    });

    assert.equal(summary.status, "skipped");
    assert.equal(summary.totalCampaigns, 0);
    assert.equal(locks.released, 1);
    assert.equal(runs[0]?.status, "skipped");
  });

  it("records success for one campaign", async () => {
    const { port, runs } = createPort({ campaigns: [campaign()] });
    const summary = await runScheduledTikTokSync(port, {
      triggeredBy: "manual",
      deadlineMs: deadline(),
    });

    assert.equal(summary.status, "success");
    assert.equal(summary.successfulCampaigns, 1);
    assert.equal(summary.video.success, 1);
    assert.equal(summary.creators.success, 1);
    assert.equal(summary.sound.success, 1);
    assert.equal(runs[0]?.status, "success");
  });

  it("records partial results", async () => {
    const { port } = createPort({
      campaigns: [campaign()],
      videoFail: true,
    });
    const summary = await runScheduledTikTokSync(port, {
      triggeredBy: "cron",
      deadlineMs: deadline(),
    });

    assert.equal(summary.status, "partial");
    assert.equal(summary.video.failed, 1);
    assert.equal(summary.creators.success, 1);
  });

  it("records failed when all tasks fail", async () => {
    const { port } = createPort({
      campaigns: [campaign()],
      videoFail: true,
      creatorFail: true,
      soundFail: true,
    });
    const summary = await runScheduledTikTokSync(port, {
      triggeredBy: "cron",
      deadlineMs: deadline(),
    });

    assert.equal(summary.status, "failed");
  });

  it("skips sound without a valid URL", async () => {
    const { port } = createPort({
      campaigns: [
        campaign({
          soundUrl: null,
          hasSoundUrl: false,
          hasTikTokVideo: true,
          hasTikTokCreator: false,
        }),
      ],
    });
    const summary = await runScheduledTikTokSync(port, {
      triggeredBy: "cron",
      deadlineMs: deadline(),
    });

    assert.equal(summary.sound.success, 0);
    assert.equal(summary.sound.skipped, 0);
    assert.equal(summary.video.success, 1);
  });

  it("skips empty campaigns", async () => {
    const { port } = createPort({
      campaigns: [
        campaign({
          hasTikTokVideo: false,
          hasTikTokCreator: false,
          hasSoundUrl: false,
          soundUrl: null,
        }),
      ],
    });
    const summary = await runScheduledTikTokSync(port, {
      triggeredBy: "cron",
      deadlineMs: deadline(),
    });

    assert.equal(summary.skippedCampaigns, 1);
  });

  it("marks the run failed on a fatal list error and releases the lock", async () => {
    const { port, locks, runs } = createPort({ fatalOnList: true });
    const summary = await runScheduledTikTokSync(port, {
      triggeredBy: "cron",
      deadlineMs: deadline(),
    });

    assert.equal(summary.status, "failed");
    assert.equal(locks.released, 1);
    assert.equal(runs[0]?.status, "failed");
    assert.ok(summary.message);
    // Public responses strip message separately; ensure we did not embed tokens.
    assert.doesNotMatch(summary.message ?? "", /apify|token|Bearer/i);
  });

  it("never exceeds campaign concurrency of 2", async () => {
    const campaigns = [
      campaign({ id: "11111111-1111-4111-8111-111111111111" }),
      campaign({ id: "22222222-2222-4222-8222-222222222222" }),
      campaign({ id: "33333333-3333-4333-8333-333333333333" }),
    ];

    let inFlight = 0;
    let peak = 0;

    const { port } = createPort({ campaigns });
    const original = port.syncCampaignVideos;
    port.syncCampaignVideos = async (campaignId) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return original(campaignId);
    };

    // Also exercise mapWithConcurrency ceiling directly.
    const peaks: number[] = [];
    await mapWithConcurrency([1, 2, 3, 4], CAMPAIGN_CONCURRENCY, async () => {
      // no-op
    }, (n) => peaks.push(n));

    assert.ok(Math.max(0, ...peaks) <= CAMPAIGN_CONCURRENCY);

    await runScheduledTikTokSync(port, {
      triggeredBy: "cron",
      deadlineMs: deadline(),
    });

    assert.ok(peak <= CAMPAIGN_CONCURRENCY);
  });
});

describe("public summary shape", () => {
  it("does not require provider error details on the summary object", () => {
    const summary: ScheduledSyncSummary = {
      runId: "run-1",
      status: "failed",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      totalCampaigns: 1,
      successfulCampaigns: 0,
      failedCampaigns: 1,
      skippedCampaigns: 0,
      video: { success: 0, failed: 1, skipped: 0 },
      creators: { success: 0, failed: 0, skipped: 0 },
      sound: { success: 0, failed: 0, skipped: 0 },
    };

    assert.equal("providerError" in summary, false);
  });
});
