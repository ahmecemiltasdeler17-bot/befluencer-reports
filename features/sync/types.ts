export type SyncJobStatus = "running" | "success" | "failed";

export type SyncJobType = "tiktok_video_sync";

export type SyncJob = {
  id: string;
  campaign_id: string | null;
  video_id: string | null;
  job_type: SyncJobType | string;
  status: SyncJobStatus;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
};

export type SyncJobWithRelations = SyncJob & {
  video: {
    id: string;
    video_url: string;
    platform: string;
    creator: {
      id: string;
      username: string;
      display_name: string | null;
    };
  } | null;
};

export type SyncVideoOutcome = "success" | "failed" | "skipped";

export type SyncVideoResult = {
  outcome: SyncVideoOutcome;
  message: string;
  snapshotCreated: boolean;
  jobId: string | null;
  /** Present when skipped for freshness / cooldown. */
  skipReason?: "fresh" | "cooldown" | "archived_no_auto" | "non_retriable";
};

export type SyncCampaignResult = {
  total: number;
  success: number;
  failed: number;
  skipped: number;
  message: string;
  providerRunsStarted?: number;
  skippedFresh?: number;
  skippedNonRetriable?: number;
  estimatedRunsSaved?: number;
};

export type SyncActionState = {
  error?: string;
  success?: string;
  result?: SyncVideoResult | SyncCampaignResult;
};
