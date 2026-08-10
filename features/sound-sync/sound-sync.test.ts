import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  runSoundSync,
  type SoundSyncPatch,
  type SoundSyncPort,
} from "@/features/sound-sync/services/sound-sync-core";
import type {
  CampaignSoundConfiguration,
  SoundMetricSnapshot,
} from "@/features/sound-sync/types";
import { TikTokProviderError } from "@/lib/providers/tiktok/errors";
import type {
  TikTokSoundProfile,
  TikTokSoundProvider,
} from "@/lib/providers/tiktok/types";

const CAMPAIGN_ID = "11111111-1111-4111-8111-111111111111";
const SOUND_URL =
  "https://www.tiktok.com/music/a-negroni-sbagliato-w-prosecco-l-hbo-max-7149523537730997035";

function profile(usageCount: number): TikTokSoundProfile {
  return {
    soundId: "7149523537730997035",
    soundUrl: SOUND_URL,
    title: "Test Sound",
    authorName: "Artist",
    usageCount,
    coverUrl: null,
  };
}

function createPort(options?: {
  config?: CampaignSoundConfiguration | null;
  latest?: SoundMetricSnapshot | null;
}): {
  port: SoundSyncPort;
  patches: SoundSyncPatch[];
  snapshots: Array<{ usageCount: number; source: "apify" }>;
  jobs: Array<{ status: string; error: string | null }>;
  failedMessages: string[];
  revalidated: string[];
} {
  const patches: SoundSyncPatch[] = [];
  const snapshots: Array<{ usageCount: number; source: "apify" }> = [];
  const jobs: Array<{ status: string; error: string | null }> = [];
  const failedMessages: string[] = [];
  const revalidated: string[] = [];

  const config =
    options?.config === undefined
      ? {
          campaignId: CAMPAIGN_ID,
          soundUrl: SOUND_URL,
          soundId: "7149523537730997035",
          soundTitle: "Manual Title",
          soundAuthor: "Manual Author",
          lastSyncedAt: null,
          syncStatus: "pending" as const,
          syncError: null,
        }
      : options.config;

  const port: SoundSyncPort = {
    async loadConfiguration() {
      return config;
    },
    async createJob() {
      return "job-1";
    },
    async getLatestSnapshot() {
      return options?.latest ?? null;
    },
    async insertSnapshot(_campaignId, usageCount, source) {
      snapshots.push({ usageCount, source });
    },
    async updateCampaign(_campaignId, patch) {
      patches.push(patch);
    },
    async markCampaignFailed(_campaignId, errorMessage) {
      failedMessages.push(errorMessage);
    },
    async completeJob(_jobId, status, _completedAt, errorMessage) {
      jobs.push({ status, error: errorMessage });
    },
    async revalidate(campaignId) {
      revalidated.push(campaignId);
    },
  };

  return { port, patches, snapshots, jobs, failedMessages, revalidated };
}

function providerOf(
  impl: TikTokSoundProvider["fetchSoundProfile"]
): TikTokSoundProvider {
  return { fetchSoundProfile: impl };
}

