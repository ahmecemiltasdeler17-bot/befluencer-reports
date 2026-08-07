import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getNextVersionNumber,
  isDuplicateContentHash,
} from "@/features/report-generation/calculations";
import {
  compareReportSnapshots,
  formatComparisonPercent,
} from "@/features/report-generation/comparison";
import { hashReportSnapshot } from "@/features/report-generation/services/hash-report-snapshot";
import {
  buildReportContentSnapshot,
  finalizeReportSnapshot,
  serializeReportSnapshot,
} from "@/features/report-generation/services/serialize-report-snapshot";
import {
  normalizeReportSnapshotInput,
  ReportSnapshotNormalizationError,
} from "@/features/report-generation/services/normalize-report-snapshot-input";
import {
  deserializeReportSnapshot,
  snapshotToCampaignReportData,
} from "@/features/report-generation/services/deserialize-report-snapshot";
import {
  parseReportSnapshot,
  reportContentSnapshotSchema,
  ReportSnapshotValidationError,
} from "@/features/report-generation/schemas";
import type {
  ReportSnapshotContext,
  ReportVersionMetadata,
} from "@/features/report-generation/types";
import type { CampaignReportData } from "@/features/reports/types";

const liveReportFixture: CampaignReportData = {
  campaign: {
    id: "camp-1",
    name: "Test Campaign",
    artist: "Artist",
    track: "Track",
    client: "Client",
    status: "active",
    startDate: "2026-01-01",
    endDate: "2026-02-01",
    soundUrl: "https://tiktok.com/sound",
    coverColor: "#1e1b4b",
  },
  totalReach: {
    label: "Total Reach",
    value: 1000,
    previousValue: 500,
    growthSinceStart: 100,
  },
  summary: { headline: "", paragraphs: [] },
  kpis: [
    {
      id: "engagement-rate",
      label: "Avg. Engagement Rate",
      value: 10,
      previousValue: 0,
      format: "percent",
    },
    {
      id: "total-engagement",
      label: "Total Engagement",
      value: 100,
      previousValue: 0,
      format: "compact",
    },
  ],
  trend: [{ date: "2026-01-01", views: 500, engagement: 50 }],
  growth: [{ date: "1 Ocak", views: 500, cumulativeViews: 500 }],
  platforms: [],
  featuredVideo: {
    id: "vid-1",
    title: "Featured",
    creatorHandle: "@creator",
    creatorName: "Creator",
    creatorAvatar: "",
    thumbnail: "",
    platform: "tiktok",
    views: 1000,
    likes: 50,
    comments: 20,
    shares: 10,
    saves: 5,
    engagementRate: 8.5,
    publishedAt: "2026-01-10",
    url: "https://tiktok.com/video/1",
    category: "micro",
    hasMetrics: true,
  },
  creators: [
    {
      id: "cr-1",
      rank: 1,
      handle: "@creator",
      displayName: "Creator",
      avatar: "",
      followers: 5000,
      videos: 1,
      views: 1000,
      engagement: 85,
      engagementRate: 8.5,
      category: "micro",
    },
  ],
  videos: [
    {
      id: "vid-1",
      title: "Featured",
      creatorHandle: "@creator",
      creatorName: "Creator",
      creatorAvatar: "",
      thumbnail: "",
      platform: "tiktok",
      views: 1000,
      likes: 50,
      comments: 20,
      shares: 10,
      saves: 5,
      engagementRate: 8.5,
      publishedAt: "2026-01-10",
      url: "https://tiktok.com/video/1",
      category: "micro",
      hasMetrics: true,
    },
  ],
  soundGrowth: {
    soundName: "Track",
    initialUses: 10,
    currentUses: 20,
    multiplier: 2,
    timeline: [
      { date: "2026-01-01", uses: 10 },
      { date: "2026-01-02", uses: 20 },
    ],
  },
  metadata: {
    reportNumber: "RPT-001",
    reportDate: "1 Ocak 2026",
    hasReportRecord: true,
    freshness: {
      lastSuccessfulSyncAt: "2026-01-02T10:00:00.000Z",
      videosWithoutMetrics: 0,
      staleVideoCount: 0,
    },
  },
  hasTimeline: false,
  hasSoundTimeline: true,
};

