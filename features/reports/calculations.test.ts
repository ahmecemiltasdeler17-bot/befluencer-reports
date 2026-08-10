import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  aggregateLatestMetrics,
  buildCampaignTimeline,
  buildSoundGrowthData,
  calculateGrowthSinceStart,
  getLatestSnapshotsByVideo,
  mapRawSnapshots,
  selectFeaturedVideo,
} from "@/features/reports/calculations";
import type { Video } from "@/lib/types";

describe("getLatestSnapshotsByVideo", () => {
  it("selects the newest snapshot per video", () => {
    const latest = getLatestSnapshotsByVideo(
      mapRawSnapshots([
        {
          id: "1",
          video_id: "v1",
          captured_at: "2026-01-01T10:00:00.000Z",
          views: 100,
          likes: 10,
          comments: 1,
          shares: 1,
          saves: 1,
        },
        {
          id: "2",
          video_id: "v1",
          captured_at: "2026-01-02T10:00:00.000Z",
          views: 200,
          likes: 20,
          comments: 2,
          shares: 2,
          saves: 2,
        },
      ])
    );

    assert.equal(latest.get("v1")?.views, 200);
  });
});

describe("aggregateLatestMetrics", () => {
  it("sums latest snapshots across videos", () => {
    const latest = getLatestSnapshotsByVideo(
      mapRawSnapshots([
        {
          id: "1",
          video_id: "v1",
          captured_at: "2026-01-01T10:00:00.000Z",
          views: 100,
          likes: 10,
          comments: 1,
          shares: 1,
          saves: 1,
        },
        {
          id: "2",
          video_id: "v2",
          captured_at: "2026-01-01T10:00:00.000Z",
          views: 50,
          likes: 5,
          comments: 1,
          shares: 1,
          saves: 1,
        },
      ])
    );

    const totals = aggregateLatestMetrics(latest);
    assert.equal(totals.totalViews, 150);
    assert.equal(totals.totalEngagement, 21);
  });
});

describe("buildCampaignTimeline", () => {
  it("does not double-count videos when summing cumulative totals", () => {
    const snapshots = mapRawSnapshots([
      {
        id: "1",
        video_id: "v1",
        captured_at: "2026-01-01T10:00:00.000Z",
        views: 100,
        likes: 10,
        comments: 0,
        shares: 0,
        saves: 0,
      },
      {
        id: "2",
        video_id: "v2",
        captured_at: "2026-01-01T10:00:00.000Z",
        views: 50,
        likes: 5,
        comments: 0,
        shares: 0,
        saves: 0,
      },
      {
        id: "3",
        video_id: "v1",
        captured_at: "2026-01-02T10:00:00.000Z",
        views: 150,
        likes: 15,
        comments: 0,
        shares: 0,
        saves: 0,
      },
    ]);

    const timeline = buildCampaignTimeline(["v1", "v2"], snapshots);

    assert.deepEqual(
      timeline.map((point) => point.views),
      [150, 200]
    );
  });
});

describe("calculateGrowthSinceStart", () => {
  it("returns null when fewer than two timeline points exist", () => {
    assert.equal(
      calculateGrowthSinceStart(100, [{ dateKey: "2026-01-01", views: 100, engagement: 10 }]),
      null
    );
  });

  it("calculates growth from earliest aggregate", () => {
    const growth = calculateGrowthSinceStart(200, [
      { dateKey: "2026-01-01", views: 100, engagement: 10 },
      { dateKey: "2026-01-02", views: 200, engagement: 20 },
    ]);

    assert.equal(growth, 100);
  });
});

