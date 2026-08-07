import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hashReportSnapshot } from "@/features/report-generation/services/hash-report-snapshot";
import { parseReportSnapshot } from "@/features/report-generation/schemas";
import { serializeReportSnapshot } from "@/features/report-generation/services/serialize-report-snapshot";
import { buildSoundGrowthData } from "@/features/reports/calculations";
import type { CampaignReportData } from "@/features/reports/types";

function liveReport(
  soundGrowth: ReturnType<typeof buildSoundGrowthData>
): CampaignReportData {
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
      soundUrl: "https://www.tiktok.com/music/test-7149523537730997035",
      coverColor: "#1e1b4b",
    },
    totalReach: {
      label: "Total Reach",
      value: 10_000,
      previousValue: 0,
      growthSinceStart: null,
    },
    summary: { headline: "", paragraphs: [] },
    kpis: [],
    trend: [],
    growth: [],
    platforms: [],
    featuredVideo: null,
    creators: [],
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
    hasSoundTimeline: soundGrowth.timeline.length >= 2,
  };
}

const CONTEXT = {
  reportId: "report-1",
  reportNumber: "RPT-1",
  sourceLastSyncedAt: null,
  versionNumber: 1,
  reportVersionId: "version-1",
  generatedAt: "2026-08-06T12:00:00.000Z",
  generatedBy: "user-1",
};

describe("sound report compatibility", () => {
  it("builds live sound growth from real snapshot series", () => {
    const growth = buildSoundGrowthData({
      trackName: "Midnight Drive",
      snapshots: [
        { captured_at: "2026-08-01T00:00:00.000Z", usage_count: 10_000 },
        { captured_at: "2026-08-05T00:00:00.000Z", usage_count: 80_300 },
      ],
      soundId: "7149523537730997035",
      soundAuthor: "Max",
      soundUrl: "https://www.tiktok.com/music/test-7149523537730997035",
    });

    assert.equal(growth.initialUses, 10_000);
    assert.equal(growth.currentUses, 80_300);
    assert.equal(growth.absoluteGrowth, 70_300);
    assert.equal(growth.timeline.length, 2);
    assert.equal(growth.timeline[0].uses, 10_000);
  });

  it("serializes sound series into immutable historical snapshots", () => {
    const growth = buildSoundGrowthData({
      trackName: "Midnight Drive",
      snapshots: [
        { captured_at: "2026-08-01T00:00:00.000Z", usage_count: 10_000 },
        { captured_at: "2026-08-05T00:00:00.000Z", usage_count: 80_300 },
      ],
    });

    const snapshot = serializeReportSnapshot(liveReport(growth), CONTEXT);
    const parsed = parseReportSnapshot(snapshot);

    assert.equal(parsed.data.soundGrowth.currentUses, 80_300);
    assert.equal(parsed.data.soundGrowth.timeline.length, 2);
    assert.equal(parsed.data.soundGrowth.timeline[1].uses, 80_300);
  });

  it("keeps old snapshots without optional sound metadata valid", () => {
    const growth = buildSoundGrowthData({
      trackName: "Midnight Drive",
      snapshots: [],
    });
    const snapshot = serializeReportSnapshot(liveReport(growth), CONTEXT);
    const sound = snapshot.data.soundGrowth;

    const legacySnapshot = {
      ...snapshot,
      data: {
        ...snapshot.data,
        soundGrowth: {
          soundName: sound.soundName,
          initialUses: sound.initialUses,
          currentUses: sound.currentUses,
          multiplier: sound.multiplier,
          timeline: sound.timeline,
        },
      },
    };

    assert.doesNotThrow(() => parseReportSnapshot(legacySnapshot));
  });

  it("changes the report content hash when the sound series changes", () => {
    const first = serializeReportSnapshot(
      liveReport(
        buildSoundGrowthData({
          trackName: "Midnight Drive",
          snapshots: [
            { captured_at: "2026-08-01T00:00:00.000Z", usage_count: 10_000 },
          ],
        })
      ),
      CONTEXT
    );

    const second = serializeReportSnapshot(
      liveReport(
        buildSoundGrowthData({
          trackName: "Midnight Drive",
          snapshots: [
            { captured_at: "2026-08-01T00:00:00.000Z", usage_count: 10_000 },
            { captured_at: "2026-08-05T00:00:00.000Z", usage_count: 80_300 },
          ],
        })
      ),
      CONTEXT
    );

    assert.notEqual(hashReportSnapshot(first), hashReportSnapshot(second));
  });
});
