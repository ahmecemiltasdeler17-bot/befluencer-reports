import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { CreatorSnapshotCandidate } from "@/features/creator-sync/calculations";
import {
  runCampaignCreatorSync,
  runCreatorSync,
  type CampaignCreatorSyncPort,
  type CreatorSyncPatch,
  type CreatorSyncPort,
  type CreatorSyncRecord,
} from "@/features/creator-sync/services/creator-sync-core";
import type {
  CreatorMetricSnapshot,
  SyncCreatorResult,
} from "@/features/creator-sync/types";
import { TikTokProviderError } from "@/lib/providers/tiktok/errors";
import type {
  FetchCreatorProfileInput,
  TikTokCreatorProfile,
  TikTokCreatorProvider,
} from "@/lib/providers/tiktok/types";

const CREATOR_ID = "11111111-1111-4111-8111-111111111111";
const CAMPAIGN_ID = "22222222-2222-4222-8222-222222222222";

function creatorRecord(
  overrides: Partial<CreatorSyncRecord> = {}
): CreatorSyncRecord {
  return {
    id: CREATOR_ID,
    platform: "tiktok",
    username: "ecemdans",
    displayName: "Eski Ad",
    avatarUrl: "https://cdn.example.com/eski-avatar.jpg",
    profileUrl: null,
    followerCount: 10_000,
    category: "micro",
    categorySource: "auto",
    ...overrides,
  };
}

function profile(
  overrides: Partial<TikTokCreatorProfile> = {}
): TikTokCreatorProfile {
  return {
    username: "ecemdans",
    displayName: "Ecem Dans",
    profileUrl: "https://www.tiktok.com/@ecemdans",
    avatarUrl: "https://cdn.example.com/yeni-avatar.jpg",
    followerCount: 12_500,
    followingCount: 312,
    totalLikes: 1_240_000,
    videoCount: 197,
    bio: null,
    verified: null,
    ...overrides,
  };
}

/** Records every port call so a test can assert what was and was not written. */
function createRecordingPort(options: {
  creator?: CreatorSyncRecord | null;
  latestSnapshot?: CreatorMetricSnapshot | null;
}) {
  const calls = {
    jobsCreated: [] as string[],
    snapshots: [] as CreatorSnapshotCandidate[],
    creatorPatches: [] as CreatorSyncPatch[],
    markedFailed: [] as string[],
    completedJobs: [] as Array<{
      status: "success" | "failed";
      errorMessage: string | null;
    }>,
    revalidated: [] as string[],
  };

  const port: CreatorSyncPort = {
    async loadCreator() {
      return options.creator === undefined ? creatorRecord() : options.creator;
    },
    async createJob(creatorId) {
      calls.jobsCreated.push(creatorId);
      return `job-${calls.jobsCreated.length}`;
    },
    async getLatestSnapshot() {
      return options.latestSnapshot ?? null;
    },
    async insertSnapshot(_creatorId, snapshot) {
      calls.snapshots.push(snapshot);
    },
    async updateCreator(_creatorId, patch) {
      calls.creatorPatches.push(patch);
    },
    async markCreatorFailed(creatorId) {
      calls.markedFailed.push(creatorId);
    },
    async completeJob(_jobId, status, _completedAt, errorMessage) {
      calls.completedJobs.push({ status, errorMessage });
    },
    async revalidate(creatorId) {
      calls.revalidated.push(creatorId);
    },
  };

  return { port, calls };
}

function stubProvider(
  result: TikTokCreatorProfile | Error
): TikTokCreatorProvider & { inputs: FetchCreatorProfileInput[] } {
  const inputs: FetchCreatorProfileInput[] = [];

  return {
    inputs,
    async fetchCreatorProfile(input) {
      inputs.push(input);

      if (result instanceof Error) {
        throw result;
      }

      return result;
    },
  };
}

