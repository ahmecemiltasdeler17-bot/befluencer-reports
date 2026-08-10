import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { ReportCreatorShowcase } from "@/components/report/report-creator-showcase";
import { ReportHeroSection } from "@/components/report/report-hero-section";
import { parseSnapshotForRendering } from "@/features/report-generation/services/deserialize-report-snapshot";
import { serializeReportSnapshot } from "@/features/report-generation/services/serialize-report-snapshot";
import {
  buildCreatorContributions,
  buildSoundGrowthData,
} from "@/features/reports/calculations";
import {
  normalizeCreatorList,
  normalizeShowcaseCreators,
} from "@/features/reports/normalize-creators";
import type { CampaignReportData } from "@/features/reports/types";
import type { Creator } from "@/lib/types";

function makeCreator(id: string, displayName: string, handle: string): Creator {
  return {
    id,
    rank: 1,
    handle,
    displayName,
    avatar: "https://example.com/a.jpg",
    followers: 1000,
    videos: 2,
    views: 5000,
    engagement: 100,
    engagementRate: 2,
    category: "micro",
    platform: "tiktok",
    profileUrl: `https://www.tiktok.com/${handle}`,
  };
}

function liveReport(creators: Creator[]): CampaignReportData {
  const soundGrowth = buildSoundGrowthData({
    trackName: "FOTO",
    snapshots: [
      { captured_at: "2026-08-01T00:00:00.000Z", usage_count: 786 },
      { captured_at: "2026-08-05T00:00:00.000Z", usage_count: 793 },
      {
        captured_at: "2026-08-10T00:00:00.000Z",
        usage_count: 4890,
        metric_type: "cluster",
      },
    ],
    soundAuthor: "SIMON",
  });

  return {
    campaign: {
      id: "camp-1",
      name: "Campaign",
      artist: "SIMON",
      track: "FOTO",
      client: "Client",
      status: "active",
      startDate: "2026-08-01",
      endDate: "2026-09-01",
      soundUrl: "https://www.tiktok.com/music/x-1",
      coverColor: "#1e1b4b",
    },
    totalReach: {
      label: "Total Reach",
      value: 10_000,
      previousValue: 0,
      growthSinceStart: null,
    },
    summary: { headline: "", paragraphs: [] },
    kpis: [
      {
        id: "creators",
        label: "Creators",
        value: creators.length,
        previousValue: creators.length,
        format: "number",
      },
    ],
    trend: [],
    growth: [],
    platforms: [],
    featuredVideo: null,
    topVideo: null,
    creators,
    videos: [],
    soundGrowth,
    metadata: {
      reportNumber: "RPT-1",
      reportDate: "1 Ağustos 2026",
      hasReportRecord: true,
      freshness: {
        lastSuccessfulSyncAt: null,
        videosWithoutMetrics: 0,
        staleVideoCount: 0,
      },
    },
    hasTimeline: false,
    hasSoundTimeline: true,
  };
}

describe("creator showcase dual-sound regression", () => {
  it("renders exactly 2 creator objects, not displayName characters", () => {
    const creators = [
      makeCreator("c1", "SIMON", "@simon"),
      makeCreator("c2", "Maya Chen", "@maya"),
    ];
    const report = liveReport(creators);
    const html = renderToStaticMarkup(
      <ReportHeroSection
        data={{
          campaign: report.campaign,
          totalReach: report.totalReach,
          kpis: report.kpis,
          creators: report.creators,
          videos: report.videos,
          soundGrowth: report.soundGrowth,
        }}
      />
    );

    assert.match(html, /data-creator-count="2"/);
    assert.equal(
      (html.match(/report-creator-showcase__item/g) ?? []).length,
      2
    );
    assert.match(html, /@simon/);
    assert.match(html, /@maya/);
    assert.equal(html.includes('data-creator-count="5"'), false);
  });

  it("preserves avatar URL through dual-sound serialize round-trip", () => {
    const creators = [
      makeCreator("c1", "SIMON", "@simon"),
      makeCreator("c2", "Maya", "@maya"),
    ];
    const snapshot = serializeReportSnapshot(liveReport(creators), {
      reportId: "report-1",
      reportNumber: "RPT-1",
      sourceLastSyncedAt: null,
      versionNumber: 1,
      reportVersionId: "version-1",
      generatedAt: "2026-08-10T12:00:00.000Z",
      generatedBy: "user-1",
    });

    assert.equal(snapshot.data.creators.length, 2);
    assert.equal(snapshot.data.creators[0]?.displayName, "SIMON");
    assert.equal(
      snapshot.data.creators[0]?.avatar,
      "https://example.com/a.jpg"
    );
    assert.equal(snapshot.sourceCounts.creatorCount, 2);
    assert.ok(snapshot.data.soundGrowth.cluster);

    const rendered = parseSnapshotForRendering(snapshot);
    assert.equal(rendered.creators.length, 2);

    const html = renderToStaticMarkup(
      <ReportCreatorShowcase
        creators={rendered.creators.map((creator) => ({
          id: creator.id,
          avatar: creator.avatar,
          name: creator.displayName,
          handle: creator.handle,
          platform: creator.platform,
          profileUrl: creator.profileUrl,
        }))}
      />
    );
    assert.match(html, /data-creator-count="2"/);
    assert.match(html, /example\.com\/a\.jpg/);
  });

  it("accepts legacy frozen snapshots without cluster and keeps creators intact", () => {
    const creators = [
      makeCreator("c1", "SIMON", "@simon"),
      makeCreator("c2", "Maya", "@maya"),
    ];
    const snapshot = serializeReportSnapshot(liveReport(creators), {
      reportId: "report-1",
      reportNumber: "RPT-1",
      sourceLastSyncedAt: null,
      versionNumber: 1,
      reportVersionId: "version-1",
      generatedAt: "2026-08-10T12:00:00.000Z",
      generatedBy: "user-1",
    });

    const legacySound = { ...snapshot.data.soundGrowth };
    delete legacySound.cluster;
    const legacy = {
      ...snapshot,
      data: {
        ...snapshot.data,
        soundGrowth: legacySound,
      },
    };

    const rendered = parseSnapshotForRendering(legacy);
    assert.equal(rendered.creators.length, 2);
    assert.equal(rendered.creators[0]?.displayName, "SIMON");
    assert.equal(rendered.soundGrowth.cluster, undefined);
  });

  it("does not turn a string into per-character showcase items", () => {
    const html = renderToStaticMarkup(
      <ReportCreatorShowcase
        creators={"SIMON" as unknown as never}
      />
    );
    assert.match(html, /henüz içerik üreticisi yok/i);
    assert.equal(html.includes("report-creator-showcase__item"), false);
  });

  it("buildCreatorContributions does not invent creators from a displayName string", () => {
    const rows = buildCreatorContributions("SIMON" as unknown as Creator[]);
    assert.deepEqual(rows, []);
    assert.deepEqual(normalizeCreatorList("SIMON"), []);
    assert.deepEqual(normalizeShowcaseCreators("SIMON"), []);
    assert.deepEqual(normalizeShowcaseCreators([..."SIMON"]), []);
  });

  it("keeps creator count independent from dual-sound cluster series", () => {
    const creators = [
      makeCreator("c1", "SIMON", "@simon"),
      makeCreator("c2", "Maya", "@maya"),
    ];
    const report = liveReport(creators);
    assert.equal(report.creators.length, 2);
    assert.equal(report.soundGrowth.cluster?.currentUses, 4890);
    assert.equal(report.kpis.find((kpi) => kpi.id === "creators")?.value, 2);
  });
});
