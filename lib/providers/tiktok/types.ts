import type { TikTokProviderError } from "@/lib/providers/tiktok/errors";

export interface TikTokVideoMetrics {
  platformVideoId: string | null;
  videoUrl: string;
  creatorUsername: string | null;
  creatorDisplayName: string | null;
  creatorAvatarUrl: string | null;
  creatorFollowerCount: number | null;
  caption: string | null;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
}

export type TikTokVideoBatchRequest = {
  videoUrl: string;
  platformVideoId?: string | null;
};

export type TikTokVideoBatchItemResult =
  | { status: "ok"; metrics: TikTokVideoMetrics }
  | { status: "error"; error: TikTokProviderError };

export type TikTokVideoBatchFetchResult = {
  results: Map<string, TikTokVideoBatchItemResult>;
  /** Real actor-start HTTP POSTs performed for this call. */
  actorRunsStarted: number;
};

export interface TikTokMetricsProvider {
  fetchVideoMetrics(videoUrl: string): Promise<TikTokVideoMetrics>;
  /**
   * One call = one Apify actor run for the full URL batch.
   * Must NOT loop single-item fetches.
   */
  fetchVideoMetricsBatch(
    requests: TikTokVideoBatchRequest[]
  ): Promise<TikTokVideoBatchFetchResult>;
}

/**
 * Normalized creator profile, independent of any provider's payload shape.
 * `followerCount` is required: a profile without a readable follower count is a
 * malformed result, never a zero.
 */
export interface TikTokCreatorProfile {
  username: string;
  displayName: string | null;
  profileUrl: string;
  avatarUrl: string | null;
  followerCount: number;
  followingCount: number | null;
  totalLikes: number | null;
  videoCount: number | null;
  bio: string | null;
  verified: boolean | null;
}

export type FetchCreatorProfileInput = {
  username?: string;
  profileUrl?: string;
};

export type TikTokCreatorBatchItemResult =
  | { status: "ok"; profile: TikTokCreatorProfile }
  | { status: "error"; error: TikTokProviderError };

export type TikTokCreatorBatchFetchResult = {
  results: Map<string, TikTokCreatorBatchItemResult>;
  /** Real actor-start HTTP POSTs performed for this call. */
  actorRunsStarted: number;
};

export interface TikTokCreatorProvider {
  fetchCreatorProfile(
    input: FetchCreatorProfileInput
  ): Promise<TikTokCreatorProfile>;
  /**
   * One call = one Apify actor run for the full profile batch.
   * Must NOT loop single-item fetches.
   */
  fetchCreatorProfilesBatch(
    inputs: FetchCreatorProfileInput[]
  ): Promise<TikTokCreatorBatchFetchResult>;
}

/**
 * Normalized TikTok sound / music page profile.
 * `usageCount` is the explicit total posts using the sound — never inferred
 * from dataset length or video engagement fields.
 */
export interface TikTokSoundProfile {
  soundId: string;
  soundUrl: string;
  title: string | null;
  authorName: string | null;
  usageCount: number;
  coverUrl: string | null;
}

export type FetchSoundProfileInput = {
  soundUrl: string;
  soundId?: string;
};

export interface TikTokSoundProvider {
  fetchSoundProfile(input: FetchSoundProfileInput): Promise<TikTokSoundProfile>;
}
