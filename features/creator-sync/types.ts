import type { Creator, CreatorPlatform } from "@/features/creators/types";

export type CreatorSyncStatus = "pending" | "success" | "failed";

/** Append-only creator profile statistics row. */
export type CreatorMetricSnapshot = {
  id: string;
  creator_id: string;
  captured_at: string;
  follower_count: number;
  following_count: number | null;
  total_likes: number | null;
  video_count: number | null;
  created_at: string;
};

export type CreatorMetricHistoryRow = CreatorMetricSnapshot & {
  /** Change against the chronologically previous snapshot; null for the first. */
  followerDelta: number | null;
  followerDeltaPercentage: number | null;
};

/**
 * Everything the creator detail page needs to describe follower growth.
 * `currentFollowers` falls back to `creators.follower_count` when no snapshot
 * exists yet, so a manually entered value still displays.
 */
export type CreatorMetricSummary = {
  snapshotCount: number;
  currentFollowers: number;
  initialFollowers: number | null;
  absoluteGrowth: number | null;
  growthPercentage: number | null;
  latestDelta: number | null;
  latestDeltaPercentage: number | null;
  followingCount: number | null;
  totalLikes: number | null;
  videoCount: number | null;
  firstCapturedAt: string | null;
  latestCapturedAt: string | null;
};

/** Per-creator sync state for campaign and list views. */
export type CreatorSyncSummary = {
  creatorId: string;
  username: string;
  displayName: string | null;
  platform: CreatorPlatform;
  currentFollowers: number;
  absoluteGrowth: number | null;
  growthPercentage: number | null;
  lastSyncedAt: string | null;
  syncStatus: CreatorSyncStatus;
};

export type CreatorWithSyncState = Creator & {
  last_synced_at: string | null;
  sync_status: CreatorSyncStatus;
};

export type SyncCreatorOutcome = "success" | "failed" | "skipped";

export type SyncCreatorResult = {
  outcome: SyncCreatorOutcome;
  message: string;
  snapshotCreated: boolean;
  followerCount: number | null;
  jobId: string | null;
};

export type SyncCampaignCreatorsResult = {
  total: number;
  success: number;
  failed: number;
  skipped: number;
  message: string;
};

export type CreatorSyncActionState = {
  error?: string;
  success?: string;
  result?: SyncCreatorResult | SyncCampaignCreatorsResult;
};

/** Aggregate follower reach for a campaign's assigned creators. */
export type CampaignAudienceSummary = {
  creatorCount: number;
  currentAudience: number;
  initialAudience: number;
  audienceGrowth: number;
  growthPercentage: number | null;
};
