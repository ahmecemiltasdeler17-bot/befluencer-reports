import { resolvePublicShareStatus } from "@/features/public-reports/calculations";
import type {
  DashboardActivityItem,
  DashboardCampaignRow,
  DashboardKpis,
  DashboardRecentReport,
  DashboardWarning,
  DashboardWarningSeverity,
} from "@/features/dashboard/types";
import type { CampaignStatus } from "@/features/campaigns/types";
import type { ScheduledSyncRunRow } from "@/features/scheduled-sync/types";

/** Campaigns without a successful sync in this window are flagged as stale. */
export const STALE_SYNC_THRESHOLD_MS = 48 * 60 * 60 * 1000;

export const DASHBOARD_RECENT_LIMIT = 8;
export const DASHBOARD_ACTIVITY_LIMIT = 12;

const SEVERITY_RANK: Record<DashboardWarningSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

export type CampaignAttentionInput = {
  id: string;
  name: string;
  status: CampaignStatus;
  creatorCount: number;
  videoCount: number;
  soundUrl: string | null;
  soundSyncStatus: string | null;
  hasReadyReport: boolean;
  failedVideoCount: number;
  failedCreatorCount: number;
  missingThumbnailCount: number;
  lastSuccessfulSyncAt: string | null;
  createdAt: string;
};

export type ShareAttentionInput = {
  revoked_at: string | null;
  expires_at: string | null;
};

export function isActiveCampaignStatus(status: string): boolean {
  return status !== "archived";
}

export function countActiveShares(
  shares: ShareAttentionInput[],
  now: Date = new Date()
): number {
  return shares.filter(
    (share) => resolvePublicShareStatus(share, now) === "active"
  ).length;
}

export function buildDashboardKpis(input: {
  totalCampaigns: number;
  activeCampaigns: number;
  totalCreators: number;
  tiktokCreators: number;
  totalVideos: number;
  tiktokVideos: number;
  readyReports: number;
  activeShares: number;
}): DashboardKpis {
  return {
    totalCampaigns: input.totalCampaigns,
    activeCampaigns: input.activeCampaigns,
    totalCreators: input.totalCreators,
    tiktokCreators: input.tiktokCreators,
    totalVideos: input.totalVideos,
    tiktokVideos: input.tiktokVideos,
    readyReports: input.readyReports,
    activeShares: input.activeShares,
  };
}

function isObviouslyConfiguring(campaign: CampaignAttentionInput): boolean {
  return (
    campaign.status === "draft" &&
    campaign.creatorCount === 0 &&
    campaign.videoCount === 0
  );
}

/**
 * Deterministic attention warnings. Draft empty campaigns get softer info
 * wording rather than critical errors.
 */
export function buildCampaignWarnings(
  campaigns: CampaignAttentionInput[],
  now: Date = new Date()
): DashboardWarning[] {
  const warnings: DashboardWarning[] = [];
  const seen = new Set<string>();

  function push(warning: DashboardWarning) {
    if (seen.has(warning.id)) {
      return;
    }
    seen.add(warning.id);
    warnings.push(warning);
  }

  for (const campaign of campaigns) {
    if (campaign.status === "archived") {
      continue;
    }

    const configuring = isObviouslyConfiguring(campaign);
    const base = {
      campaignId: campaign.id,
      campaignName: campaign.name,
      href: `/campaigns/${campaign.id}`,
    };

    if (campaign.creatorCount === 0) {
      push({
        ...base,
        id: `${campaign.id}:no_creators`,
        code: "no_creators",
        severity: configuring ? "info" : "warning",
        message: configuring
          ? `${campaign.name}: henüz içerik üreticisi atanmadı.`
          : `${campaign.name}: içerik üreticisi atanmamış.`,
      });
    }

    if (campaign.videoCount === 0) {
      push({
        ...base,
        id: `${campaign.id}:no_videos`,
        code: "no_videos",
        severity: configuring ? "info" : "warning",
        message: configuring
          ? `${campaign.name}: henüz video eklenmedi.`
          : `${campaign.name}: video kaydı yok.`,
      });
    }

    if (campaign.failedVideoCount > 0) {
      push({
        ...base,
        id: `${campaign.id}:failed_video_sync`,
        code: "failed_video_sync",
        severity: "critical",
        message: `${campaign.name}: ${campaign.failedVideoCount} video senkronizasyonu başarısız.`,
      });
    }

    if (campaign.failedCreatorCount > 0) {
      push({
        ...base,
        id: `${campaign.id}:failed_creator_sync`,
        code: "failed_creator_sync",
        severity: "critical",
        message: `${campaign.name}: ${campaign.failedCreatorCount} üretici profil senkronizasyonu başarısız.`,
      });
    }

    if (campaign.soundSyncStatus === "failed") {
      push({
        ...base,
        id: `${campaign.id}:failed_sound_sync`,
        code: "failed_sound_sync",
        severity: "critical",
        message: `${campaign.name}: ses kullanımı senkronizasyonu başarısız.`,
      });
    }

    if (!campaign.soundUrl && !configuring) {
      push({
        ...base,
        id: `${campaign.id}:no_sound_url`,
        code: "no_sound_url",
        severity: "info",
        message: `${campaign.name}: TikTok ses URL’si tanımlı değil.`,
      });
    }

    if (!campaign.hasReadyReport && !configuring) {
      push({
        ...base,
        id: `${campaign.id}:no_ready_report`,
        code: "no_ready_report",
        severity: "warning",
        message: `${campaign.name}: hazır rapor sürümü yok.`,
        href: `/campaigns/${campaign.id}/reports`,
      });
    }

    if (campaign.missingThumbnailCount > 0) {
      push({
        ...base,
        id: `${campaign.id}:missing_thumbnail`,
        code: "missing_thumbnail",
        severity: "info",
        message: `${campaign.name}: ${campaign.missingThumbnailCount} TikTok videosunda thumbnail eksik.`,
      });
    }

    if (campaign.lastSuccessfulSyncAt) {
      const age =
        now.getTime() - new Date(campaign.lastSuccessfulSyncAt).getTime();
      if (
        Number.isFinite(age) &&
        age > STALE_SYNC_THRESHOLD_MS &&
        (campaign.videoCount > 0 || campaign.creatorCount > 0)
      ) {
        push({
          ...base,
          id: `${campaign.id}:stale_sync`,
          code: "stale_sync",
          severity: "warning",
          message: `${campaign.name}: son başarılı senkronizasyon 48 saatten eski.`,
        });
      }
    }
  }

  return warnings.sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
  );
}

