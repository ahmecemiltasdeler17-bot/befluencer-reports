import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ApifyTikTokProvider,
  type ApifyFetchImpl,
} from "@/lib/providers/tiktok/apify-provider.core";
import { ApifyRunTracker } from "@/lib/providers/tiktok/apify-run-tracker";
import { validCompleteItem } from "@/lib/providers/tiktok/__fixtures__/apify-responses";
import {
  chunkArray,
  evaluateVideoSyncEligibility,
} from "@/lib/providers/tiktok/sync-eligibility";
import { VIDEO_BATCH_SIZE, CREATOR_BATCH_SIZE } from "@/lib/providers/tiktok/sync-policy";
import type {
  TikTokCreatorProvider,
  TikTokMetricsProvider,
  TikTokVideoMetrics,
} from "@/lib/providers/tiktok/types";
import { TikTokProviderError } from "@/lib/providers/tiktok/errors";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type CapturedStart = {
  url: string;
  body: Record<string, unknown>;
};

/**
 * Mock Apify HTTP: one /runs POST returns SUCCEEDED + dataset items.
 * Counts real actor-start POSTs only.
 */
function createMockApifyFetch(options: {
  videoItemsByUrl?: Map<string, unknown>;
  creatorDataset?: unknown[];
}): {
  fetchImpl: ApifyFetchImpl;
  starts: CapturedStart[];
} {
  const starts: CapturedStart[] = [];
  let runSeq = 0;

  const fetchImpl: ApifyFetchImpl = async (input, init) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();

    if (method === "POST" && url.includes("/runs?") && !url.includes("run-sync")) {
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<
        string,
        unknown
      >;
      starts.push({ url, body });
      runSeq += 1;
      return jsonResponse({
        data: {
          id: `run-${runSeq}`,
          status: "SUCCEEDED",
          defaultDatasetId: `dataset-${runSeq}`,
          defaultKeyValueStoreId: `kv-${runSeq}`,
        },
      });
    }

    if (method === "GET" && url.includes("/datasets/") && url.includes("/items")) {
      const datasetMatch = url.match(/datasets\/([^/?]+)/);
      const datasetId = datasetMatch?.[1] ?? "";
      const runIndex = Number(datasetId.replace("dataset-", "")) - 1;
      const start = starts[runIndex];
      const postURLs = Array.isArray(start?.body.postURLs)
        ? (start.body.postURLs as string[])
        : [];

      if (postURLs.length > 0 && options.videoItemsByUrl) {
        const items = postURLs
          .map((postUrl) => options.videoItemsByUrl?.get(postUrl))
          .filter(Boolean);
        return jsonResponse(items);
      }

      return jsonResponse(options.creatorDataset ?? []);
    }

    if (method === "GET" && url.includes("/actor-runs/") && url.includes("/log")) {
      return new Response("", { status: 200 });
    }

    if (method === "GET" && url.includes("/key-value-stores/")) {
      return jsonResponse(null, 404);
    }

    if (method === "POST" && url.includes("run-sync-get-dataset-items")) {
      starts.push({
        url,
        body: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>,
      });
      return jsonResponse([]);
    }

    return jsonResponse({ error: { type: "not-found" } }, 404);
  };

  return { fetchImpl, starts };
}

function makeVideoItem(id: string, url: string, views: number) {
  return {
    ...validCompleteItem,
    id,
    webVideoUrl: url,
    playCount: views,
  };
}

