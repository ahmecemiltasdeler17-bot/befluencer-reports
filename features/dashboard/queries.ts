import "server-only";

import {
  DASHBOARD_RECENT_LIMIT,
  buildCampaignOverviewRows,
  buildCampaignWarnings,
  buildDashboardKpis,
  countActiveShares,
  isActiveCampaignStatus,
  mergeActivityFeed,
  orderRecentReports,
  pickLatestPerCampaign,
  resolveVideoAddHref,
} from "@/features/dashboard/calculations";
import type {
  DashboardActivityItem,
  DashboardData,
  DashboardRecentReport,
} from "@/features/dashboard/types";
import type { CampaignStatus } from "@/features/campaigns/types";
import { listScheduledSyncRuns } from "@/features/scheduled-sync/queries";
import { isScheduledSyncConfigured } from "@/lib/env.server";
import { getVerifiedAuth } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

type CountResult = { count: number | null; error: { message: string } | null };

async function headCount(
  query: PromiseLike<CountResult>
): Promise<number> {
  const { count, error } = await query;
  if (error) {
    return 0;
  }
  return count ?? 0;
}

function nestedCount(value: unknown): number {
  if (Array.isArray(value) && value[0] && typeof value[0] === "object") {
    const row = value[0] as { count?: number };
    return Number(row.count ?? 0);
  }
  return 0;
}

/**
 * Loads the admin dashboard in a small set of parallel queries.
 * Never selects report snapshot JSON or share token hashes.
 * Never calls TikTok / Apify providers.
 */
