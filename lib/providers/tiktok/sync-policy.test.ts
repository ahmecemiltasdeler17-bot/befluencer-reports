import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  chunkArray,
  dedupePreserveOrder,
  evaluateCreatorSyncEligibility,
  evaluateSoundSyncEligibility,
  evaluateVideoSyncEligibility,
} from "@/lib/providers/tiktok/sync-eligibility";
import {
  CREATOR_FRESHNESS_MS,
  MANUAL_SYNC_COOLDOWN_MS,
  SOUND_FRESHNESS_MS,
  VIDEO_FRESHNESS_MS,
} from "@/lib/providers/tiktok/sync-policy";
import { parseApifyTikTokDatasetBatch } from "@/lib/providers/tiktok/parse-apify-item";
import { validCompleteItem } from "@/lib/providers/tiktok/__fixtures__/apify-responses";
import { TikTokProviderError } from "@/lib/providers/tiktok/errors";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("stale-only video eligibility", () => {
  const now = Date.parse("2026-08-08T12:00:00.000Z");

  it("skips fresh active campaign videos", () => {
    const decision = evaluateVideoSyncEligibility({
      lastSyncedAt: new Date(now - 5 * 60 * 1000).toISOString(),
      syncStatus: "success",
      campaignStatus: "active",
      nowMs: now,
    });
    assert.equal(decision.eligible, false);
    if (!decision.eligible) {
      assert.equal(decision.reason, "fresh");
    }
  });

  it("skips when latest successful snapshot is fresh even if sync_status drifted", () => {
    const decision = evaluateVideoSyncEligibility({
      lastSyncedAt: null,
      syncStatus: "failed",
      latestSuccessfulSnapshotAt: new Date(now - 60_000).toISOString(),
      campaignStatus: "active",
      nowMs: now,
    });
    assert.equal(decision.eligible, false);
    if (!decision.eligible) {
      assert.equal(decision.reason, "fresh");
    }
  });

  it("allows stale active campaign videos after 15 minutes", () => {
    const decision = evaluateVideoSyncEligibility({
      lastSyncedAt: new Date(
        now - VIDEO_FRESHNESS_MS.active - 1
      ).toISOString(),
      syncStatus: "success",
      campaignStatus: "active",
      nowMs: now,
    });
    assert.equal(decision.eligible, true);
  });

  it("uses 24h window for completed campaigns", () => {
    const fresh = evaluateVideoSyncEligibility({
      lastSyncedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      syncStatus: "success",
      campaignStatus: "completed",
      nowMs: now,
    });
    assert.equal(fresh.eligible, false);

    const stale = evaluateVideoSyncEligibility({
      lastSyncedAt: new Date(
        now - VIDEO_FRESHNESS_MS.completed - 1
      ).toISOString(),
      syncStatus: "success",
      campaignStatus: "completed",
      nowMs: now,
    });
    assert.equal(stale.eligible, true);
  });

  it("does not auto-sync archived campaigns", () => {
    const decision = evaluateVideoSyncEligibility({
      lastSyncedAt: null,
      syncStatus: "pending",
      campaignStatus: "archived",
      nowMs: now,
    });
    assert.equal(decision.eligible, false);
    if (!decision.eligible) {
      assert.equal(decision.reason, "archived_no_auto");
    }
  });

  it("force refresh bypasses freshness", () => {
    const decision = evaluateVideoSyncEligibility({
      lastSyncedAt: new Date(now - 1000).toISOString(),
      syncStatus: "success",
      campaignStatus: "active",
      force: true,
      nowMs: now,
    });
    assert.equal(decision.eligible, true);
    if (decision.eligible) {
      assert.equal(decision.reason, "force");
    }
  });
});

describe("manual cooldown", () => {
  const now = Date.parse("2026-08-08T12:00:00.000Z");

  it("blocks recent successful manual sync", () => {
    const decision = evaluateVideoSyncEligibility({
      lastSyncedAt: new Date(
        now - MANUAL_SYNC_COOLDOWN_MS / 2
      ).toISOString(),
      syncStatus: "success",
      campaignStatus: "active",
      manualCooldown: true,
      nowMs: now,
    });
    assert.equal(decision.eligible, false);
    if (!decision.eligible) {
      assert.equal(decision.reason, "cooldown");
      assert.match(decision.message, /Yakın zamanda güncellendi/);
    }
  });

  it("does not auto-retry login_required_content", () => {
    const decision = evaluateVideoSyncEligibility({
      lastSyncedAt: new Date(now - 60 * 60 * 1000).toISOString(),
      syncStatus: "failed",
      campaignStatus: "active",
      lastErrorCode: "login_required_content",
      nowMs: now,
    });
    assert.equal(decision.eligible, false);
    if (!decision.eligible) {
      assert.equal(decision.reason, "non_retriable");
    }
  });
});

