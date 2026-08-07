import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseReportSnapshot } from "@/features/report-generation/schemas";
import { serializeReportSnapshot } from "@/features/report-generation/services/serialize-report-snapshot";
import { snapshotToCampaignReportData } from "@/features/report-generation/services/deserialize-report-snapshot";
import { computeCreatorMetrics } from "@/features/reports/calculations";
import type { CampaignReportData } from "@/features/reports/types";
import type { Video } from "@/lib/types";

/**
 * Creator sync must move live report numbers without touching stored report
 * versions. These tests pin both halves of that contract.
 */

function creatorRow(followerCount: number, profileUrl: string | null = null) {
  return {
    id: "creator-1",
    username: "ecemdans",
    display_name: "Ecem Dans",
    avatar_url: "https://cdn.example.com/avatar.jpg",
    profile_url: profileUrl,
    follower_count: followerCount,
    category: "micro",
    platform: "tiktok",
  };
}

const video: Video = {
  id: "video-1",
  title: "Test",
  creatorHandle: "@ecemdans",
  creatorName: "Ecem Dans",
  creatorAvatar: "https://cdn.example.com/avatar.jpg",
  thumbnail: "https://cdn.example.com/thumb.jpg",
  platform: "tiktok",
  views: 10_000,
  likes: 900,
  comments: 40,
  shares: 20,
  saves: 10,
  engagementRate: 9.7,
  publishedAt: "2026-08-01T10:00:00.000Z",
  url: "https://www.tiktok.com/@ecemdans/video/7123456789012345678",
  category: "micro",
  hasMetrics: true,
};

/** A live report view model whose only variable is the creator follower count. */
function liveReport(followers: number): CampaignReportData {
  return {
    campaign: {
      id: "camp-1",
      name: "Midnight Drive",
      artist: "Artist",
      track: "Midnight Drive",
      client: "Client",
      status: "active",
      startDate: "2026-08-01",
      endDate: "2026-09-01",
      soundUrl: "https://www.tiktok.com/music/test-1",
      coverColor: "#1e1b4b",
    },
    totalReach: {
      label: "Takipçi Ağı",
      value: followers,
      previousValue: 0,
      growthSinceStart: null,
    },
    summary: { headline: "", paragraphs: [] },
    kpis: [],
    trend: [],
    growth: [],
    platforms: [],
    featuredVideo: null,
    creators: [
      {
        id: "creator-1",
        rank: 1,
        handle: "@ecemdans",
        displayName: "Ecem Dans",
        avatar: "https://cdn.example.com/avatar.jpg",
        followers,
        videos: 1,
        views: 10_000,
        engagement: 970,
        engagementRate: 9.7,
        category: "micro",
        platform: "tiktok",
        profileUrl: "https://www.tiktok.com/@ecemdans",
      },
    ],
    videos: [video],
    soundGrowth: {
      soundName: "Midnight Drive",
      initialUses: 10,
      currentUses: 20,
      multiplier: 2,
      timeline: [],
    },
    metadata: {
      reportNumber: "RPT-2026-0047",
      reportDate: "5 Ağustos 2026",
      hasReportRecord: true,
      freshness: {
        lastSuccessfulSyncAt: "2026-08-05T10:00:00.000Z",
        videosWithoutMetrics: 0,
        staleVideoCount: 0,
      },
    },
    hasTimeline: false,
    hasSoundTimeline: false,
  };
}

function storedSnapshot(followers: number) {
  return serializeReportSnapshot(liveReport(followers), {
    reportId: "rep-1",
    reportNumber: "RPT-2026-0047",
    sourceLastSyncedAt: "2026-08-05T10:00:00.000Z",
    versionNumber: 2,
    reportVersionId: "ver-2",
    generatedAt: "2026-08-05T10:05:00.000Z",
    generatedBy: "user-1",
  });
}

describe("live report reflects synced follower counts", () => {
  it("reads the current creators.follower_count", () => {
    assert.equal(computeCreatorMetrics(creatorRow(10_000), [video]).followers, 10_000);
    assert.equal(computeCreatorMetrics(creatorRow(12_500), [video]).followers, 12_500);
  });

  it("carries the refreshed avatar and stored profile URL into the report model", () => {
    const creator = computeCreatorMetrics(
      creatorRow(12_500, "https://www.tiktok.com/@ecemdans"),
      [video]
    );

    assert.equal(creator.avatar, "https://cdn.example.com/avatar.jpg");
    assert.equal(creator.profileUrl, "https://www.tiktok.com/@ecemdans");
    assert.equal(creator.platform, "tiktok");
  });

  it("derives a profile URL when the creator row has none yet", () => {
    const creator = computeCreatorMetrics(creatorRow(12_500, null), [video]);

    assert.equal(creator.profileUrl, "https://www.tiktok.com/@ecemdans");
  });
});

describe("historical report versions are unaffected by creator sync", () => {
  it("keeps legacy snapshot category enums valid after nano/mega were added", () => {
    const snapshot = serializeReportSnapshot(liveReport(84_000), {
      reportId: "report-1",
      reportNumber: "RPT-2026-0001",
      versionNumber: 1,
      reportVersionId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      generatedAt: "2026-08-01T12:00:00.000Z",
      generatedBy: "user-1",
      sourceLastSyncedAt: null,
    });

    assert.equal(snapshot.data.creators[0]?.category, "micro");
    assert.equal(parseReportSnapshot(snapshot).data.creators[0]?.category, "micro");
  });

  it("validates a stored snapshot that carries no creator metric snapshots", () => {
    const snapshot = storedSnapshot(10_000);
    const roundTripped = parseReportSnapshot(JSON.parse(JSON.stringify(snapshot)));

    assert.equal(roundTripped.data.creators[0].followers, 10_000);
  });

  it("keeps the follower value frozen inside the stored snapshot", () => {
    // The stored snapshot is data, not a query: a later sync cannot change it.
    const stored = storedSnapshot(10_000);
    const afterSync = computeCreatorMetrics(creatorRow(12_500), [video]);

    assert.equal(stored.data.creators[0].followers, 10_000);
    assert.equal(stored.data.totalReach.value, 10_000);
    assert.equal(afterSync.followers, 12_500);
  });

  it("renders an older version from the snapshot alone, with no live lookup", () => {
    const stored = parseReportSnapshot(
      JSON.parse(JSON.stringify(storedSnapshot(10_000)))
    );

    // This is the same path the historical route and the PDF print route use.
    const rendered = snapshotToCampaignReportData(stored);

    assert.equal(rendered.creators[0].followers, 10_000);
    assert.equal(rendered.totalReach.value, 10_000);
  });

  it("requires no creator snapshot fields in the snapshot shape", () => {
    const keys = Object.keys(storedSnapshot(10_000).data);

    assert.equal(keys.includes("creatorMetricSnapshots"), false);
    assert.equal(keys.includes("followerHistory"), false);
  });

  it("produces a new snapshot for the new follower count only when regenerated", () => {
    const before = storedSnapshot(10_000);
    const after = storedSnapshot(12_500);

    assert.equal(before.data.creators[0].followers, 10_000);
    assert.equal(after.data.creators[0].followers, 12_500);
  });
});