const context: ReportSnapshotContext = {
  reportId: "rep-1",
  reportNumber: "RPT-001",
  sourceLastSyncedAt: "2026-01-02T10:00:00.000Z",
};

function versionMetadata(
  overrides: Partial<ReportVersionMetadata> = {}
): ReportVersionMetadata {
  return {
    versionNumber: 1,
    reportVersionId: "ver-1",
    generatedAt: "2026-01-03T10:00:00.000Z",
    generatedBy: "user-1",
    ...overrides,
  };
}

function serialize(
  data: CampaignReportData = liveReportFixture,
  overrides: Partial<ReportVersionMetadata> = {},
  snapshotContext: ReportSnapshotContext = context
) {
  return serializeReportSnapshot(data, {
    ...snapshotContext,
    ...versionMetadata(overrides),
  });
}

describe("buildReportContentSnapshot", () => {
  it("validates content before a version row exists", () => {
    const content = buildReportContentSnapshot(liveReportFixture, context);

    assert.equal(content.snapshotSchemaVersion, 1);
    assert.equal(content.reportContext.reportId, "rep-1");
    assert.equal(content.sourceCounts.videoCount, 1);
    assert.equal(content.sourceCounts.creatorCount, 1);
    assert.equal("reportMetadata" in content, false);
    assert.doesNotThrow(() =>
      reportContentSnapshotSchema.parse(JSON.parse(JSON.stringify(content)))
    );
  });

  it("accepts null growthSinceStart", () => {
    const content = buildReportContentSnapshot(
      {
        ...liveReportFixture,
        totalReach: { ...liveReportFixture.totalReach, growthSinceStart: null },
      },
      context
    );

    assert.equal(content.data.totalReach.growthSinceStart, null);
  });

  it("accepts an empty sound growth section", () => {
    const content = buildReportContentSnapshot(
      {
        ...liveReportFixture,
        soundGrowth: {
          soundName: "Track",
          initialUses: 0,
          currentUses: 0,
          multiplier: 0,
          timeline: [],
        },
        hasSoundTimeline: false,
      },
      context
    );

    assert.deepEqual(content.data.soundGrowth.timeline, []);
    assert.equal(content.data.soundGrowth.multiplier, 0);
  });

  it("accepts a missing featured video", () => {
    const content = buildReportContentSnapshot(
      { ...liveReportFixture, featuredVideo: null, topVideo: null },
      context
    );

    assert.equal(content.data.featuredVideo, null);
    assert.equal(content.data.topVideo, null);
  });

  it("accepts empty creators and videos", () => {
    const content = buildReportContentSnapshot(
      {
        ...liveReportFixture,
        creators: [],
        videos: [],
        featuredVideo: null,
        topVideo: null,
      },
      context
    );

    assert.deepEqual(content.data.creators, []);
    assert.deepEqual(content.data.videos, []);
    assert.equal(content.sourceCounts.videoCount, 0);
    assert.equal(content.sourceCounts.creatorCount, 0);
  });

  it("accepts null freshness and sync timestamps", () => {
    const content = buildReportContentSnapshot(
      {
        ...liveReportFixture,
        metadata: {
          ...liveReportFixture.metadata,
          hasReportRecord: false,
          freshness: {
            lastSuccessfulSyncAt: null,
            videosWithoutMetrics: 1,
            staleVideoCount: 1,
          },
        },
      },
      { ...context, sourceLastSyncedAt: null }
    );

    assert.equal(content.data.metadata.freshness.lastSuccessfulSyncAt, null);
    assert.equal(content.reportContext.sourceLastSyncedAt, null);
    assert.equal(content.data.metadata.hasReportRecord, false);
  });

  it("accepts missing avatar and thumbnail URLs", () => {
    const content = buildReportContentSnapshot(
      {
        ...liveReportFixture,
        videos: liveReportFixture.videos.map((video) => ({
          ...video,
          creatorAvatar: "",
          thumbnail: "",
        })),
        creators: liveReportFixture.creators.map((creator) => ({
          ...creator,
          avatar: "",
        })),
      },
      context
    );

    assert.equal(content.data.videos[0].thumbnail, "");
    assert.equal(content.data.creators[0].avatar, "");
  });

  it("accepts an all-zero metrics campaign", () => {
    const content = buildReportContentSnapshot(
      {
        ...liveReportFixture,
        totalReach: {
          label: "Total Reach",
          value: 0,
          previousValue: 0,
          growthSinceStart: null,
        },
        kpis: liveReportFixture.kpis.map((kpi) => ({ ...kpi, value: 0 })),
        trend: [],
        growth: [],
        hasTimeline: false,
      },
      context
    );

    assert.equal(content.data.totalReach.value, 0);
    assert.deepEqual(content.data.trend, []);
  });

  it("normalizes undefined nested values instead of failing", () => {
    const withUndefined = {
      ...liveReportFixture,
      videos: liveReportFixture.videos.map((video) => ({
        ...video,
        hasMetrics: undefined,
      })),
    } as CampaignReportData;

    const content = buildReportContentSnapshot(withUndefined, context);

    assert.equal("hasMetrics" in content.data.videos[0], false);
  });

  it("rejects NaN metrics", () => {
    assert.throws(
      () =>
        buildReportContentSnapshot(
          {
            ...liveReportFixture,
            totalReach: { ...liveReportFixture.totalReach, value: Number.NaN },
          },
          context
        ),
      ReportSnapshotNormalizationError
    );
  });

  it("rejects Infinity metrics", () => {
    assert.throws(
      () =>
        buildReportContentSnapshot(
          {
            ...liveReportFixture,
            totalReach: {
              ...liveReportFixture.totalReach,
              value: Number.POSITIVE_INFINITY,
            },
          },
          context
        ),
      ReportSnapshotNormalizationError
    );
  });

  it("rejects a missing report id with a sanitized error", () => {
    assert.throws(
      () => buildReportContentSnapshot(liveReportFixture, { ...context, reportId: "" }),
      ReportSnapshotValidationError
    );
  });
});