describe("runSoundSync", () => {
  it("syncs successfully and appends the first snapshot", async () => {
    const { port, patches, snapshots, jobs, revalidated } = createPort();
    const result = await runSoundSync(
      CAMPAIGN_ID,
      providerOf(async () => profile(80_300)),
      port,
      () => new Date("2026-08-06T12:00:00.000Z")
    );

    assert.equal(result.outcome, "success");
    assert.equal(result.snapshotCreated, true);
    assert.equal(snapshots.length, 1);
    assert.equal(snapshots[0].source, "apify");
    assert.equal(patches[0].sound_sync_status, "success");
    assert.equal(patches[0].tiktok_sound_title, "Test Sound");
    assert.equal(jobs[0].status, "success");
    assert.deepEqual(revalidated, [CAMPAIGN_ID]);
  });

  it("does not append an unchanged recent value", async () => {
    const { port, snapshots } = createPort({
      latest: {
        id: "snap-1",
        campaign_id: CAMPAIGN_ID,
        captured_at: "2026-08-06T10:00:00.000Z",
        usage_count: 80_300,
        source: "manual",
        created_at: "2026-08-06T10:00:00.000Z",
      },
    });

    const result = await runSoundSync(
      CAMPAIGN_ID,
      providerOf(async () => profile(80_300)),
      port,
      () => new Date("2026-08-06T12:00:00.000Z")
    );

    assert.equal(result.outcome, "success");
    assert.equal(result.snapshotCreated, false);
    assert.equal(snapshots.length, 0);
  });

  it("appends an unchanged value after 24 hours", async () => {
    const { port, snapshots } = createPort({
      latest: {
        id: "snap-1",
        campaign_id: CAMPAIGN_ID,
        captured_at: "2026-08-05T11:00:00.000Z",
        usage_count: 80_300,
        source: "apify",
        created_at: "2026-08-05T11:00:00.000Z",
      },
    });

    const result = await runSoundSync(
      CAMPAIGN_ID,
      providerOf(async () => profile(80_300)),
      port,
      () => new Date("2026-08-06T12:00:00.000Z")
    );

    assert.equal(result.snapshotCreated, true);
    assert.equal(snapshots.length, 1);
  });

  it("appends when usage changed", async () => {
    const { port, snapshots } = createPort({
      latest: {
        id: "snap-1",
        campaign_id: CAMPAIGN_ID,
        captured_at: "2026-08-06T10:00:00.000Z",
        usage_count: 70_000,
        source: "manual",
        created_at: "2026-08-06T10:00:00.000Z",
      },
    });

    const result = await runSoundSync(
      CAMPAIGN_ID,
      providerOf(async () => profile(80_300)),
      port,
      () => new Date("2026-08-06T12:00:00.000Z")
    );

    assert.equal(result.snapshotCreated, true);
    assert.equal(snapshots[0].usageCount, 80_300);
  });

  it("preserves prior metadata on provider failure", async () => {
    const { port, patches, snapshots, jobs, failedMessages } = createPort();

    const result = await runSoundSync(
      CAMPAIGN_ID,
      providerOf(async () => {
        throw new TikTokProviderError("sound_usage_unavailable");
      }),
      port
    );

    assert.equal(result.outcome, "failed");
    assert.equal(snapshots.length, 0);
    assert.equal(patches.length, 0);
    assert.equal(jobs[0].status, "failed");
    assert.ok(failedMessages[0]?.includes("kullanım"));
  });

  it("does not insert a snapshot on identity mismatch", async () => {
    const { port, snapshots, patches } = createPort();

    const result = await runSoundSync(
      CAMPAIGN_ID,
      providerOf(async () => {
        throw new TikTokProviderError("sound_identity_mismatch");
      }),
      port
    );

    assert.equal(result.outcome, "failed");
    assert.equal(snapshots.length, 0);
    assert.equal(patches.length, 0);
  });

  it("preserves manual title when provider omits title", async () => {
    const { port, patches } = createPort();

    await runSoundSync(
      CAMPAIGN_ID,
      providerOf(async () => ({
        ...profile(80_300),
        title: null,
        authorName: null,
      })),
      port
    );

    assert.equal(patches[0].tiktok_sound_title, undefined);
    assert.equal(patches[0].tiktok_sound_author, undefined);
    assert.equal(patches[0].tiktok_sound_cover_url, undefined);
    assert.equal(patches[0].tiktok_sound_id, "7149523537730997035");
  });

  it("persists provider cover URL when present", async () => {
    const { port, patches } = createPort();
    const coverUrl = "https://cdn.example.com/sound-cover.jpg";

    await runSoundSync(
      CAMPAIGN_ID,
      providerOf(async () => ({
        ...profile(80_300),
        coverUrl,
      })),
      port
    );

    assert.equal(patches[0].tiktok_sound_cover_url, coverUrl);
  });

  it("fails when the sound URL is missing", async () => {
    const { port } = createPort({
      config: {
        campaignId: CAMPAIGN_ID,
        soundUrl: null,
        soundId: null,
        soundTitle: null,
        soundAuthor: null,
        lastSyncedAt: null,
        syncStatus: "pending",
        syncError: null,
      },
    });

    const result = await runSoundSync(
      CAMPAIGN_ID,
      providerOf(async () => profile(1)),
      port
    );

    assert.equal(result.outcome, "failed");
    assert.match(result.message, /ses bağlantısı/i);
  });
});