describe("runCreatorSync", () => {
  it("syncs a TikTok creator and appends the first snapshot", async () => {
    const { port, calls } = createRecordingPort({});
    const provider = stubProvider(profile());

    const result = await runCreatorSync(CREATOR_ID, provider, port);

    assert.equal(result.outcome, "success");
    assert.equal(result.snapshotCreated, true);
    assert.equal(result.followerCount, 12_500);
    assert.equal(calls.snapshots.length, 1);
    assert.equal(calls.snapshots[0].followerCount, 12_500);
    assert.equal(calls.snapshots[0].followingCount, 312);
    assert.equal(calls.completedJobs[0].status, "success");
    assert.deepEqual(calls.revalidated, [CREATOR_ID]);
  });

  it("passes only a normalized username to the provider", async () => {
    const { port } = createRecordingPort({
      creator: creatorRecord({
        username: "@ecemdans",
        profileUrl: "https://evil.example.com/@ecemdans",
      }),
    });
    const provider = stubProvider(profile());

    await runCreatorSync(CREATOR_ID, provider, port);

    assert.deepEqual(provider.inputs, [{ username: "ecemdans" }]);
  });

  it("skips a non-TikTok creator without creating a job", async () => {
    const { port, calls } = createRecordingPort({
      creator: creatorRecord({ platform: "instagram" }),
    });
    const provider = stubProvider(profile());

    const result = await runCreatorSync(CREATOR_ID, provider, port);

    assert.equal(result.outcome, "skipped");
    assert.match(result.message, /yalnızca TikTok/);
    assert.equal(calls.jobsCreated.length, 0);
    assert.equal(calls.creatorPatches.length, 0);
    assert.equal(provider.inputs.length, 0);
  });

  it("rejects an invalid creator id before touching any port", async () => {
    const { port, calls } = createRecordingPort({});
    const provider = stubProvider(profile());

    const result = await runCreatorSync("not-a-uuid", provider, port);

    assert.equal(result.outcome, "failed");
    assert.equal(calls.jobsCreated.length, 0);
    assert.equal(provider.inputs.length, 0);
  });

  it("fails when the creator does not exist", async () => {
    const { port, calls } = createRecordingPort({ creator: null });
    const provider = stubProvider(profile());

    const result = await runCreatorSync(CREATOR_ID, provider, port);

    assert.equal(result.outcome, "failed");
    assert.equal(result.message, "İçerik üreticisi bulunamadı.");
    assert.equal(calls.jobsCreated.length, 0);
  });

  it("fails before calling the provider when the username is unusable", async () => {
    const { port, calls } = createRecordingPort({
      creator: creatorRecord({ username: "geçersiz ad!", profileUrl: null }),
    });
    const provider = stubProvider(profile());

    const result = await runCreatorSync(CREATOR_ID, provider, port);

    assert.equal(result.outcome, "failed");
    assert.equal(provider.inputs.length, 0);
    assert.equal(calls.jobsCreated.length, 0);
  });

  it("does not append a snapshot when nothing changed recently", async () => {
    const { port, calls } = createRecordingPort({
      latestSnapshot: {
        id: "snapshot-1",
        creator_id: CREATOR_ID,
        captured_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        follower_count: 12_500,
        following_count: 312,
        total_likes: 1_240_000,
        video_count: 197,
        created_at: new Date().toISOString(),
      },
    });

    const result = await runCreatorSync(CREATOR_ID, stubProvider(profile()), port);

    assert.equal(result.outcome, "success");
    assert.equal(result.snapshotCreated, false);
    assert.equal(calls.snapshots.length, 0);
    // The creator row is still refreshed, so last_synced_at moves forward.
    assert.equal(calls.creatorPatches.length, 1);
  });

  it("appends a snapshot when an unchanged profile was last captured over 24h ago", async () => {
    const { port, calls } = createRecordingPort({
      latestSnapshot: {
        id: "snapshot-1",
        creator_id: CREATOR_ID,
        captured_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
        follower_count: 12_500,
        following_count: 312,
        total_likes: 1_240_000,
        video_count: 197,
        created_at: new Date().toISOString(),
      },
    });

    const result = await runCreatorSync(CREATOR_ID, stubProvider(profile()), port);

    assert.equal(result.snapshotCreated, true);
    assert.equal(calls.snapshots.length, 1);
  });

  it("updates display name, avatar and canonical profile URL", async () => {
    const { port, calls } = createRecordingPort({});

    await runCreatorSync(CREATOR_ID, stubProvider(profile()), port);

    const patch = calls.creatorPatches[0];
    assert.equal(patch.display_name, "Ecem Dans");
    assert.equal(patch.avatar_url, "https://cdn.example.com/yeni-avatar.jpg");
    assert.equal(patch.profile_url, "https://www.tiktok.com/@ecemdans");
    assert.equal(patch.follower_count, 12_500);
    assert.equal(patch.sync_status, "success");
  });

  it("never writes campaign fee or notes", async () => {
    const { port, calls } = createRecordingPort({});

    await runCreatorSync(CREATOR_ID, stubProvider(profile()), port);

    const keys = Object.keys(calls.creatorPatches[0]);
    for (const forbidden of ["fee", "agreed_content_count", "notes", "category_source"]) {
      assert.equal(keys.includes(forbidden), false);
    }
  });

  it("updates auto category from the synced follower count", async () => {
    const { port, calls } = createRecordingPort({
      creator: creatorRecord({ category: null, categorySource: "auto" }),
    });

    await runCreatorSync(
      CREATOR_ID,
      stubProvider(profile({ followerCount: 12_500 })),
      port
    );

    assert.equal(calls.creatorPatches[0]?.category, "micro");
  });

  it("moves auto category when the follower tier changes", async () => {
    const { port, calls } = createRecordingPort({
      creator: creatorRecord({
        category: "micro",
        categorySource: "auto",
        followerCount: 12_500,
      }),
    });

    await runCreatorSync(
      CREATOR_ID,
      stubProvider(profile({ followerCount: 150_000 })),
      port
    );

    assert.equal(calls.creatorPatches[0]?.category, "macro");
  });

  it("preserves a manual category after a successful sync", async () => {
    const { port, calls } = createRecordingPort({
      creator: creatorRecord({
        category: "macro",
        categorySource: "manual",
        followerCount: 5_000,
      }),
    });

    await runCreatorSync(
      CREATOR_ID,
      stubProvider(profile({ followerCount: 12_500 })),
      port
    );

    assert.equal("category" in (calls.creatorPatches[0] ?? {}), false);
  });

  it("does not change category on a failed sync", async () => {
    const { port, calls } = createRecordingPort({
      creator: creatorRecord({
        category: "nano",
        categorySource: "auto",
      }),
    });

    const result = await runCreatorSync(
      CREATOR_ID,
      stubProvider(new Error("upstream")),
      port
    );

    assert.equal(result.outcome, "failed");
    assert.equal(calls.creatorPatches.length, 0);
    assert.equal(calls.markedFailed.length, 1);
  });

  it("does not blank out a curated display name or avatar when the provider returns nothing", async () => {
    const { port, calls } = createRecordingPort({});

    await runCreatorSync(
      CREATOR_ID,
      stubProvider(profile({ displayName: "   ", avatarUrl: null })),
      port
    );

    const patch = calls.creatorPatches[0];
    assert.equal("display_name" in patch, false);
    assert.equal("avatar_url" in patch, false);
  });

  it("preserves the existing follower count when the provider fails", async () => {
    const { port, calls } = createRecordingPort({});
    const provider = stubProvider(new TikTokProviderError("rate_limit"));

    const result = await runCreatorSync(CREATOR_ID, provider, port);

    assert.equal(result.outcome, "failed");
    assert.equal(result.followerCount, 10_000);
    assert.equal(calls.creatorPatches.length, 0);
    assert.equal(calls.snapshots.length, 0);
    assert.deepEqual(calls.markedFailed, [CREATOR_ID]);
    assert.equal(calls.completedJobs[0].status, "failed");
  });

  it("does not patch or snapshot when follower count is unavailable", async () => {
    const { port, calls } = createRecordingPort({});
    const provider = stubProvider(
      new TikTokProviderError("follower_count_unavailable")
    );

    const result = await runCreatorSync(CREATOR_ID, provider, port);

    assert.equal(result.outcome, "failed");
    assert.equal(
      result.message,
      "Profil bulundu ancak takipçi sayısı alınamadı."
    );
    assert.equal(result.followerCount, 10_000);
    assert.equal(calls.creatorPatches.length, 0);
    assert.equal(calls.snapshots.length, 0);
  });

  it("does not patch or snapshot when the provider returns an empty profile result", async () => {
    const { port, calls } = createRecordingPort({});
    const provider = stubProvider(
      new TikTokProviderError(
        "empty_result",
        "TikTok sağlayıcısı bu profil için boş sonuç döndürdü."
      )
    );

    const result = await runCreatorSync(CREATOR_ID, provider, port);

    assert.equal(result.outcome, "failed");
    assert.equal(
      result.message,
      "TikTok sağlayıcısı bu profil için boş sonuç döndürdü."
    );
    assert.equal(calls.creatorPatches.length, 0);
    assert.equal(calls.snapshots.length, 0);
  });

  it("does not insert a snapshot or patch the creator after an identity mismatch", async () => {
    const { port, calls } = createRecordingPort({});
    const provider = stubProvider(new TikTokProviderError("username_mismatch"));

    const result = await runCreatorSync(CREATOR_ID, provider, port);

    assert.equal(result.outcome, "failed");
    assert.equal(
      result.message,
      "Sağlayıcı farklı bir TikTok hesabı döndürdü. Kullanıcı adını kontrol edin."
    );
    assert.equal(result.snapshotCreated, false);
    assert.equal(result.followerCount, 10_000);
    assert.equal(calls.snapshots.length, 0);
    assert.equal(calls.creatorPatches.length, 0);
    assert.deepEqual(calls.markedFailed, [CREATOR_ID]);
    assert.equal(calls.completedJobs[0].status, "failed");
  });

  it("stores a sanitized Turkish failure message, not the upstream text", async () => {
    const { port, calls } = createRecordingPort({});
    const provider = stubProvider(
      new TikTokProviderError("private_profile", undefined)
    );

    const result = await runCreatorSync(CREATOR_ID, provider, port);

    assert.equal(result.message, "TikTok profili gizli veya kullanılamıyor.");
    assert.equal(
      calls.completedJobs[0].errorMessage,
      "TikTok profili gizli veya kullanılamıyor."
    );
  });

  it("does not leak a raw provider payload through an unexpected error", async () => {
    const { port, calls } = createRecordingPort({});
    const provider: TikTokCreatorProvider = {
      async fetchCreatorProfile() {
        throw { token: "secret-token", body: "raw payload" };
      },
    };

    const result = await runCreatorSync(CREATOR_ID, provider, port);

    assert.equal(
      result.message,
      "TikTok profili alınırken beklenmeyen bir hata oluştu."
    );
    assert.equal(calls.completedJobs[0].errorMessage?.includes("secret"), false);
  });

  it("marks the job failed when the snapshot insert fails", async () => {
    const { port, calls } = createRecordingPort({});
    port.insertSnapshot = async () => {
      throw new Error("Takipçi kaydı zaman çakışması nedeniyle oluşturulamadı.");
    };

    const result = await runCreatorSync(CREATOR_ID, stubProvider(profile()), port);

    assert.equal(result.outcome, "failed");
    assert.equal(calls.creatorPatches.length, 0);
    assert.equal(calls.completedJobs[0].status, "failed");
  });
});