describe("finalizeReportSnapshot", () => {
  it("validates after version metadata is attached", () => {
    const content = buildReportContentSnapshot(liveReportFixture, context);
    const snapshot = finalizeReportSnapshot(content, versionMetadata({ versionNumber: 3 }));

    assert.equal(snapshot.reportMetadata.versionNumber, 3);
    assert.equal(snapshot.reportMetadata.reportVersionId, "ver-1");
    assert.equal(snapshot.reportMetadata.reportId, "rep-1");
    assert.equal(snapshot.reportMetadata.sourceLastSyncedAt, context.sourceLastSyncedAt);
    assert.doesNotThrow(() => parseReportSnapshot(JSON.parse(JSON.stringify(snapshot))));
  });

  it("rejects placeholder version numbers", () => {
    const content = buildReportContentSnapshot(liveReportFixture, context);

    assert.throws(
      () => finalizeReportSnapshot(content, versionMetadata({ versionNumber: 0 })),
      ReportSnapshotValidationError
    );
  });

  it("rejects an empty version id", () => {
    const content = buildReportContentSnapshot(liveReportFixture, context);

    assert.throws(
      () => finalizeReportSnapshot(content, versionMetadata({ reportVersionId: "" })),
      ReportSnapshotValidationError
    );
  });
});

describe("normalizeReportSnapshotInput", () => {
  it("removes undefined properties and keeps nulls", () => {
    const result = normalizeReportSnapshotInput({
      keep: 1,
      drop: undefined,
      nested: { keep: null, drop: undefined },
    }) as Record<string, unknown>;

    assert.deepEqual(result, { keep: 1, nested: { keep: null } });
  });

  it("converts Date values to ISO strings", () => {
    const result = normalizeReportSnapshotInput({
      at: new Date("2026-01-01T00:00:00.000Z"),
    }) as Record<string, unknown>;

    assert.equal(result.at, "2026-01-01T00:00:00.000Z");
  });

  it("rejects BigInt values", () => {
    assert.throws(
      () => normalizeReportSnapshotInput({ views: BigInt(10) }),
      ReportSnapshotNormalizationError
    );
  });

  it("rejects undefined array entries", () => {
    assert.throws(
      () => normalizeReportSnapshotInput({ items: [1, undefined] }),
      ReportSnapshotNormalizationError
    );
  });

  it("keeps arrays as arrays", () => {
    const result = normalizeReportSnapshotInput({ items: [{ a: undefined, b: 1 }] }) as {
      items: unknown[];
    };

    assert.equal(Array.isArray(result.items), true);
    assert.deepEqual(result.items, [{ b: 1 }]);
  });
});

