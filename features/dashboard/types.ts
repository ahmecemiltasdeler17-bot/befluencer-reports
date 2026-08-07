import type { CampaignStatus } from "@/features/campaigns/types";
import type { ScheduledSyncRunRow } from "@/features/scheduled-sync/types";

export type DashboardWarningSeverity = "critical" | "warning" | "info";

export type DashboardWarningCode =
  | "no_creators"
  | "no_videos"
  | "failed_video_sync"
  | "failed_creator_sync"
  | "failed_sound_sync"
  | "no_sound_url"
  | "no_ready_report"
  | "missing_thumbnail"
  | "stale_sync";

export type DashboardWarning = {
  id: string;
  code: DashboardWarningCode;
  severity: DashboardWarningSeverity;
  message: string;
  href: string;
  campaignId?: string;
  campaignName?: string;
};

export type DashboardKpis = {
  activeCampaigns: number;
  totalCampaigns: number;
  totalCreators: number;
  tiktokCreators: number;
  totalVideos: number;
  tiktokVideos: number;
  readyReports: number;
  activeShares: number;
};

export type DashboardCampaignRow = {
  id: string;
  name: string;
  status: CampaignStatus;
  creatorCount: number;
  videoCount: number;
  latestSoundUsage: number | null;
  latestReportVersion: number | null;
  latestReportVersionId: string | null;
  lastActivityAt: string | null;
  soundUrl: string | null;
  soundSyncStatus: string | null;
  reportNumber: string | null;
};

export type DashboardRecentReport = {
  id: string;
  campaignId: string;
  campaignName: string;
  reportNumber: string | null;
  versionNumber: number;
  status: string;
  generatedAt: string | null;
};

export type DashboardActivityKind =
  | "report_generated"
  | "share_created"
  | "share_revoked"
  | "sync_completed"
  | "sync_failed"
  | "campaign_created"
  | "creator_added"
  | "video_added";

export type DashboardActivityItem = {
  id: string;
  kind: DashboardActivityKind;
  label: string;
  href: string | null;
  at: string;
};

export type DashboardData = {
  kpis: DashboardKpis;
  campaigns: DashboardCampaignRow[];
  warnings: DashboardWarning[];
  recentReports: DashboardRecentReport[];
  latestSync: ScheduledSyncRunRow | null;
  recentFailedSyncs: ScheduledSyncRunRow[];
  activity: DashboardActivityItem[];
  videoAddHref: string;
  syncConfigured: boolean;
};