export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient();
  const auth = await getVerifiedAuth(supabase);

  if (!auth) {
    throw new Error("Oturum açmanız gerekiyor.");
  }

  const [
    totalCampaigns,
    activeCampaigns,
    totalCreators,
    tiktokCreators,
    totalVideos,
    tiktokVideos,
    readyReports,
    campaignRowsResult,
    shareRowsResult,
    recentSyncRuns,
    recentReportRows,
    reportCampaignCoverage,
    soundRows,
    failedVideoRows,
    failedCreatorRows,
    missingThumbRows,
    campaignCreatorLinks,
    recentCampaignsCreated,
    recentCreators,
    recentVideos,
    recentShares,
  ] = await Promise.all([
    headCount(
      supabase.from("campaigns").select("id", { count: "exact", head: true })
    ),
    headCount(
      supabase
        .from("campaigns")
        .select("id", { count: "exact", head: true })
        .neq("status", "archived")
    ),
    headCount(
      supabase.from("creators").select("id", { count: "exact", head: true })
    ),
    headCount(
      supabase
        .from("creators")
        .select("id", { count: "exact", head: true })
        .eq("platform", "tiktok")
    ),
    headCount(
      supabase.from("videos").select("id", { count: "exact", head: true })
    ),
    headCount(
      supabase
        .from("videos")
        .select("id", { count: "exact", head: true })
        .eq("platform", "tiktok")
    ),
    headCount(
      supabase
        .from("report_versions")
        .select("id", { count: "exact", head: true })
        .eq("status", "ready")
    ),
    supabase
      .from("campaigns")
      .select(
        `
        id,
        name,
        status,
        sound_url,
        sound_sync_status,
        sound_last_synced_at,
        report_number,
        updated_at,
        created_at,
        campaign_creators(count),
        videos(count)
      `
      )
      .neq("status", "archived")
      .order("updated_at", { ascending: false })
      .limit(100),
    supabase
      .from("public_report_shares")
      .select("id, revoked_at, expires_at"),
    listScheduledSyncRuns(5),
    supabase
      .from("report_versions")
      .select(
        "id, campaign_id, version_number, status, generated_at, campaigns(name, report_number)"
      )
      .in("status", ["ready", "archived"])
      .order("generated_at", { ascending: false })
      .limit(40),
    supabase
      .from("report_versions")
      .select("campaign_id")
      .in("status", ["ready", "archived"])
      .limit(500),
    supabase
      .from("sound_metric_snapshots")
      .select("campaign_id, usage_count, captured_at, metric_type")
      .eq("metric_type", "original")
      .order("captured_at", { ascending: false })
      .limit(80),
    supabase
      .from("videos")
      .select("id, campaign_id, sync_status, thumbnail_url, platform")
      .eq("sync_status", "failed")
      .limit(200),
    supabase
      .from("creators")
      .select("id, sync_status")
      .eq("sync_status", "failed")
      .limit(200),
    supabase
      .from("videos")
      .select("id, campaign_id, platform, thumbnail_url")
      .eq("platform", "tiktok")
      .is("thumbnail_url", null)
      .limit(200),
    supabase
      .from("campaign_creators")
      .select("campaign_id, creator_id, creators(sync_status)")
      .limit(500),
    supabase
      .from("campaigns")
      .select("id, name, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("creators")
      .select("id, username, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("videos")
      .select("id, campaign_id, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("public_report_shares")
      .select(
        "id, created_at, revoked_at, report_version_id, report_versions(campaign_id, version_number)"
      )
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const shareRows = (shareRowsResult.data ?? []) as Array<{
    id: string;
    revoked_at: string | null;
    expires_at: string | null;
  }>;

  const activeShares = countActiveShares(shareRows);

  const kpis = buildDashboardKpis({
    totalCampaigns,
    activeCampaigns,
    totalCreators,
    tiktokCreators,
    totalVideos,
    tiktokVideos,
    readyReports,
    activeShares,
  });

  const rawCampaigns = (campaignRowsResult.data ?? []) as Array<{
    id: string;
    name: string;
    status: CampaignStatus;
    sound_url: string | null;
    sound_sync_status: string | null;
    sound_last_synced_at: string | null;
    report_number: string | null;
    updated_at: string;
    created_at: string;
    campaign_creators: unknown;
    videos: unknown;
  }>;

  const mappedCampaigns = rawCampaigns.map((row) => ({
    id: row.id,
    name: row.name,
    status: row.status,
    sound_url: row.sound_url,
    sound_sync_status: row.sound_sync_status,
    sound_last_synced_at: row.sound_last_synced_at,
    report_number: row.report_number,
    updated_at: row.updated_at,
    created_at: row.created_at,
    creatorCount: nestedCount(row.campaign_creators),
    videoCount: nestedCount(row.videos),
  }));

  const latestSoundByCampaign = pickLatestPerCampaign(
    ((soundRows.data ?? []) as Array<{
      campaign_id: string;
      usage_count: number;
      captured_at: string;
    }>).map((row) => ({
      campaign_id: row.campaign_id,
      usage_count: Number(row.usage_count),
    }))
  );

  type ReportJoin = {
    id: string;
    campaign_id: string;
    version_number: number;
    status: string;
    generated_at: string | null;
    campaigns:
      | { name: string; report_number: string | null }
      | { name: string; report_number: string | null }[]
      | null;
  };

  const reportRows = (recentReportRows.data ?? []) as ReportJoin[];

  const latestReportByCampaign = pickLatestPerCampaign(
    reportRows.map((row) => ({
      campaign_id: row.campaign_id,
      id: row.id,
      version_number: row.version_number,
      generated_at: row.generated_at,
    }))
  );

  const allCampaignRows = buildCampaignOverviewRows({
    campaigns: mappedCampaigns,
    latestSoundByCampaign,
    latestReportByCampaign,
  });
  const campaigns = allCampaignRows.slice(0, DASHBOARD_RECENT_LIMIT);

  const failedVideosByCampaign = new Map<string, number>();
  for (const row of (failedVideoRows.data ?? []) as Array<{
    campaign_id: string;
  }>) {
    failedVideosByCampaign.set(
      row.campaign_id,
      (failedVideosByCampaign.get(row.campaign_id) ?? 0) + 1
    );
  }

  const failedCreatorIds = new Set(
    ((failedCreatorRows.data ?? []) as Array<{ id: string }>).map((row) => row.id)
  );

  const failedCreatorsByCampaign = new Map<string, number>();
  for (const row of (campaignCreatorLinks.data ?? []) as Array<{
    campaign_id: string;
    creator_id: string;
  }>) {
    if (failedCreatorIds.has(row.creator_id)) {
      failedCreatorsByCampaign.set(
        row.campaign_id,
        (failedCreatorsByCampaign.get(row.campaign_id) ?? 0) + 1
      );
    }
  }

  const missingThumbsByCampaign = new Map<string, number>();
  for (const row of (missingThumbRows.data ?? []) as Array<{
    campaign_id: string;
  }>) {
    missingThumbsByCampaign.set(
      row.campaign_id,
      (missingThumbsByCampaign.get(row.campaign_id) ?? 0) + 1
    );
  }

  const readyCampaignIds = new Set(
    ((reportCampaignCoverage.data ?? []) as Array<{ campaign_id: string }>).map(
      (row) => row.campaign_id
    )
  );

  const warnings = buildCampaignWarnings(
    mappedCampaigns.map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      creatorCount: campaign.creatorCount,
      videoCount: campaign.videoCount,
      soundUrl: campaign.sound_url,
      soundSyncStatus: campaign.sound_sync_status,
      hasReadyReport: readyCampaignIds.has(campaign.id),
      failedVideoCount: failedVideosByCampaign.get(campaign.id) ?? 0,
      failedCreatorCount: failedCreatorsByCampaign.get(campaign.id) ?? 0,
      missingThumbnailCount: missingThumbsByCampaign.get(campaign.id) ?? 0,
      lastSuccessfulSyncAt: campaign.sound_last_synced_at,
      createdAt: campaign.created_at,
    }))
  );

  const recentReports: DashboardRecentReport[] = orderRecentReports(
    reportRows.map((row) => {
      const campaign = Array.isArray(row.campaigns)
        ? row.campaigns[0]
        : row.campaigns;
      return {
        id: row.id,
        campaignId: row.campaign_id,
        campaignName: campaign?.name ?? "—",
        reportNumber: campaign?.report_number ?? null,
        versionNumber: row.version_number,
        status: row.status,
        generatedAt: row.generated_at,
      };
    })
  ).slice(0, DASHBOARD_RECENT_LIMIT);

  const activity: DashboardActivityItem[] = [];

  for (const row of reportRows) {
    if (!row.generated_at) continue;
    const campaign = Array.isArray(row.campaigns)
      ? row.campaigns[0]
      : row.campaigns;
    activity.push({
      id: `report:${row.id}`,
      kind: "report_generated",
      label: `${campaign?.name ?? "Kampanya"} rapor v${row.version_number} oluşturuldu`,
      href: `/campaigns/${row.campaign_id}/reports/${row.id}`,
      at: row.generated_at,
    });
  }

  for (const run of recentSyncRuns) {
    if (run.status === "failed" || run.status === "partial") {
      activity.push({
        id: `sync:${run.id}`,
        kind: run.status === "failed" ? "sync_failed" : "sync_completed",
        label:
          run.status === "failed"
            ? "Zamanlanmış senkronizasyon başarısız"
            : "Zamanlanmış senkronizasyon kısmen tamamlandı",
        href: "/settings/sync",
        at: run.completed_at ?? run.started_at,
      });
    } else if (run.status === "success") {
      activity.push({
        id: `sync:${run.id}`,
        kind: "sync_completed",
        label: "Zamanlanmış senkronizasyon tamamlandı",
        href: "/settings/sync",
        at: run.completed_at ?? run.started_at,
      });
    }
  }

  for (const row of (recentCampaignsCreated.data ?? []) as Array<{
    id: string;
    name: string;
    created_at: string;
  }>) {
    activity.push({
      id: `campaign:${row.id}`,
      kind: "campaign_created",
      label: `Kampanya oluşturuldu: ${row.name}`,
      href: `/campaigns/${row.id}`,
      at: row.created_at,
    });
  }

  for (const row of (recentCreators.data ?? []) as Array<{
    id: string;
    username: string;
    created_at: string;
  }>) {
    activity.push({
      id: `creator:${row.id}`,
      kind: "creator_added",
      label: `İçerik üreticisi eklendi: @${row.username}`,
      href: `/creators/${row.id}`,
      at: row.created_at,
    });
  }

  for (const row of (recentVideos.data ?? []) as Array<{
    id: string;
    campaign_id: string;
    created_at: string;
  }>) {
    activity.push({
      id: `video:${row.id}`,
      kind: "video_added",
      label: "Video eklendi",
      href: `/campaigns/${row.campaign_id}/videos/${row.id}`,
      at: row.created_at,
    });
  }

  for (const row of (recentShares.data ?? []) as Array<{
    id: string;
    created_at: string;
    revoked_at: string | null;
    report_versions:
      | { campaign_id: string; version_number: number }
      | { campaign_id: string; version_number: number }[]
      | null;
  }>) {
    const version = Array.isArray(row.report_versions)
      ? row.report_versions[0]
      : row.report_versions;
    const shareHref = version
      ? `/campaigns/${version.campaign_id}/reports`
      : "/reports";

    activity.push({
      id: `share-created:${row.id}`,
      kind: "share_created",
      label: version
        ? `Paylaşım linki oluşturuldu (v${version.version_number})`
        : "Paylaşım linki oluşturuldu",
      href: shareHref,
      at: row.created_at,
    });

    if (row.revoked_at) {
      activity.push({
        id: `share-revoked:${row.id}`,
        kind: "share_revoked",
        label: "Paylaşım linki iptal edildi",
        href: shareHref,
        at: row.revoked_at,
      });
    }
  }

  const latestSync = recentSyncRuns[0] ?? null;
  const recentFailedSyncs = recentSyncRuns.filter(
    (run) => run.status === "failed" || run.status === "partial"
  );

  return {
    kpis,
    campaigns: campaigns.filter((campaign) =>
      isActiveCampaignStatus(campaign.status)
    ),
    warnings,
    recentReports,
    latestSync,
    recentFailedSyncs,
    activity: mergeActivityFeed(activity),
    videoAddHref: resolveVideoAddHref(allCampaignRows),
    syncConfigured: isScheduledSyncConfigured(),
  };
}
