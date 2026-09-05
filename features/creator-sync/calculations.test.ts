import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCampaignAudienceSummary,
  buildCreatorGrowthFromBounds,
  buildCreatorMetricHistory,
  buildCreatorMetricSummary,
  currentFollowers,
  initialFollowers,
  isCreatorSnapshotStale,
  partitionSyncableCreators,
  percentageChange,
  shouldAppendCreatorSnapshot,
} from "@/features/creator-sync/calculations";
import type {
  CreatorGrowthBounds,
  CreatorMetricSnapshot,
} from "@/features/creator-sync/types";

const HOUR = 60 * 60 * 1000;

function snapshot(
  overrides: Partial<CreatorMetricSnapshot> & { follower_count: number }
): CreatorMetricSnapshot {
  return {
    id: overrides.id ?? `snapshot-${overrides.captured_at ?? "0"}`,
    creator_id: overrides.creator_id ?? "creator-1",
    captured_at: overrides.captured_at ?? "2026-08-01T10:00:00.000Z",
    follower_count: overrides.follower_count,
    following_count: overrides.following_count ?? null,
    total_likes: overrides.total_likes ?? null,
    video_count: overrides.video_count ?? null,
    created_at: overrides.created_at ?? "2026-08-01T10:00:00.000Z",
  };
}

describe("percentageChange", () => {
  it("returns null when the baseline is zero", () => {
    assert.equal(percentageChange(500, 0), null);
  });

  it("returns null when the baseline is negative", () => {
    assert.equal(percentageChange(500, -10), null);
  });

  it("does not round", () => {
    assert.equal(percentageChange(1, 3), (1 / 3) * 100);
  });
});

describe("currentFollowers", () => {
  it("falls back to the creator row when no snapshot exists", () => {
    assert.equal(currentFollowers([], 4_200), 4_200);
  });

  it("uses the newest snapshot regardless of input order", () => {
    const snapshots = [
      snapshot({ captured_at: "2026-08-03T10:00:00.000Z", follower_count: 300 }),
      snapshot({ captured_at: "2026-08-01T10:00:00.000Z", follower_count: 100 }),
    ];

    assert.equal(currentFollowers(snapshots, 999), 300);
  });
});

describe("initialFollowers", () => {
  it("returns null with no snapshots", () => {
    assert.equal(initialFollowers([]), null);
  });

  it("returns the earliest snapshot value", () => {
    const snapshots = [
      snapshot({ captured_at: "2026-08-03T10:00:00.000Z", follower_count: 300 }),
      snapshot({ captured_at: "2026-08-01T10:00:00.000Z", follower_count: 100 }),
    ];

    assert.equal(initialFollowers(snapshots), 100);
  });
});

