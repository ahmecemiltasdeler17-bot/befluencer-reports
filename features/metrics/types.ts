export type VideoMetricSnapshot = {
  id: string;
  video_id: string;
  captured_at: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
};

export type SoundMetricSnapshot = {
  id: string;
  campaign_id: string;
  captured_at: string;
  usage_count: number;
  source?: "manual" | "apify";
  metric_type?: "original" | "cluster";
  note?: string | null;
  created_at?: string;
};

export type ClusterSoundMetricFormValues = {
  usage_count: string;
  captured_at: string;
  note: string;
};

export type ClusterSoundMetricFormState = {
  error?: string;
  success?: string;
  fieldErrors?: Partial<Record<keyof ClusterSoundMetricFormValues, string>>;
  values?: ClusterSoundMetricFormValues;
};

export type MetricCounts = {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
};

export type MetricDeltas = {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
};

export type VideoMetricSummary = {
  latest: VideoMetricSnapshot | null;
  previous: VideoMetricSnapshot | null;
  engagementRate: number;
  engagementTotal: number;
  deltas: MetricDeltas | null;
  growthPercentage: number | null;
};

export type CampaignMetricSummary = {
  totalViews: number;
  totalEngagement: number;
  engagementRate: number;
  totalVideos: number;
  videosWithMetrics: number;
  videosWithoutMetrics: number;
  lastUpdatedAt: string | null;
};

export type CampaignMetricTimelineRow = {
  date: string;
  totalViews: number;
  totalEngagement: number;
  videoCount: number;
};

export type CreatorMetricSummaryRow = {
  creatorId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  videoCount: number;
  latestTotalViews: number;
  contributionPercentage: number;
  engagementRate: number;
};

export type SoundMetricSummary = {
  latest: SoundMetricSnapshot | null;
  initial: SoundMetricSnapshot | null;
  growthMultiplier: number | null;
  growthAbsolute: number | null;
};

export type VideoMetricFormValues = {
  views: string;
  likes: string;
  comments: string;
  shares: string;
  saves: string;
  captured_at: string;
};

export type SoundMetricFormValues = {
  usage_count: string;
  captured_at: string;
};

export type VideoMetricFormState = {
  error?: string;
  warning?: string;
  fieldErrors?: Partial<Record<keyof VideoMetricFormValues, string>>;
  values?: VideoMetricFormValues;
};

export type SoundMetricFormState = {
  error?: string;
  fieldErrors?: Partial<Record<keyof SoundMetricFormValues, string>>;
  values?: SoundMetricFormValues;
};

export type VideoMetricHistoryRow = VideoMetricSnapshot & {
  engagementRate: number;
  deltas: MetricDeltas | null;
};
