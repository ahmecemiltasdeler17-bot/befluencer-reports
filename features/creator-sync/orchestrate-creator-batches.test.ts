import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";

import { orchestrateCreatorBatchFetches } from "@/features/creator-sync/services/orchestrate-creator-batches";
import {
  ApifyTikTokProvider,
  type ApifyFetchImpl,
} from "@/lib/providers/tiktok/apify-provider.core";
import { ApifyRunTracker } from "@/lib/providers/tiktok/apify-run-tracker";
import { TikTokProviderError } from "@/lib/providers/tiktok/errors";
import {
  assertCreatorBatchInputIntact,
  buildCreatorBatchInput,
} from "@/lib/providers/tiktok/build-creator-batch-input";
import { CREATOR_BATCH_SIZE } from "@/lib/providers/tiktok/sync-policy";
import type { FetchCreatorProfileInput } from "@/lib/providers/tiktok/types";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("buildCreatorBatchInput", () => {
  it("builds profiles and startUrls of equal multi length", () => {
    const { prepared, input } = buildCreatorBatchInput([
      "creator1",
      "@creator2",
      "creator3",
      "creator1", // dedupe
      "creator4",
      "creator5",
    ]);

    assert.equal(prepared.length, 5);
    assert.equal(input.profiles.length, 5);
    assert.equal(input.startUrls.length, 5);
    assert.deepEqual(input.profiles, [
      "creator1",
      "creator2",
      "creator3",
      "creator4",
      "creator5",
    ]);
    for (let i = 0; i < input.profiles.length; i += 1) {
      assert.equal(
        input.startUrls[i]?.url,
        `https://www.tiktok.com/@${input.profiles[i]}`
      );
    }
    assert.equal(input.resultsPerPage, 1);
  });

  it("assertCreatorBatchInputIntact throws when batch collapses", () => {
    assert.throws(() =>
      assertCreatorBatchInputIntact(
        {
          profiles: ["only-one"],
          startUrls: [{ url: "https://www.tiktok.com/@only-one" }],
        },
        5
      )
    );
  });
});

describe("orchestrateCreatorBatchFetches (UI-equivalent batch boundary)", () => {
  it("5 usernames → one provider batch call with 5 usernames", async () => {
    const usernames = ["c1", "c2", "c3", "c4", "c5"];
    const sent: string[][] = [];

    const result = await orchestrateCreatorBatchFetches(
      usernames,
      async (inputs: FetchCreatorProfileInput[]) => {
        const batch = inputs.map((item) => item.username!);
        sent.push(batch);
        const results = new Map(
          batch.map((username) => [
            username,
            {
              status: "ok" as const,
              profile: {
                username,
                displayName: username,
                profileUrl: `https://www.tiktok.com/@${username}`,
                avatarUrl: null,
                followerCount: 1,
                followingCount: null,
                totalLikes: null,
                videoCount: null,
                bio: null,
                verified: null,
              },
            },
          ])
        );
        return { results, actorRunsStarted: 1 };
      }
    );

    assert.equal(sent.length, 1);
    assert.equal(sent[0]?.length, 5);
    assert.equal(result.actorRunsStarted, 1);
    assert.equal(result.sentBatches.length, 1);
    assert.deepEqual(result.sentBatches[0], usernames);
  });

  it("6 usernames → two provider batch calls (5 + 1)", async () => {
    const usernames = ["c1", "c2", "c3", "c4", "c5", "c6"];
    assert.equal(CREATOR_BATCH_SIZE, 5);

    const result = await orchestrateCreatorBatchFetches(
      usernames,
      async (inputs) => {
        const batch = inputs.map((item) => item.username!);
        const results = new Map(
          batch.map((username) => [
            username,
            {
              status: "ok" as const,
              profile: {
                username,
                displayName: username,
                profileUrl: `https://www.tiktok.com/@${username}`,
                avatarUrl: null,
                followerCount: 1,
                followingCount: null,
                totalLikes: null,
                videoCount: null,
                bio: null,
                verified: null,
              },
            },
          ])
        );
        return { results, actorRunsStarted: 1 };
      }
    );

    assert.equal(result.sentBatches.length, 2);
    assert.equal(result.sentBatches[0]?.length, 5);
    assert.equal(result.sentBatches[1]?.length, 1);
    assert.equal(result.actorRunsStarted, 2);
  });

  it("stops before another provider batch when the invocation budget is exhausted", async () => {
    const usernames = ["c1", "c2", "c3", "c4", "c5", "c6"];
    let allowed = true;
    let calls = 0;

    const result = await orchestrateCreatorBatchFetches(
      usernames,
      async (inputs) => {
        calls += 1;
        allowed = false;
        return {
          results: new Map(
            inputs.map(({ username }) => [
              username!,
              { status: "error" as const, error: new TikTokProviderError("upstream_failure") },
            ])
          ),
          actorRunsStarted: 1,
        };
      },
      { shouldContinue: () => allowed }
    );

    assert.equal(calls, 1);
    assert.equal(result.sentBatches[0]?.length, CREATOR_BATCH_SIZE);
    assert.deepEqual(result.skippedUsernames, ["c6"]);
  });
});