describe("buildCreatorMetricSummary", () => {
  it("reports the creator row value when there are no snapshots", () => {
    const summary = buildCreatorMetricSummary([], 7_500);

    assert.equal(summary.snapshotCount, 0);
    assert.equal(summary.currentFollowers, 7_500);
    assert.equal(summary.initialFollowers, null);
    assert.equal(summary.absoluteGrowth, null);
    assert.equal(summary.growthPercentage, null);
    assert.equal(summary.latestDelta, null);
    assert.equal(summary.firstCapturedAt, null);
  });

  it("reports zero growth and no delta for a single snapshot", () => {
    const summary = buildCreatorMetricSummary(
      [
        snapshot({
          captured_at: "2026-08-01T10:00:00.000Z",
          follower_count: 10_000,
          following_count: 120,
          total_likes: 55_000,
          video_count: 42,
        }),
      ],
      9_000
    );

    assert.equal(summary.snapshotCount, 1);
    assert.equal(summary.currentFollowers, 10_000);
    assert.equal(summary.initialFollowers, 10_000);
    assert.equal(summary.absoluteGrowth, 0);
    assert.equal(summary.growthPercentage, 0);
    assert.equal(summary.latestDelta, null);
    assert.equal(summary.latestDeltaPercentage, null);
    assert.equal(summary.followingCount, 120);
    assert.equal(summary.totalLikes, 55_000);
    assert.equal(summary.videoCount, 42);
  });

  it("computes growth and the latest delta across two snapshots", () => {
    const summary = buildCreatorMetricSummary(
      [
        snapshot({
          captured_at: "2026-08-01T10:00:00.000Z",
          follower_count: 10_000,
        }),
        snapshot({
          captured_at: "2026-08-05T10:00:00.000Z",
          follower_count: 12_500,
        }),
      ],
      12_500
    );

    assert.equal(summary.currentFollowers, 12_500);
    assert.equal(summary.initialFollowers, 10_000);
    assert.equal(summary.absoluteGrowth, 2_500);
    assert.equal(summary.growthPercentage, 25);
    assert.equal(summary.latestDelta, 2_500);
    assert.equal(summary.latestDeltaPercentage, 25);
  });

  it("preserves negative growth", () => {
    const summary = buildCreatorMetricSummary(
      [
        snapshot({
          captured_at: "2026-08-01T10:00:00.000Z",
          follower_count: 10_000,
        }),
        snapshot({
          captured_at: "2026-08-05T10:00:00.000Z",
          follower_count: 9_000,
        }),
      ],
      9_000
    );

    assert.equal(summary.absoluteGrowth, -1_000);
    assert.equal(summary.growthPercentage, -10);
    assert.equal(summary.latestDelta, -1_000);
  });

  it("returns null percentages when the initial follower count is zero", () => {
    const summary = buildCreatorMetricSummary(
      [
        snapshot({ captured_at: "2026-08-01T10:00:00.000Z", follower_count: 0 }),
        snapshot({
          captured_at: "2026-08-05T10:00:00.000Z",
          follower_count: 500,
        }),
      ],
      500
    );

    assert.equal(summary.absoluteGrowth, 500);
    assert.equal(summary.growthPercentage, null);
    assert.equal(summary.latestDelta, 500);
    assert.equal(summary.latestDeltaPercentage, null);
  });

  it("measures the latest delta against the previous snapshot, not the baseline", () => {
    const summary = buildCreatorMetricSummary(
      [
        snapshot({
          captured_at: "2026-08-01T10:00:00.000Z",
          follower_count: 1_000,
        }),
        snapshot({
          captured_at: "2026-08-03T10:00:00.000Z",
          follower_count: 2_000,
        }),
        snapshot({
          captured_at: "2026-08-05T10:00:00.000Z",
          follower_count: 2_400,
        }),
      ],
      2_400
    );

    assert.equal(summary.absoluteGrowth, 1_400);
    assert.equal(summary.latestDelta, 400);
    assert.equal(summary.latestDeltaPercentage, 20);
  });
});

describe("buildCreatorMetricHistory", () => {
  it("returns rows newest first with each delta against the previous row", () => {
    const rows = buildCreatorMetricHistory([
      snapshot({
        id: "a",
        captured_at: "2026-08-01T10:00:00.000Z",
        follower_count: 1_000,
      }),
      snapshot({
        id: "b",
        captured_at: "2026-08-03T10:00:00.000Z",
        follower_count: 1_500,
      }),
      snapshot({
        id: "c",
        captured_at: "2026-08-05T10:00:00.000Z",
        follower_count: 1_200,
      }),
    ]);

    assert.deepEqual(
      rows.map((row) => row.id),
      ["c", "b", "a"]
    );
    assert.equal(rows[0].followerDelta, -300);
    assert.equal(rows[1].followerDelta, 500);
    assert.equal(rows[2].followerDelta, null);
    assert.equal(rows[2].followerDeltaPercentage, null);
  });

  it("returns an empty array with no snapshots", () => {
    assert.deepEqual(buildCreatorMetricHistory([]), []);
  });
});

