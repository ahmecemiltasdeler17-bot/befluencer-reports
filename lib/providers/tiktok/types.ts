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

export interface TikTokMetricsProvider {
  fetchVideoMetrics(videoUrl: string): Promise<TikTokVideoMetrics>;
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

export interface TikTokCreatorProvider {
  fetchCreatorProfile(
    input: FetchCreatorProfileInput
  ): Promise<TikTokCreatorProfile>;
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
