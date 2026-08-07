import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  STALE_SYNC_THRESHOLD_MS,
  buildCampaignWarnings,
  buildDashboardKpis,
  countActiveShares,
  isActiveCampaignStatus,
  mergeActivityFeed,
  orderRecentReports,
  pickLatestPerCampaign,
  resolveVideoAddHref,
  summarizeLatestSync,
} from "@/features/dashboard/calculations";
import type { CampaignAttentionInput } from "@/features/dashboard/calculations";
import type { DashboardCampaignRow } from "@/features/dashboard/types";
import type { ScheduledSyncRunRow } from "@/features/scheduled-sync/types";

const baseCampaign = (
  overrides: Partial<CampaignAttentionInput> = {}
): CampaignAttentionInput => ({
  id: "camp-1",
  name: "Kampanya A",
  status: "active",
  creatorCount: 2,
  videoCount: 3,
  soundUrl: "https://www.tiktok.com/music/x-1",
  soundSyncStatus: "success",
  hasReadyReport: true,
  failedVideoCount: 0,
  failedCreatorCount: 0,
  missingThumbnailCount: 0,
  lastSuccessfulSyncAt: new Date().toISOString(),
  createdAt: "2026-08-01T00:00:00.000Z",
  ...overrides,
});

describe("dashboard KPI helpers", () => {
  it("builds totals for KPI cards", () => {
    const kpis = buildDashboardKpis({
      totalCampaigns: 5,
      activeCampaigns: 3,
      totalCreators: 10,
      tiktokCreators: 8,
      totalVideos: 20,
      tiktokVideos: 18,
      readyReports: 4,
      activeShares: 2,
    });

    assert.equal(kpis.activeCampaigns, 3);
    assert.equal(kpis.readyReports, 4);
    assert.equal(kpis.activeShares, 2);
  });

  it("filters active campaigns by excluding archived", () => {
    assert.equal(isActiveCampaignStatus("active"), true);
    assert.equal(isActiveCampaignStatus("draft"), true);
    assert.equal(isActiveCampaignStatus("archived"), false);
  });

  it("counts only active public shares", () => {
    const now = new Date("2026-08-06T12:00:00.000Z");
    const count = countActiveShares(
      [
        { revoked_at: null, expires_at: null },
        { revoked_at: "2026-08-05T00:00:00.000Z", expires_at: null },
        {
          revoked_at: null,
          expires_at: "2026-08-05T00:00:00.000Z",
        },
        {
          revoked_at: null,
          expires_at: "2026-08-07T00:00:00.000Z",
        },
      ],
      now
    );

    assert.equal(count, 2);
  });
});