describe("Apify provider real actor input for creator batches", () => {
  it("5 creators → 1 /runs POST with profiles.length 5 and startUrls.length 5", async () => {
    const usernames = ["a1", "a2", "a3", "a4", "a5"];
    const starts: Array<Record<string, unknown>> = [];
    let runSeq = 0;

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

    const fetchImpl: ApifyFetchImpl = async (input, init) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();

      if (method === "POST" && url.includes("/runs?")) {
        const body = JSON.parse(String(init?.body ?? "{}")) as Record<
          string,
          unknown
        >;
        starts.push(body);
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
        const profiles = (starts[runIndex]?.profiles as string[]) ?? [];
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

    const tracker = new ApifyRunTracker();
    const provider = new ApifyTikTokProvider(
      "test-token",
      "clockworks~tiktok-scraper",
      { fetchImpl, runTracker: tracker }
    );

    // Same orchestration function campaign/global/import bulk use.
    const orchestrated = await orchestrateCreatorBatchFetches(
      usernames,
      (inputs) => provider.fetchCreatorProfilesBatch(inputs)
    );

    assert.equal(starts.length, 1, "actor start count");
    assert.equal(tracker.actorRunsStarted, 1);
    assert.equal(orchestrated.actorRunsStarted, 1);

    const profiles = starts[0]?.profiles as string[];
    const startUrls = starts[0]?.startUrls as Array<{ url: string }>;
    assert.equal(profiles.length, 5);
    assert.equal(startUrls.length, 5);
    assert.deepEqual(profiles, usernames);
  });

  it("6 creators → 2 /runs POSTs (5 + 1)", async () => {
    const usernames = ["b1", "b2", "b3", "b4", "b5", "b6"];
    const starts: Array<Record<string, unknown>> = [];
    let runSeq = 0;

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

    const fetchImpl: ApifyFetchImpl = async (input, init) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();

      if (method === "POST" && url.includes("/runs?")) {
        const body = JSON.parse(String(init?.body ?? "{}")) as Record<
          string,
          unknown
        >;
        starts.push(body);
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
        const profiles = (starts[runIndex]?.profiles as string[]) ?? [];
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

    const tracker = new ApifyRunTracker();
    const provider = new ApifyTikTokProvider(
      "test-token",
      "clockworks~tiktok-scraper",
      { fetchImpl, runTracker: tracker }
    );

    await orchestrateCreatorBatchFetches(usernames, (inputs) =>
      provider.fetchCreatorProfilesBatch(inputs)
    );

    assert.equal(starts.length, 2);
    assert.equal((starts[0]?.profiles as string[]).length, 5);
    assert.equal((starts[0]?.startUrls as unknown[]).length, 5);
    assert.equal((starts[1]?.profiles as string[]).length, 1);
    assert.equal((starts[1]?.startUrls as unknown[]).length, 1);
  });
});

describe("bulk creator sync must not loop syncTikTokCreator for Apify", () => {
  it("campaign sync uses orchestrateCreatorBatchFetches", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "features/creator-sync/services/sync-tiktok-creator.ts"
      ),
      "utf8"
    );
    assert.match(source, /orchestrateCreatorBatchFetches/);
    assert.match(source, /prefetchCreatorBatchesForCampaigns/);
  });

  it("creator import bulk uses orchestrateCreatorBatchFetches, not per-id Apify loop", () => {
    const source = readFileSync(
      path.join(process.cwd(), "features/creator-import/actions.ts"),
      "utf8"
    );
    assert.match(source, /orchestrateCreatorBatchFetches/);
    assert.match(source, /fetchCreatorProfilesBatch/);
    // Must not map concurrency over syncTikTokCreator for the scrape itself.
    assert.doesNotMatch(
      source,
      /mapWithConcurrency\(\s*uniqueIds[\s\S]*syncTikTokCreator/
    );
  });

  it("global sync prefetches creator batches before per-campaign apply", () => {
    const core = readFileSync(
      path.join(
        process.cwd(),
        "features/scheduled-sync/services/scheduled-sync-core.ts"
      ),
      "utf8"
    );
    const run = readFileSync(
      path.join(
        process.cwd(),
        "features/scheduled-sync/services/run-scheduled-tiktok-sync.ts"
      ),
      "utf8"
    );
    assert.match(core, /prefetchCreatorBatches/);
    assert.match(run, /prefetchCreatorBatchesForCampaigns/);
  });
});