describe("buildCampaignAudienceSummary", () => {
  it("deduplicates creators assigned more than once", () => {
    const summary = buildCampaignAudienceSummary([
      { creatorId: "a", currentFollowers: 1_000, initialFollowers: 800 },
      { creatorId: "a", currentFollowers: 1_000, initialFollowers: 800 },
      { creatorId: "b", currentFollowers: 500, initialFollowers: 500 },
    ]);

    assert.equal(summary.creatorCount, 2);
    assert.equal(summary.currentAudience, 1_500);
    assert.equal(summary.initialAudience, 1_300);
    assert.equal(summary.audienceGrowth, 200);
  });

  it("treats a creator without a baseline as contributing zero growth", () => {
    const summary = buildCampaignAudienceSummary([
      { creatorId: "a", currentFollowers: 1_000, initialFollowers: null },
    ]);

    assert.equal(summary.currentAudience, 1_000);
    assert.equal(summary.initialAudience, 1_000);
    assert.equal(summary.audienceGrowth, 0);
    assert.equal(summary.growthPercentage, 0);
  });

  it("returns zeroes for an empty campaign", () => {
    const summary = buildCampaignAudienceSummary([]);

    assert.equal(summary.creatorCount, 0);
    assert.equal(summary.currentAudience, 0);
    assert.equal(summary.growthPercentage, null);
  });

  it("reports negative audience growth", () => {
    const summary = buildCampaignAudienceSummary([
      { creatorId: "a", currentFollowers: 900, initialFollowers: 1_000 },
    ]);

    assert.equal(summary.audienceGrowth, -100);
    assert.equal(summary.growthPercentage, -10);
  });
});

describe("shouldAppendCreatorSnapshot", () => {
  const now = new Date("2026-08-05T12:00:00.000Z").getTime();

  const candidate = {
    followerCount: 10_000,
    followingCount: 120,
    totalLikes: 55_000,
    videoCount: 42,
  };

  it("appends the first snapshot", () => {
    assert.equal(shouldAppendCreatorSnapshot(null, candidate, now), true);
  });

  it("appends when the follower count changed", () => {
    const previous = snapshot({
      captured_at: new Date(now - HOUR).toISOString(),
      follower_count: 9_900,
      following_count: 120,
      total_likes: 55_000,
      video_count: 42,
    });

    assert.equal(shouldAppendCreatorSnapshot(previous, candidate, now), true);
  });

  it("appends when only an optional metric changed", () => {
    const previous = snapshot({
      captured_at: new Date(now - HOUR).toISOString(),
      follower_count: 10_000,
      following_count: 120,
      total_likes: 55_000,
      video_count: 41,
    });

    assert.equal(shouldAppendCreatorSnapshot(previous, candidate, now), true);
  });

  it("does not append an unchanged profile captured recently", () => {
    const previous = snapshot({
      captured_at: new Date(now - HOUR).toISOString(),
      follower_count: 10_000,
      following_count: 120,
      total_likes: 55_000,
      video_count: 42,
    });

    assert.equal(shouldAppendCreatorSnapshot(previous, candidate, now), false);
  });

  it("appends an unchanged profile once the last snapshot is a day old", () => {
    const previous = snapshot({
      captured_at: new Date(now - 25 * HOUR).toISOString(),
      follower_count: 10_000,
      following_count: 120,
      total_likes: 55_000,
      video_count: 42,
    });

    assert.equal(shouldAppendCreatorSnapshot(previous, candidate, now), true);
  });

  it("does not append merely because the provider stopped reporting an optional metric", () => {
    const previous = snapshot({
      captured_at: new Date(now - HOUR).toISOString(),
      follower_count: 10_000,
      following_count: 120,
      total_likes: 55_000,
      video_count: 42,
    });

    assert.equal(
      shouldAppendCreatorSnapshot(
        previous,
        { ...candidate, followingCount: null, totalLikes: null, videoCount: null },
        now
      ),
      false
    );
  });
});

describe("isCreatorSnapshotStale", () => {
  const now = new Date("2026-08-05T12:00:00.000Z").getTime();

  it("is not stale below 24 hours", () => {
    assert.equal(
      isCreatorSnapshotStale(new Date(now - 23 * HOUR).toISOString(), now),
      false
    );
  });

  it("is stale at 24 hours", () => {
    assert.equal(
      isCreatorSnapshotStale(new Date(now - 24 * HOUR).toISOString(), now),
      true
    );
  });
});

