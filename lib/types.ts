export type CreatorCategory =
  | "nano"
  | "micro"
  | "macro"
  | "mega"
  | "template"
  | "uncategorized";

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
  growthSinceStart: number | null;
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
  /** Social platform the handle belongs to. Absent in pre-Phase-9 snapshots. */
  platform?: Platform;
  /** Safe profile URL, or null when none can be resolved. */
  profileUrl?: string | null;
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
  /** When false, metrics are not yet recorded for this video. */
  hasMetrics?: boolean;
  /** Safe profile URL for the creator. Absent in pre-Phase-9 snapshots. */
  creatorProfileUrl?: string | null;
  /**
   * Optional manually uploaded preview (MP4/WebM public URL).
   * Frozen into new snapshots when present; absent on legacy snapshots.
   */
  previewMediaUrl?: string | null;
  previewMediaType?: string | null;
}

export interface SoundGrowthPoint {
  date: string;
  uses: number;
}

/** One metric series (original or cluster). Null counts = no measurements yet. */
export interface SoundGrowthSeries {
  initialUses: number | null;
  currentUses: number | null;
  multiplier: number | null;
  absoluteGrowth?: number | null;
  growthPercentage?: number | null;
  timeline: SoundGrowthPoint[];
}

export interface SoundGrowth {
  soundName: string;
  /**
   * Flat fields always reflect the **original** (single-page) series for
   * backwards-compatible reports, KPIs, and PDF snapshots.
   */
  initialUses: number;
  currentUses: number;
  multiplier: number;
  /** Optional for backwards-compatible historical snapshots. */
  absoluteGrowth?: number;
  growthPercentage?: number | null;
  soundId?: string | null;
  soundAuthor?: string | null;
  soundUrl?: string | null;
  /** Provider cover URL when available; never fabricated. */
  soundCoverUrl?: string | null;
  timeline: SoundGrowthPoint[];
  /**
   * Total Contains / cluster usage series. Absent on older frozen snapshots.
   * Empty timeline + null counts when no manual cluster measurements exist.
   */
  cluster?: SoundGrowthSeries;
}

export interface DashboardData {
  campaign: Campaign;
  totalReach: TotalReach;
  summary: ReportSummary;
  kpis: KpiMetric[];
  trend: TrendDataPoint[];
  growth: GrowthDataPoint[];
  platforms: PlatformStat[];
  topVideo?: Video | null;
  creators: Creator[];
  videos: Video[];
  soundGrowth: SoundGrowth;
}
