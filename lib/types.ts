export type CreatorCategory = "macro" | "micro" | "template";

export type CampaignStatus = "active" | "completed" | "draft" | "paused";

export type Platform = "tiktok" | "instagram" | "youtube";

export interface Campaign {
  id: string;
  name: string;
  artist: string;
  track: string;
  client: string;
  status: CampaignStatus;
  startDate: string;
  endDate: string;
  soundUrl: string;
  coverColor: string;
}

export interface KpiMetric {
  id: string;
  label: string;
  value: number;
  previousValue: number;
  format: "number" | "percent" | "compact";
  suffix?: string;
}

export interface ReportSummary {
  headline: string;
  paragraphs: string[];
}

export interface TotalReach {
  value: number;
  previousValue: number;
  label: string;
  growthSinceStart: number;
}

export interface TrendDataPoint {
  date: string;
  views: number;
  engagement: number;
}

export interface GrowthDataPoint {
  date: string;
  views: number;
  cumulativeViews: number;
}

export interface PlatformStat {
  platform: Platform;
  label: string;
  value: number;
  percentage: number;
  color: string;
}

export interface Creator {
  id: string;
  rank: number;
  handle: string;
  displayName: string;
  avatar: string;
  followers: number;
  videos: number;
  views: number;
  engagement: number;
  engagementRate: number;
  category: CreatorCategory;
}

export interface Video {
  id: string;
  title: string;
  creatorHandle: string;
  creatorName: string;
  creatorAvatar: string;
  thumbnail: string;
  platform: Platform;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  engagementRate: number;
  publishedAt: string;
  url: string;
  category: CreatorCategory;
}

export interface SoundGrowthPoint {
  date: string;
  uses: number;
}

export interface SoundGrowth {
  soundName: string;
  initialUses: number;
  currentUses: number;
  multiplier: number;
  timeline: SoundGrowthPoint[];
}

export interface DashboardData {
  campaign: Campaign;
  totalReach: TotalReach;
  summary: ReportSummary;
  kpis: KpiMetric[];
  trend: TrendDataPoint[];
  growth: GrowthDataPoint[];
  platforms: PlatformStat[];
  topVideo: Video;
  creators: Creator[];
  videos: Video[];
  soundGrowth: SoundGrowth;
}