describe("Apify video batch boundary (real actor-start count)", () => {
  it("10 video URLs → exactly 1 actor start with all 10 postURLs", async () => {
    const urls = Array.from({ length: 10 }, (_, i) => {
      const id = `71234567890123456${String(i).padStart(2, "0")}`;
      return {
        id,
        url: `https://www.tiktok.com/@creator/video/${id}`,
      };
    });

    const videoItemsByUrl = new Map(
      urls.map((item, index) => [
        item.url,
        makeVideoItem(item.id, item.url, 1000 + index),
      ])
    );

    const tracker = new ApifyRunTracker();
    const { fetchImpl, starts } = createMockApifyFetch({ videoItemsByUrl });
    const provider = new ApifyTikTokProvider("test-token", "clockworks~tiktok-scraper", {
      fetchImpl,
      runTracker: tracker,
    });

    const batch = await provider.fetchVideoMetricsBatch(
      urls.map((item) => ({
        videoUrl: item.url,
        platformVideoId: item.id,
      }))
    );

    assert.equal(starts.length, 1, "actor start HTTP POST count");
    assert.equal(tracker.actorRunsStarted, 1);
    assert.equal(batch.actorRunsStarted, 1);

    const postURLs = starts[0].body.postURLs as string[];
    assert.equal(postURLs.length, 10);
    for (const item of urls) {
      assert.ok(postURLs.includes(item.url));
      const result = batch.results.get(item.url);
      assert.equal(result?.status, "ok");
    }
  });

  it("11 video URLs with batch size 10 → exactly 2 actor starts", async () => {
    const urls = Array.from({ length: 11 }, (_, i) => {
      const id = `81234567890123456${String(i).padStart(2, "0")}`;
      return {
        id,
        url: `https://www.tiktok.com/@creator/video/${id}`,
      };
    });

    const videoItemsByUrl = new Map(
      urls.map((item, index) => [
        item.url,
        makeVideoItem(item.id, item.url, 2000 + index),
      ])
    );

    const tracker = new ApifyRunTracker();
    const { fetchImpl, starts } = createMockApifyFetch({ videoItemsByUrl });
    const provider = new ApifyTikTokProvider("test-token", "clockworks~tiktok-scraper", {
      fetchImpl,
      runTracker: tracker,
    });

    const chunks = chunkArray(urls, VIDEO_BATCH_SIZE);
    assert.equal(chunks.length, 2);

    let totalStarts = 0;
    for (const chunk of chunks) {
      const batch = await provider.fetchVideoMetricsBatch(
        chunk.map((item) => ({
          videoUrl: item.url,
          platformVideoId: item.id,
        }))
      );
      totalStarts += batch.actorRunsStarted;
    }

    assert.equal(starts.length, 2);
    assert.equal(tracker.actorRunsStarted, 2);
    assert.equal(totalStarts, 2);
    assert.equal((starts[0].body.postURLs as string[]).length, 10);
    assert.equal((starts[1].body.postURLs as string[]).length, 1);
  });
});

describe("Apify creator batch boundary (real actor-start count)", () => {
  it("5 creators → exactly 1 actor start with 5 profiles", async () => {
    const usernames = ["a1", "a2", "a3", "a4", "a5"];
    const dataset = usernames.map((username) => ({
      authorMeta: {
        name: username,
        nickName: username,
        fans: 10_000,
        avatar: "https://cdn.example.com/a.jpg",
      },
      id: `vid-${username}`,
      playCount: 1,
      diggCount: 1,
      commentCount: 1,
      shareCount: 1,
    }));

    const tracker = new ApifyRunTracker();
    const { fetchImpl, starts } = createMockApifyFetch({
      creatorDataset: dataset,
    });
    const provider = new ApifyTikTokProvider("test-token", "clockworks~tiktok-scraper", {
      fetchImpl,
      runTracker: tracker,
    });

    const batch = await provider.fetchCreatorProfilesBatch(
      usernames.map((username) => ({ username }))
    );

    assert.equal(starts.length, 1);
    assert.equal(tracker.actorRunsStarted, 1);
    assert.equal(batch.actorRunsStarted, 1);
    assert.deepEqual(starts[0].body.profiles, usernames);

    for (const username of usernames) {
      assert.equal(batch.results.get(username)?.status, "ok");
    }
  });

  it("6 creators with batch size 5 → exactly 2 actor starts", async () => {
    const usernames = ["b1", "b2", "b3", "b4", "b5", "b6"];
    const datasetFor = (names: string[]) =>
      names.map((username) => ({
        authorMeta: {
          name: username,
          nickName: username,
          fans: 10_000,
          avatar: "https://cdn.example.com/a.jpg",
        },
        id: `vid-${username}`,
        playCount: 1,
        diggCount: 1,
        commentCount: 1,
        shareCount: 1,
      }));

    const tracker = new ApifyRunTracker();
    const starts: CapturedStart[] = [];
    let runSeq = 0;

    const fetchImpl: ApifyFetchImpl = async (input, init) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();

      if (method === "POST" && url.includes("/runs?")) {
        const body = JSON.parse(String(init?.body ?? "{}")) as Record<
          string,
          unknown
        >;
        starts.push({ url, body });
        runSeq += 1;
        return jsonResponse({
          data: {
            id: `run-${runSeq}`,
            status: "SUCCEEDED",
            defaultDatasetId: `dataset-${runSeq}`,
            defaultKeyValueStoreId: `kv-${runSeq}`,
          },
        });
      }

      if (method === "GET" && url.includes("/datasets/") && url.includes("/items")) {
        const datasetMatch = url.match(/datasets\/([^/?]+)/);
        const datasetId = datasetMatch?.[1] ?? "";
        const runIndex = Number(datasetId.replace("dataset-", "")) - 1;
        const profiles = (starts[runIndex]?.body.profiles as string[]) ?? [];
        return jsonResponse(datasetFor(profiles));
      }

      if (method === "GET" && url.includes("/log")) {
        return new Response("", { status: 200 });
      }

      if (method === "GET" && url.includes("/key-value-stores/")) {
        return jsonResponse(null, 404);
      }

      return jsonResponse({}, 404);
    };

    const provider = new ApifyTikTokProvider("test-token", "clockworks~tiktok-scraper", {
      fetchImpl,
      runTracker: tracker,
    });

    const chunks = chunkArray(usernames, CREATOR_BATCH_SIZE);
    assert.equal(chunks.length, 2);

    let total = 0;
    for (const chunk of chunks) {
      const batch = await provider.fetchCreatorProfilesBatch(
        chunk.map((username) => ({ username }))
      );
      total += batch.actorRunsStarted;
    }

    assert.equal(starts.length, 2);
    assert.equal(tracker.actorRunsStarted, 2);
    assert.equal(total, 2);
    assert.deepEqual(starts[0].body.profiles, usernames.slice(0, 5));
    assert.deepEqual(starts[1].body.profiles, usernames.slice(5));
  });
});