describe("selectFeaturedVideo", () => {
  const baseVideo = (overrides: Partial<Video>): Video => ({
    id: "v1",
    title: "Video",
    creatorHandle: "@a",
    creatorName: "A",
    creatorAvatar: "",
    thumbnail: "",
    platform: "tiktok",
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    engagementRate: 0,
    publishedAt: "2026-01-01",
    url: "#",
    category: "micro",
    hasMetrics: true,
    ...overrides,
  });

  it("prefers highest views, then engagement, then earliest publish date", () => {
    const selected = selectFeaturedVideo([
      baseVideo({
        id: "low",
        views: 100,
        engagementRate: 20,
        publishedAt: "2026-01-01",
      }),
      baseVideo({
        id: "high",
        views: 200,
        engagementRate: 10,
        publishedAt: "2026-01-03",
      }),
      baseVideo({
        id: "tie",
        views: 200,
        engagementRate: 15,
        publishedAt: "2026-01-02",
      }),
    ]);

    assert.equal(selected?.id, "tie");
  });

  it("returns null when no videos have metrics", () => {
    assert.equal(
      selectFeaturedVideo([
        baseVideo({ id: "none", hasMetrics: false }),
      ]),
      null
    );
  });
});

describe("buildSoundGrowthData", () => {
  it("computes multiplier only when initial usage is greater than zero", () => {
    const growth = buildSoundGrowthData({
      trackName: "Track",
      snapshots: [
        { captured_at: "2026-01-01T00:00:00.000Z", usage_count: 10 },
        { captured_at: "2026-01-02T00:00:00.000Z", usage_count: 20 },
      ],
    });

    assert.equal(growth.multiplier, 2);
    assert.equal(growth.initialUses, 10);
    assert.equal(growth.currentUses, 20);
  });

  it("returns zero multiplier when initial usage is zero", () => {
    const growth = buildSoundGrowthData({
      trackName: "Track",
      snapshots: [
        { captured_at: "2026-01-01T00:00:00.000Z", usage_count: 0 },
        { captured_at: "2026-01-02T00:00:00.000Z", usage_count: 5 },
      ],
    });

    assert.equal(growth.multiplier, 0);
  });

  it("keeps legacy snapshots as original and isolates cluster series", () => {
    const growth = buildSoundGrowthData({
      trackName: "FOTO",
      snapshots: [
        {
          captured_at: "2026-08-01T00:00:00.000Z",
          usage_count: 786,
          metric_type: "original",
        },
        {
          captured_at: "2026-08-05T00:00:00.000Z",
          usage_count: 793,
        },
        {
          captured_at: "2026-08-10T00:00:00.000Z",
          usage_count: 4890,
          metric_type: "cluster",
        },
        {
          captured_at: "2026-08-13T00:00:00.000Z",
          usage_count: 5100,
          metric_type: "cluster",
        },
      ],
    });

    assert.equal(growth.initialUses, 786);
    assert.equal(growth.currentUses, 793);
    assert.equal(growth.timeline.length, 2);
    assert.equal(growth.cluster?.initialUses, 4890);
    assert.equal(growth.cluster?.currentUses, 5100);
    assert.equal(growth.cluster?.multiplier, 5100 / 4890);
    assert.equal(growth.cluster?.timeline.length, 2);
  });

  it("returns null cluster metrics when no cluster snapshots exist", () => {
    const growth = buildSoundGrowthData({
      trackName: "FOTO",
      snapshots: [
        {
          captured_at: "2026-08-01T00:00:00.000Z",
          usage_count: 786,
          metric_type: "original",
        },
        {
          captured_at: "2026-08-05T00:00:00.000Z",
          usage_count: 793,
          metric_type: "original",
        },
      ],
    });

    assert.equal(growth.cluster?.initialUses, null);
    assert.equal(growth.cluster?.currentUses, null);
    assert.equal(growth.cluster?.multiplier, null);
    assert.deepEqual(growth.cluster?.timeline, []);
  });

  it("does not invent cluster points between sparse manual measurements", () => {
    const growth = buildSoundGrowthData({
      trackName: "FOTO",
      snapshots: [
        {
          captured_at: "2026-08-10T00:00:00.000Z",
          usage_count: 4890,
          metric_type: "cluster",
        },
        {
          captured_at: "2026-08-13T00:00:00.000Z",
          usage_count: 5100,
          metric_type: "cluster",
        },
      ],
    });

    assert.equal(growth.cluster?.timeline.length, 2);
    assert.equal(growth.cluster?.timeline[0]?.date, "2026-08-10T00:00:00.000Z");
    assert.equal(growth.cluster?.timeline[1]?.date, "2026-08-13T00:00:00.000Z");
    assert.equal(growth.timeline.length, 0);
  });
});
