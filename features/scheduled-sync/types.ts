export type ScheduledSyncRunType = "full_tiktok_sync";

export type ScheduledSyncStatus =
  | "running"
  | "success"
  | "partial"
  | "failed"
  | "skipped";

export type ScheduledSyncTrigger = "cron" | "manual";

export type TaskCountSummary = {
  success: number;
  failed: number;
  skipped: number;
};

export type ScheduledSyncSummary = {
  runId: string | null;
  status: ScheduledSyncStatus;
  startedAt: string;
  completedAt: string | null;
  totalCampaigns: number;
  successfulCampaigns: number;
  failedCampaigns: number;
  skippedCampaigns: number;
  video: TaskCountSummary;
  creators: TaskCountSummary;
  sound: TaskCountSummary;
  /** Present only for internal debugging logs — never returned to cron HTTP. */
  message?: string;
};

export type ScheduledSyncRunRow = {
  id: string;
  run_type: ScheduledSyncRunType;
  status: ScheduledSyncStatus;
  started_at: string;
  completed_at: string | null;
  triggered_by: ScheduledSyncTrigger;
  total_campaigns: number;
  successful_campaigns: number;
  failed_campaigns: number;
  skipped_campaigns: number;
  video_success: number;
  video_failed: number;
  creator_success: number;
  creator_failed: number;
  sound_success: number;
  sound_failed: number;
  error_message: string | null;
  created_at: string;
};

export type EligibleCampaign = {
  id: string;
  name: string;
  status: string;
  soundUrl: string | null;
  hasTikTokVideo: boolean;
  hasTikTokCreator: boolean;
  hasSoundUrl: boolean;
};

export type CampaignTaskResult = {
  campaignId: string;
  outcome: "success" | "failed" | "skipped";
  video: TaskCountSummary;
  creators: TaskCountSummary;
  sound: TaskCountSummary;
};
