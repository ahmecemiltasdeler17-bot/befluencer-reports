export const CAMPAIGN_STATUSES = [
  "draft",
  "active",
  "completed",
  "archived",
] as const;

export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export type Campaign = {
  id: string;
  name: string;
  artist_name: string;
  track_name: string;
  client_name: string | null;
  sound_url: string | null;
  tiktok_sound_id?: string | null;
  tiktok_sound_title?: string | null;
  tiktok_sound_author?: string | null;
  tiktok_sound_cover_url?: string | null;
  sound_last_synced_at?: string | null;
  sound_sync_status?: "pending" | "success" | "failed";
  sound_sync_error?: string | null;
  status: CampaignStatus;
  start_date: string | null;
  end_date: string | null;
  report_number: string | null;
  created_at: string;
  updated_at: string;
};

export type CampaignFormValues = {
  name: string;
  artist_name: string;
  track_name: string;
  client_name: string;
  sound_url: string;
  status: CampaignStatus;
  start_date: string;
  end_date: string;
  report_number: string;
};

export type CampaignFormState = {
  error?: string;
  fieldErrors?: Partial<Record<keyof CampaignFormValues, string>>;
  values?: CampaignFormValues;
};
