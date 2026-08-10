export type SoundSyncStatus = "pending" | "success" | "failed";

export type SoundSnapshotSource = "manual" | "apify";

/** original = single music page; cluster = total Contains / catalog usage. */
export type SoundMetricType = "original" | "cluster";

export type CampaignSoundConfiguration = {
  campaignId: string;
  soundUrl: string | null;
  soundId: string | null;
  soundTitle: string | null;
  soundAuthor: string | null;
  /** Provider cover URL when available; never fabricated. */
  soundCoverUrl?: string | null;
  lastSyncedAt: string | null;
  syncStatus: SoundSyncStatus;
  syncError: string | null;
};

export type SoundMetricSnapshot = {
  id: string;
  campaign_id: string;
  captured_at: string;
  usage_count: number;
  source: SoundSnapshotSource;
  metric_type: SoundMetricType;
  note: string | null;
  created_at: string;
};

export type SoundMetricSummary = {
  currentUsage: number | null;
  initialUsage: number | null;
  absoluteGrowth: number | null;
  growthPercentage: number | null;
  latestDelta: number | null;
  latestDeltaPercentage: number | null;
  latestCapturedAt: string | null;
  snapshotCount: number;
};

export type SoundDailyGrowthPoint = {
  capturedAt: string;
  usageCount: number;
  absoluteDeltaFromPrevious: number | null;
  percentageDeltaFromPrevious: number | null;
  source: SoundSnapshotSource;
};

export type SyncSoundResult = {
  outcome: "success" | "failed" | "skipped";
  message: string;
  snapshotCreated: boolean;
  usageCount: number | null;
  jobId: string | null;
};

export type SoundSyncJob = {
  id: string;
  campaign_id: string | null;
  job_type: string;
  status: "running" | "success" | "failed";
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
};
