import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildSoundDailyGrowthSeries,
  computeSoundMetricSummary,
  filterSoundSnapshotsByMetricType,
  shouldAppendSoundSnapshot,
} from "@/features/sound-sync/calculations";

describe("computeSoundMetricSummary", () => {
  it("handles no snapshots", () => {
    const summary = computeSoundMetricSummary([]);
    assert.equal(summary.currentUsage, null);
    assert.equal(summary.absoluteGrowth, null);
    assert.equal(summary.snapshotCount, 0);
  });

  it("handles one snapshot", () => {
    const summary = computeSoundMetricSummary([
      { usage_count: 1000, captured_at: "2026-08-01T00:00:00.000Z" },
    ]);

    assert.equal(summary.currentUsage, 1000);
    assert.equal(summary.initialUsage, 1000);
    assert.equal(summary.absoluteGrowth, 0);
    assert.equal(summary.latestDelta, null);
  });

  it("computes positive and negative growth without rounding", () => {
    const positive = computeSoundMetricSummary([
      { usage_count: 1000, captured_at: "2026-08-01T00:00:00.000Z" },
      { usage_count: 1500, captured_at: "2026-08-05T00:00:00.000Z" },
    ]);

    assert.equal(positive.absoluteGrowth, 500);
    assert.equal(positive.growthPercentage, 50);
    assert.equal(positive.latestDelta, 500);

    const negative = computeSoundMetricSummary([
      { usage_count: 2000, captured_at: "2026-08-01T00:00:00.000Z" },
      { usage_count: 1500, captured_at: "2026-08-05T00:00:00.000Z" },
    ]);

    assert.equal(negative.absoluteGrowth, -500);
    assert.equal(negative.growthPercentage, -25);
  });

  it("returns null growth percentage for a zero baseline", () => {
    const summary = computeSoundMetricSummary([
      { usage_count: 0, captured_at: "2026-08-01T00:00:00.000Z" },
      { usage_count: 100, captured_at: "2026-08-05T00:00:00.000Z" },
    ]);

    assert.equal(summary.growthPercentage, null);
  });
});

describe("filterSoundSnapshotsByMetricType", () => {
  it("treats missing metric_type as original", () => {
    const rows = [
      { id: "a", metric_type: "original" as const },
      { id: "b", metric_type: null },
      { id: "c", metric_type: "cluster" as const },
      { id: "d" },
    ];

    assert.deepEqual(
      filterSoundSnapshotsByMetricType(rows, "original").map((row) => row.id),
      ["a", "b", "d"]
    );
    assert.deepEqual(
      filterSoundSnapshotsByMetricType(rows, "cluster").map((row) => row.id),
      ["c"]
    );
  });
});

describe("buildSoundDailyGrowthSeries", () => {
  it("builds an ascending chart series with exact values", () => {
    const series = buildSoundDailyGrowthSeries([
      {
        usage_count: 2000,
        captured_at: "2026-08-05T00:00:00.000Z",
        source: "apify",
      },
      {
        usage_count: 1000,
        captured_at: "2026-08-01T00:00:00.000Z",
        source: "manual",
      },
    ]);

    assert.equal(series.length, 2);
    assert.equal(series[0].usageCount, 1000);
    assert.equal(series[1].usageCount, 2000);
    assert.equal(series[1].absoluteDeltaFromPrevious, 1000);
    assert.equal(series[1].percentageDeltaFromPrevious, 100);
  });
});

describe("shouldAppendSoundSnapshot", () => {
  const now = Date.parse("2026-08-06T12:00:00.000Z");

  it("appends when there is no previous snapshot", () => {
    assert.equal(shouldAppendSoundSnapshot(null, 1000, now), true);
  });

  it("appends when usage changed", () => {
    assert.equal(
      shouldAppendSoundSnapshot(
        {
          usage_count: 1000,
          captured_at: "2026-08-06T10:00:00.000Z",
        },
        1100,
        now
      ),
      true
    );
  });

  it("does not append an unchanged recent value", () => {
    assert.equal(
      shouldAppendSoundSnapshot(
        {
          usage_count: 1000,
          captured_at: "2026-08-06T10:00:00.000Z",
        },
        1000,
        now
      ),
      false
    );
  });

  it("appends an unchanged value after 24 hours", () => {
    assert.equal(
      shouldAppendSoundSnapshot(
        {
          usage_count: 1000,
          captured_at: "2026-08-05T11:00:00.000Z",
        },
        1000,
        now
      ),
      true
    );
  });
});