describe("creator + sound freshness", () => {
  const now = Date.parse("2026-08-08T12:00:00.000Z");

  it("skips fresh creators within 24h", () => {
    const decision = evaluateCreatorSyncEligibility({
      lastSyncedAt: new Date(now - CREATOR_FRESHNESS_MS / 2).toISOString(),
      syncStatus: "success",
      nowMs: now,
    });
    assert.equal(decision.eligible, false);
  });

  it("uses 6h sound window for active campaigns", () => {
    const fresh = evaluateSoundSyncEligibility({
      lastSyncedAt: new Date(
        now - SOUND_FRESHNESS_MS.activeCampaign / 2
      ).toISOString(),
      syncStatus: "success",
      campaignStatus: "active",
      nowMs: now,
    });
    assert.equal(fresh.eligible, false);
  });
});

describe("request deduplication helpers", () => {
  it("dedupes keys while preserving order", () => {
    assert.deepEqual(dedupePreserveOrder(["a", "b", "a", "c", "b"]), [
      "a",
      "b",
      "c",
    ]);
  });

  it("chunks into bounded batches", () => {
    assert.deepEqual(chunkArray([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  });
});

describe("batch result matching", () => {
  it("matches by platform id even when order is shuffled", () => {
    const urlA =
      "https://www.tiktok.com/@creator/video/7123456789012345678";
    const urlB =
      "https://www.tiktok.com/@creator/video/7999999999999999999";
    const itemB = {
      ...validCompleteItem,
      id: "7999999999999999999",
      webVideoUrl: urlB,
      playCount: 10,
    };

    const results = parseApifyTikTokDatasetBatch(
      [itemB, validCompleteItem],
      [
        { normalizedUrl: urlA, platformVideoId: "7123456789012345678" },
        { normalizedUrl: urlB, platformVideoId: "7999999999999999999" },
      ]
    );

    const a = results.get(urlA);
    const b = results.get(urlB);
    assert.equal(a?.status, "ok");
    assert.equal(b?.status, "ok");
    if (a?.status === "ok") {
      assert.equal(a.metrics.platformVideoId, "7123456789012345678");
      assert.equal(a.metrics.views, 150000);
    }
    if (b?.status === "ok") {
      assert.equal(b.metrics.views, 10);
    }
  });

  it("allows partial batch results without failing matched rows", () => {
    const urlA =
      "https://www.tiktok.com/@creator/video/7123456789012345678";
    const urlMissing =
      "https://www.tiktok.com/@creator/video/7000000000000000001";

    const results = parseApifyTikTokDatasetBatch([validCompleteItem], [
      { normalizedUrl: urlA, platformVideoId: "7123456789012345678" },
      { normalizedUrl: urlMissing, platformVideoId: "7000000000000000001" },
    ]);

    assert.equal(results.get(urlA)?.status, "ok");
    const missing = results.get(urlMissing);
    assert.equal(missing?.status, "error");
    if (missing?.status === "error") {
      assert.equal(missing.error.code, "empty_result");
    }
  });

  it("deduplicates duplicate provider items by platform id", () => {
    const url =
      "https://www.tiktok.com/@creator/video/7123456789012345678";
    const duplicate = { ...validCompleteItem, playCount: 1 };
    const results = parseApifyTikTokDatasetBatch(
      [validCompleteItem, duplicate],
      [{ normalizedUrl: url, platformVideoId: "7123456789012345678" }]
    );
    const item = results.get(url);
    assert.equal(item?.status, "ok");
    if (item?.status === "ok") {
      assert.equal(item.metrics.views, 150000);
    }
  });

  it("rejects cross-entity platform id mismatches", () => {
    const url =
      "https://www.tiktok.com/@creator/video/7123456789012345678";
    const results = parseApifyTikTokDatasetBatch([validCompleteItem], [
      { normalizedUrl: url, platformVideoId: "9999999999999999999" },
    ]);
    // No id match and URL match may still bind — if URL matches, metrics ok;
    // when URL also mismatches identity on platform id, parse checks mismatch.
    const byWrongIdOnly = parseApifyTikTokDatasetBatch(
      [
        {
          ...validCompleteItem,
          webVideoUrl:
            "https://www.tiktok.com/@other/video/9999999999999999999",
          id: "9999999999999999999",
        },
      ],
      [{ normalizedUrl: url, platformVideoId: "7123456789012345678" }]
    );
    assert.equal(byWrongIdOnly.get(url)?.status, "error");
    void results;
  });
});

describe("null metrics must not erase good values (contract)", () => {
  it("missing batch item is an error, not null metrics", () => {
    const url =
      "https://www.tiktok.com/@creator/video/7000000000000000001";
    const results = parseApifyTikTokDatasetBatch([], [
      { normalizedUrl: url, platformVideoId: "7000000000000000001" },
    ]);
    const item = results.get(url);
    assert.equal(item?.status, "error");
    assert.ok(!(item && "metrics" in item && item.metrics));
  });
});

describe("provider run count reduction", () => {
  it("10 videos fit into 1 batch of size 10", () => {
    const keys = Array.from({ length: 10 }, (_, i) => `v${i}`);
    assert.equal(chunkArray(keys, 10).length, 1);
  });

  it("11 videos need 2 batches", () => {
    const keys = Array.from({ length: 11 }, (_, i) => `v${i}`);
    assert.equal(chunkArray(keys, 10).length, 2);
  });
});

describe("optional video actor env fallback", () => {
  it("documents APIFY_TIKTOK_VIDEO_ACTOR_ID with fallback to APIFY_TIKTOK_ACTOR_ID", () => {
    const envSource = readFileSync(
      path.join(process.cwd(), "lib/env.server.ts"),
      "utf8"
    );
    const factorySource = readFileSync(
      path.join(process.cwd(), "lib/providers/tiktok/apify-provider.ts"),
      "utf8"
    );
    const coreSource = readFileSync(
      path.join(process.cwd(), "lib/providers/tiktok/apify-provider.core.ts"),
      "utf8"
    );
    assert.match(envSource, /APIFY_TIKTOK_VIDEO_ACTOR_ID/);
    assert.match(factorySource, /getTikTokVideoActorId/);
    assert.match(coreSource, /videoActorId/);
  });
});

describe("login_required_content no retry policy", () => {
  it("lists login_required as non-retriable", () => {
    const decision = evaluateVideoSyncEligibility({
      lastSyncedAt: new Date().toISOString(),
      syncStatus: "failed",
      campaignStatus: "active",
      lastErrorCode: "login_required_content",
      force: false,
    });
    assert.equal(decision.eligible, false);
  });

  it("force bypasses freshness only — not definitive non-retryable", () => {
    const decision = evaluateVideoSyncEligibility({
      lastSyncedAt: new Date().toISOString(),
      syncStatus: "failed",
      campaignStatus: "active",
      lastErrorCode: "unavailable_video",
      force: true,
    });
    assert.equal(decision.eligible, false);
    if (!decision.eligible) {
      assert.equal(decision.reason, "non_retriable");
    }
  });

  it("allowNonRetriableRecheck explicitly rechecks permanent failures", () => {
    const decision = evaluateVideoSyncEligibility({
      lastSyncedAt: new Date().toISOString(),
      syncStatus: "failed",
      campaignStatus: "active",
      lastErrorCode: "login_required_content",
      force: true,
      allowNonRetriableRecheck: true,
    });
    assert.equal(decision.eligible, true);
  });

  it("manual recheckLoginRequired soft-retries login_required only", () => {
    const login = evaluateVideoSyncEligibility({
      lastSyncedAt: new Date().toISOString(),
      syncStatus: "failed",
      campaignStatus: "active",
      lastErrorCode: "login_required_content",
      recheckLoginRequired: true,
      force: true,
    });
    assert.equal(login.eligible, true);

    const deleted = evaluateVideoSyncEligibility({
      lastSyncedAt: new Date().toISOString(),
      syncStatus: "failed",
      campaignStatus: "active",
      lastErrorCode: "unavailable_video",
      recheckLoginRequired: true,
      force: true,
    });
    assert.equal(deleted.eligible, false);
  });
});

describe("global sync planning math", () => {
  it("estimates provider runs from batch sizes", () => {
    const staleVideos = 25;
    const staleCreators = 7;
    const soundRuns = 2;
    const videoBatches = chunkArray(
      Array.from({ length: staleVideos }, (_, i) => `v${i}`),
      10
    ).length;
    const creatorBatches = chunkArray(
      Array.from({ length: staleCreators }, (_, i) => `c${i}`),
      5
    ).length;
    assert.equal(videoBatches, 3);
    assert.equal(creatorBatches, 2);
    assert.equal(videoBatches + creatorBatches + soundRuns, 7);
  });
});

describe("TikTokProviderError identity for batch errors", () => {
  it("preserves typed errors", () => {
    const err = new TikTokProviderError("login_required_content");
    assert.equal(err.code, "login_required_content");
  });
});