describe("partitionSyncableCreators", () => {
  it("keeps TikTok creators, skips others and deduplicates ids", () => {
    const { syncable, skipped } = partitionSyncableCreators([
      { creatorId: "a", platform: "tiktok" },
      { creatorId: "a", platform: "tiktok" },
      { creatorId: "b", platform: "instagram" },
      { creatorId: "c", platform: "youtube" },
      { creatorId: "d", platform: "tiktok" },
    ]);

    assert.deepEqual(
      syncable.map((item) => item.creatorId),
      ["a", "d"]
    );
    assert.deepEqual(
      skipped.map((item) => item.creatorId),
      ["b", "c"]
    );
  });
});

describe("buildCreatorGrowthFromBounds", () => {
  function bounds(
    overrides: Partial<CreatorGrowthBounds> & {
      firstFollowerCount: number;
      latestFollowerCount: number;
    }
  ): CreatorGrowthBounds {
    return {
      snapshotCount: overrides.snapshotCount ?? 2,
      firstFollowerCount: overrides.firstFollowerCount,
      firstCapturedAt: overrides.firstCapturedAt ?? "2026-08-11T10:00:00.000Z",
      latestFollowerCount: overrides.latestFollowerCount,
      latestCapturedAt: overrides.latestCapturedAt ?? "2026-09-04T10:00:00.000Z",
    };
  }

  it("falls back to the creator row when no snapshot exists", () => {
    const growth = buildCreatorGrowthFromBounds(null, 12_000);

    assert.deepEqual(growth, {
      currentFollowers: 12_000,
      absoluteGrowth: null,
      growthPercentage: null,
    });
  });

  it("reports the latest snapshot as current, not the creator row", () => {
    const growth = buildCreatorGrowthFromBounds(
      bounds({ firstFollowerCount: 656_900, latestFollowerCount: 775_200 }),
      699_000
    );

    assert.equal(growth.currentFollowers, 775_200);
    assert.equal(growth.absoluteGrowth, 118_300);
    assert.notEqual(growth.growthPercentage, null);
    assert.equal(Number(growth.growthPercentage).toFixed(2), "18.01");
  });

  it("matches the full-series summary for the same series", () => {
    const series = [
      snapshot({ captured_at: "2026-08-11T10:00:00.000Z", follower_count: 656_900 }),
      snapshot({ captured_at: "2026-08-16T10:00:00.000Z", follower_count: 699_000 }),
      snapshot({ captured_at: "2026-09-04T10:00:00.000Z", follower_count: 775_200 }),
    ];
    const summary = buildCreatorMetricSummary(series, 699_000);
    const growth = buildCreatorGrowthFromBounds(
      bounds({
        snapshotCount: series.length,
        firstFollowerCount: 656_900,
        latestFollowerCount: 775_200,
      }),
      699_000
    );

    assert.equal(growth.currentFollowers, summary.currentFollowers);
    assert.equal(growth.absoluteGrowth, summary.absoluteGrowth);
    assert.equal(growth.growthPercentage, summary.growthPercentage);
  });

  it("keeps negative growth and a null percentage on a zero baseline", () => {
    const shrinking = buildCreatorGrowthFromBounds(
      bounds({ firstFollowerCount: 5_000, latestFollowerCount: 4_200 }),
      4_200
    );
    assert.equal(shrinking.absoluteGrowth, -800);

    const fromZero = buildCreatorGrowthFromBounds(
      bounds({ firstFollowerCount: 0, latestFollowerCount: 1_500 }),
      1_500
    );
    assert.equal(fromZero.absoluteGrowth, 1_500);
    assert.equal(fromZero.growthPercentage, null);
  });

  it("treats an empty bounds row as no history", () => {
    const growth = buildCreatorGrowthFromBounds(
      bounds({
        snapshotCount: 0,
        firstFollowerCount: 0,
        latestFollowerCount: 0,
      }),
      8_400
    );

    assert.deepEqual(growth, {
      currentFollowers: 8_400,
      absoluteGrowth: null,
      growthPercentage: null,
    });
  });
});