describe("dashboard warnings", () => {
  it("generates actionable warnings without duplicates", () => {
    const warnings = buildCampaignWarnings([
      baseCampaign({
        creatorCount: 0,
        videoCount: 0,
        hasReadyReport: false,
        failedVideoCount: 2,
      }),
    ]);

    const ids = warnings.map((warning) => warning.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(ids.some((id) => id.endsWith("no_creators")));
    assert.ok(ids.some((id) => id.endsWith("failed_video_sync")));
    assert.equal(
      warnings.find((warning) => warning.code === "failed_video_sync")
        ?.severity,
      "critical"
    );
  });

  it("uses softer wording for empty draft campaigns", () => {
    const warnings = buildCampaignWarnings([
      baseCampaign({
        status: "draft",
        creatorCount: 0,
        videoCount: 0,
        hasReadyReport: false,
        soundUrl: null,
      }),
    ]);

    const noCreators = warnings.find((warning) => warning.code === "no_creators");
    assert.equal(noCreators?.severity, "info");
    assert.match(noCreators?.message ?? "", /henüz/i);
  });

  it("flags stale sync after the documented threshold", () => {
    const now = new Date("2026-08-06T12:00:00.000Z");
    const staleAt = new Date(
      now.getTime() - STALE_SYNC_THRESHOLD_MS - 1
    ).toISOString();

    const warnings = buildCampaignWarnings(
      [
        baseCampaign({
          lastSuccessfulSyncAt: staleAt,
          videoCount: 1,
        }),
      ],
      now
    );

    assert.ok(warnings.some((warning) => warning.code === "stale_sync"));
  });

  it("skips archived campaigns", () => {
    const warnings = buildCampaignWarnings([
      baseCampaign({ status: "archived", creatorCount: 0 }),
    ]);
    assert.equal(warnings.length, 0);
  });
});

describe("dashboard ordering helpers", () => {
  it("orders recent reports by generated date desc", () => {
    const ordered = orderRecentReports([
      {
        id: "1",
        campaignId: "c",
        campaignName: "A",
        reportNumber: null,
        versionNumber: 1,
        status: "ready",
        generatedAt: "2026-08-01T00:00:00.000Z",
      },
      {
        id: "2",
        campaignId: "c",
        campaignName: "A",
        reportNumber: null,
        versionNumber: 2,
        status: "ready",
        generatedAt: "2026-08-05T00:00:00.000Z",
      },
    ]);

    assert.equal(ordered[0]?.id, "2");
  });

  it("picks the first (latest) row per campaign", () => {
    const map = pickLatestPerCampaign([
      { campaign_id: "a", usage_count: 10 },
      { campaign_id: "a", usage_count: 5 },
      { campaign_id: "b", usage_count: 1 },
    ]);

    assert.equal(map.get("a")?.usage_count, 10);
    assert.equal(map.size, 2);
  });

  it("merges activity without empty labels", () => {
    const items = mergeActivityFeed(
      [
        {
          id: "1",
          kind: "report_generated",
          label: "Rapor",
          href: "/x",
          at: "2026-08-06T10:00:00.000Z",
        },
        {
          id: "2",
          kind: "campaign_created",
          label: "",
          href: null,
          at: "2026-08-06T11:00:00.000Z",
        },
      ],
      10
    );

    assert.equal(items.length, 1);
    assert.equal(items[0]?.id, "1");
  });
});

describe("sync summary and quick actions", () => {
  it("summarizes missing sync history", () => {
    const summary = summarizeLatestSync(null);
    assert.equal(summary.hasRun, false);
  });

  it("summarizes a successful run", () => {
    const run: ScheduledSyncRunRow = {
      id: "run-1",
      run_type: "full_tiktok_sync",
      status: "success",
      started_at: "2026-08-06T10:00:00.000Z",
      completed_at: "2026-08-06T10:05:00.000Z",
      triggered_by: "cron",
      total_campaigns: 2,
      successful_campaigns: 2,
      failed_campaigns: 0,
      skipped_campaigns: 0,
      video_success: 1,
      video_failed: 0,
      creator_success: 1,
      creator_failed: 0,
      sound_success: 1,
      sound_failed: 0,
      error_message: null,
      created_at: "2026-08-06T10:00:00.000Z",
    };

    const summary = summarizeLatestSync(run);
    assert.equal(summary.hasRun, true);
    assert.equal(summary.statusLabel, "Başarılı");
    assert.match(summary.triggerLabel, /cron/i);
  });

  it("resolves video add href from active campaign", () => {
    const campaigns = [
      {
        id: "draft",
        status: "draft",
      },
      {
        id: "active",
        status: "active",
      },
    ] as DashboardCampaignRow[];

    assert.equal(
      resolveVideoAddHref(campaigns),
      "/campaigns/active/videos/new"
    );
    assert.equal(resolveVideoAddHref([]), "/campaigns");
  });
});

describe("home route contracts", () => {
  it("does not use mock dashboard data on the manage home page", () => {
    const home = readFileSync(
      path.join(
        process.cwd(),
        "app/(protected)/(manage)/page.tsx"
      ),
      "utf8"
    );

    assert.ok(!home.includes("mock-data"));
    assert.ok(!home.includes("dashboardData"));
    assert.ok(home.includes("getDashboardData"));
  });

  it("keeps mock preview on the authenticated dev route", () => {
    const preview = readFileSync(
      path.join(
        process.cwd(),
        "app/(protected)/(manage)/dev/report-preview/page.tsx"
      ),
      "utf8"
    );

    assert.ok(preview.includes("Geliştirme Önizlemesi"));
    assert.ok(preview.includes("mock-data"));
    assert.ok(preview.includes("production"));
  });

  it("documents that dashboard queries avoid snapshot payloads", () => {
    const queries = readFileSync(
      path.join(process.cwd(), "features/dashboard/queries.ts"),
      "utf8"
    );

    assert.ok(!queries.includes("snapshot,"));
    assert.ok(!queries.includes(".select(\"*\")"));
    assert.ok(!queries.includes("token_hash"));
    assert.ok(!queries.includes("apify"));
    assert.ok(!queries.includes("getServerEnv"));
  });
});