describe("serializeReportSnapshot", () => {
  it("produces JSON-safe validated snapshot", () => {
    const snapshot = serialize();

    assert.equal(snapshot.snapshotSchemaVersion, 1);
    assert.equal(snapshot.data.totalReach.value, 1000);
    assert.doesNotThrow(() => JSON.stringify(snapshot));
    assert.doesNotThrow(() => parseReportSnapshot(snapshot));
  });
});

describe("hashReportSnapshot", () => {
  it("is stable for identical content", () => {
    const base = serialize(liveReportFixture, { versionNumber: 1 });
    const copy = serialize(liveReportFixture, {
      versionNumber: 2,
      reportVersionId: "ver-2",
      generatedAt: "2026-01-04T10:00:00.000Z",
      generatedBy: "user-2",
    });

    assert.equal(hashReportSnapshot(base), hashReportSnapshot(copy));
  });

  it("matches between content snapshot and finalized snapshot", () => {
    const content = buildReportContentSnapshot(liveReportFixture, context);
    const snapshot = finalizeReportSnapshot(content, versionMetadata());

    assert.equal(hashReportSnapshot(content), hashReportSnapshot(snapshot));
  });

  it("changes when KPI data changes", () => {
    const base = serialize();
    const changed = serialize({
      ...liveReportFixture,
      totalReach: { ...liveReportFixture.totalReach, value: 2000 },
    });

    assert.notEqual(hashReportSnapshot(base), hashReportSnapshot(changed));
  });
});

describe("deserializeReportSnapshot", () => {
  it("maps snapshot back to campaign report data", () => {
    const snapshot = serialize();
    const parsed = deserializeReportSnapshot(JSON.parse(JSON.stringify(snapshot)));
    const report = snapshotToCampaignReportData(parsed);

    assert.equal(report.totalReach.value, 1000);
    assert.equal(report.featuredVideo?.id, "vid-1");
  });
});

describe("duplicate prevention helpers", () => {
  it("detects duplicate content hash", () => {
    assert.equal(isDuplicateContentHash("abc", "abc"), true);
    assert.equal(isDuplicateContentHash("abc", "def"), false);
  });

  it("calculates next version number", () => {
    assert.equal(getNextVersionNumber(null), 1);
    assert.equal(getNextVersionNumber(3), 4);
  });
});

describe("compareReportSnapshots", () => {
  it("calculates deltas from snapshots only", () => {
    const fromSnapshot = serialize();
    const toSnapshot = serialize(
      {
        ...liveReportFixture,
        totalReach: { ...liveReportFixture.totalReach, value: 1500 },
      },
      { versionNumber: 2, reportVersionId: "ver-2" }
    );

    const comparison = compareReportSnapshots({
      fromVersion: {
        id: "v1",
        versionNumber: 1,
        status: "ready",
        generatedAt: "2026-01-01T00:00:00.000Z",
        generatedBy: null,
        sourceLastSyncedAt: null,
        sourceVideoCount: 1,
        sourceCreatorCount: 1,
        totalViews: 1000,
        engagementRate: 10,
        errorMessage: null,
        archivedAt: null,
      },
      toVersion: {
        id: "v2",
        versionNumber: 2,
        status: "ready",
        generatedAt: "2026-01-02T00:00:00.000Z",
        generatedBy: null,
        sourceLastSyncedAt: null,
        sourceVideoCount: 1,
        sourceCreatorCount: 1,
        totalViews: 1500,
        engagementRate: 10,
        errorMessage: null,
        archivedAt: null,
      },
      fromSnapshot,
      toSnapshot,
    });

    const views = comparison.metrics.find((metric) => metric.key === "totalViews");
    assert.equal(views?.absoluteDelta, 500);
    assert.equal(views?.percentDelta, 50);
  });

  it("handles divide by zero in percent delta", () => {
    assert.equal(formatComparisonPercent(null), "—");
  });
});

describe("empty snapshot cases", () => {
  it("returns null featured video when no metrics", () => {
    const emptyVideos = serialize({
      ...liveReportFixture,
      featuredVideo: null,
      topVideo: null,
      videos: liveReportFixture.videos.map((video) => ({
        ...video,
        hasMetrics: false,
        views: 0,
      })),
    });

    assert.equal(emptyVideos.data.featuredVideo, null);
  });
});