describe("runCampaignCreatorSync", () => {
  function createCampaignPort(
    creators: Array<{ id: string; platform: string }>,
    outcomes: Record<string, SyncCreatorResult["outcome"]> = {}
  ) {
    const synced: string[] = [];

    const port: CampaignCreatorSyncPort = {
      async campaignExists() {
        return true;
      },
      async listAssignedCreators() {
        return creators;
      },
      async syncCreator(creatorId) {
        synced.push(creatorId);

        const outcome = outcomes[creatorId] ?? "success";

        return {
          outcome,
          message: outcome,
          snapshotCreated: outcome === "success",
          followerCount: 1_000,
          jobId: `job-${creatorId}`,
        };
      },
      async revalidate() {},
    };

    return { port, synced };
  }

  it("syncs each TikTok creator once and skips other platforms", async () => {
    const { port, synced } = createCampaignPort([
      { id: "a", platform: "tiktok" },
      { id: "a", platform: "tiktok" },
      { id: "b", platform: "instagram" },
      { id: "c", platform: "tiktok" },
    ]);

    const result = await runCampaignCreatorSync(CAMPAIGN_ID, port);

    assert.deepEqual(synced, ["a", "c"]);
    assert.equal(result.total, 3);
    assert.equal(result.success, 2);
    assert.equal(result.failed, 0);
    assert.equal(result.skipped, 1);
    assert.match(result.message, /2 TikTok profili güncellendi, 1 atlandı\./);
  });

  it("continues after an individual failure", async () => {
    const { port, synced } = createCampaignPort(
      [
        { id: "a", platform: "tiktok" },
        { id: "b", platform: "tiktok" },
        { id: "c", platform: "tiktok" },
      ],
      { b: "failed" }
    );

    const result = await runCampaignCreatorSync(CAMPAIGN_ID, port);

    assert.deepEqual(synced, ["a", "b", "c"]);
    assert.equal(result.success, 2);
    assert.equal(result.failed, 1);
    assert.match(result.message, /2 başarılı, 1 başarısız\./);
  });

  it("never runs more than two provider calls at a time", async () => {
    const { port } = createCampaignPort(
      Array.from({ length: 7 }, (_, index) => ({
        id: `creator-${index}`,
        platform: "tiktok",
      }))
    );

    let peak = 0;

    await runCampaignCreatorSync(CAMPAIGN_ID, port, (inFlight) => {
      peak = Math.max(peak, inFlight);
    });

    assert.equal(peak <= 2, true);
  });

  it("reports nothing to do when no TikTok creator is assigned", async () => {
    const { port, synced } = createCampaignPort([
      { id: "a", platform: "instagram" },
      { id: "b", platform: "youtube" },
    ]);

    const result = await runCampaignCreatorSync(CAMPAIGN_ID, port);

    assert.deepEqual(synced, []);
    assert.equal(result.skipped, 2);
    assert.match(result.message, /TikTok profili bulunamadı/);
  });

  it("rejects an invalid campaign id", async () => {
    const { port, synced } = createCampaignPort([
      { id: "a", platform: "tiktok" },
    ]);

    const result = await runCampaignCreatorSync("not-a-uuid", port);

    assert.equal(result.message, "Geçersiz kampanya kimliği.");
    assert.deepEqual(synced, []);
  });

  it("reports a missing campaign", async () => {
    const { port } = createCampaignPort([{ id: "a", platform: "tiktok" }]);
    port.campaignExists = async () => false;

    const result = await runCampaignCreatorSync(CAMPAIGN_ID, port);

    assert.equal(result.message, "Kampanya bulunamadı.");
  });
});
