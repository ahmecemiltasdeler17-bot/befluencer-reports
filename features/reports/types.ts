import type { DashboardData } from "@/lib/types";

export type ReportFreshness = {
  lastSuccessfulSyncAt: string | null;
  videosWithoutMetrics: number;
  staleVideoCount: number;
};

export type CampaignReportMetadata = {
  reportNumber: string;
  reportDate: string;
  hasReportRecord: boolean;
  freshness: ReportFreshness;
};

export type CampaignReportData = DashboardData & {
  metadata: CampaignReportMetadata;
  featuredVideo: DashboardData["videos"][number] | null;
  hasTimeline: boolean;
  hasSoundTimeline: boolean;
};

export type RawVideoRow = {
  id: string;
  campaign_id: string;
  creator_id: string;
  platform: string;
  video_url: string;
  platform_video_id: string | null;
  thumbnail_url: string | null;
  caption: string | null;
  published_at: string | null;
  status: string;
  last_synced_at: string | null;
  sync_status: string;
  created_at: string;
  creator: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    profile_url: string | null;
    follower_count: number;
    category: string | null;
    platform: string;
  };
};

export type RawVideoSnapshotRow = {
  id: string;
  video_id: string;
  captured_at: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
};

export type RawSoundSnapshotRow = {
  id: string;
  campaign_id: string;
  captured_at: string;
  usage_count: number;
};

export type RawCampaignRow = {
  id: string;
  name: string;
  artist_name: string;
  track_name: string;
  client_name: string | null;
  sound_url: string | null;
  tiktok_sound_id?: string | null;
  tiktok_sound_title?: string | null;
  tiktok_sound_author?: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  report_number: string | null;
  created_at: string;
  updated_at: string;
};

export type RawReportRow = {
  id: string;
  campaign_id: string;
  report_number: string | null;
  generated_at: string | null;
  last_updated_at: string | null;
  is_public: boolean;
  created_at: string;
};

export type RawCampaignReportInput = {
  campaign: RawCampaignRow;
  report: RawReportRow | null;
  videos: RawVideoRow[];
  videoSnapshots: RawVideoSnapshotRow[];
  soundSnapshots: RawSoundSnapshotRow[];
};