export function pickLatestPerCampaign<T extends { campaign_id: string }>(
  rows: T[]
): Map<string, T> {
  const map = new Map<string, T>();
  for (const row of rows) {
    if (!map.has(row.campaign_id)) {
      map.set(row.campaign_id, row);
    }
  }
  return map;
}

export function buildCampaignOverviewRows(input: {
  campaigns: Array<{
    id: string;
    name: string;
    status: CampaignStatus;
    sound_url: string | null;
    sound_sync_status: string | null;
    sound_last_synced_at: string | null;
    report_number: string | null;
    updated_at: string;
    created_at: string;
    creatorCount: number;
    videoCount: number;
  }>;
  latestSoundByCampaign: Map<string, { usage_count: number }>;
  latestReportByCampaign: Map<
    string,
    { id: string; version_number: number; generated_at: string | null }
  >;
}): DashboardCampaignRow[] {
  return input.campaigns.map((campaign) => {
    const report = input.latestReportByCampaign.get(campaign.id);
    const sound = input.latestSoundByCampaign.get(campaign.id);
    const activityCandidates = [
      campaign.updated_at,
      campaign.sound_last_synced_at,
      report?.generated_at ?? null,
    ].filter((value): value is string => Boolean(value));

    const lastActivityAt =
      activityCandidates.sort(
        (a, b) => new Date(b).getTime() - new Date(a).getTime()
      )[0] ?? null;

    return {
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      creatorCount: campaign.creatorCount,
      videoCount: campaign.videoCount,
      latestSoundUsage: sound?.usage_count ?? null,
      latestReportVersion: report?.version_number ?? null,
      latestReportVersionId: report?.id ?? null,
      lastActivityAt,
      soundUrl: campaign.sound_url,
      soundSyncStatus: campaign.sound_sync_status,
      reportNumber: campaign.report_number,
    };
  });
}

export function orderRecentReports(
  reports: DashboardRecentReport[]
): DashboardRecentReport[] {
  return [...reports].sort((a, b) => {
    const aTime = a.generatedAt ? new Date(a.generatedAt).getTime() : 0;
    const bTime = b.generatedAt ? new Date(b.generatedAt).getTime() : 0;
    return bTime - aTime;
  });
}

export function mergeActivityFeed(
  items: DashboardActivityItem[],
  limit = DASHBOARD_ACTIVITY_LIMIT
): DashboardActivityItem[] {
  return [...items]
    .filter((item) => Boolean(item.at) && Boolean(item.label))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, limit);
}

export function summarizeLatestSync(run: ScheduledSyncRunRow | null): {
  hasRun: boolean;
  statusLabel: string;
  triggerLabel: string;
} {
  if (!run) {
    return {
      hasRun: false,
      statusLabel: "Henüz senkronizasyon çalıştırılmadı.",
      triggerLabel: "—",
    };
  }

  const statusLabels: Record<string, string> = {
    success: "Başarılı",
    partial: "Kısmi",
    failed: "Başarısız",
    skipped: "Atlandı",
    running: "Çalışıyor",
  };

  const triggerLabels: Record<string, string> = {
    cron: "Zamanlanmış (cron)",
    manual: "Manuel",
    internal: "Dahili",
  };

  return {
    hasRun: true,
    statusLabel: statusLabels[run.status] ?? run.status,
    triggerLabel:
      triggerLabels[run.triggered_by] ??
      triggerLabels[run.run_type] ??
      run.triggered_by,
  };
}

export function resolveVideoAddHref(campaigns: DashboardCampaignRow[]): string {
  const target =
    campaigns.find((campaign) => campaign.status === "active") ??
    campaigns.find((campaign) => campaign.status !== "archived") ??
    null;

  if (!target) {
    return "/campaigns";
  }

  return `/campaigns/${target.id}/videos/new`;
}