describe("orchestration freshness: second normal sync → 0 provider calls", () => {
  it("skips provider when last successful sync is fresh", async () => {
    let providerCalls = 0;

    const metrics: TikTokVideoMetrics = {
      platformVideoId: "7123456789012345678",
      videoUrl: "https://www.tiktok.com/@creator/video/7123456789012345678",
      creatorUsername: "creator",
      creatorDisplayName: "Creator",
      creatorAvatarUrl: null,
      creatorFollowerCount: 1,
      caption: "x",
      thumbnailUrl: null,
      publishedAt: null,
      views: 10,
      likes: 1,
      comments: 1,
      shares: 1,
      saves: 0,
    };

    const provider: TikTokMetricsProvider = {
      async fetchVideoMetrics() {
        providerCalls += 1;
        return metrics;
      },
      async fetchVideoMetricsBatch(requests) {
        providerCalls += 1;
        const results = new Map();
        for (const request of requests) {
          results.set(request.videoUrl, { status: "ok", metrics });
        }
        return { results, actorRunsStarted: 1 };
      },
    };

    const now = Date.parse("2026-08-08T12:00:00.000Z");
    const lastSyncedAt = new Date(now - 60_000).toISOString();

    // Simulate orchestration gate used by syncTikTokVideo / campaign sync.
    const first = evaluateVideoSyncEligibility({
      lastSyncedAt: null,
      syncStatus: "pending",
      campaignStatus: "active",
      force: false,
      nowMs: now,
    });
    assert.equal(first.eligible, true);

    if (first.eligible) {
      await provider.fetchVideoMetricsBatch([
        {
          videoUrl: metrics.videoUrl,
          platformVideoId: metrics.platformVideoId,
        },
      ]);
    }

    const second = evaluateVideoSyncEligibility({
      lastSyncedAt,
      syncStatus: "success",
      latestSuccessfulSnapshotAt: lastSyncedAt,
      campaignStatus: "active",
      force: false,
      manualCooldown: true,
      nowMs: now,
    });
    assert.equal(second.eligible, false);
    if (!second.eligible) {
      assert.ok(
        second.reason === "fresh" || second.reason === "cooldown"
      );
    }

    if (second.eligible) {
      await provider.fetchVideoMetricsBatch([
        {
          videoUrl: metrics.videoUrl,
          platformVideoId: metrics.platformVideoId,
        },
      ]);
    }

    assert.equal(providerCalls, 1, "second normal sync must not call provider");
  });

  it("force=true bypasses freshness and may call provider", async () => {
    let providerCalls = 0;
    const provider: TikTokCreatorProvider = {
      async fetchCreatorProfile() {
        providerCalls += 1;
        throw new TikTokProviderError("empty_result");
      },
      async fetchCreatorProfilesBatch() {
        providerCalls += 1;
        return { results: new Map(), actorRunsStarted: 1 };
      },
    };

    const now = Date.now();
    const decision = evaluateVideoSyncEligibility({
      lastSyncedAt: new Date(now - 1000).toISOString(),
      syncStatus: "success",
      campaignStatus: "active",
      force: true,
      nowMs: now,
    });
    assert.equal(decision.eligible, true);
    if (decision.eligible) {
      await provider.fetchCreatorProfilesBatch([{ username: "x" }]);
    }
    assert.equal(providerCalls, 1);
  });
});

describe("UI actions must not force-refresh by default", () => {
  it("sync action sources do not pass force: true", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const syncActions = readFileSync(
      path.join(process.cwd(), "features/sync/actions.ts"),
      "utf8"
    );
    const creatorActions = readFileSync(
      path.join(process.cwd(), "features/creator-sync/actions.ts"),
      "utf8"
    );
    const soundActions = readFileSync(
      path.join(process.cwd(), "features/sound-sync/actions.ts"),
      "utf8"
    );

    assert.doesNotMatch(syncActions, /force:\s*true/);
    assert.doesNotMatch(creatorActions, /force:\s*true/);
    assert.doesNotMatch(soundActions, /force:\s*true/);
  });
});
