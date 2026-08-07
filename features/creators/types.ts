export const CREATOR_PLATFORMS = ["tiktok", "instagram", "youtube"] as const;

/** Tiers that auto-calculation may assign. */
export const AUTO_CREATOR_CATEGORIES = [
  "nano",
  "micro",
  "macro",
  "mega",
] as const;

/**
 * All storable categories. `template` is legacy / curated-only and is never
 * produced by `calculateCreatorCategory`.
 */
export const CREATOR_CATEGORIES = [
  ...AUTO_CREATOR_CATEGORIES,
  "template",
] as const;

export const CREATOR_CATEGORY_SOURCES = ["auto", "manual"] as const;

export type CreatorPlatform = (typeof CREATOR_PLATFORMS)[number];
export type AutoCreatorCategory = (typeof AUTO_CREATOR_CATEGORIES)[number];
export type CreatorCategory = (typeof CREATOR_CATEGORIES)[number];
export type CreatorCategorySource = (typeof CREATOR_CATEGORY_SOURCES)[number];

export type Creator = {
  id: string;
  platform: CreatorPlatform;
  username: string;
  display_name: string | null;
  profile_url: string | null;
  avatar_url: string | null;
  follower_count: number;
  /** Null = uncategorized (unknown or below 1k). */
  category: CreatorCategory | null;
  category_source: CreatorCategorySource;
  /** Last successful profile sync. Null until a sync succeeds. */
  last_synced_at: string | null;
  /** Result of the most recent profile sync attempt. Not user-editable. */
  sync_status: "pending" | "success" | "failed";
  created_at: string;
  updated_at: string;
};

export type CampaignCreator = {
  id: string;
  campaign_id: string;
  creator_id: string;
  agreed_content_count: number;
  fee: number | null;
  notes: string | null;
  created_at: string;
};

export type CampaignCreatorWithCreator = CampaignCreator & {
  creator: Creator;
};

export type CreatorWithCampaignCount = Creator & {
  campaign_count: number;
};

export type CreatorCampaignAssignment = {
  campaign_id: string;
  campaign_name: string;
  agreed_content_count: number;
  fee: number | null;
  notes: string | null;
  assigned_at: string;
};

export type CreatorFormValues = {
  platform: CreatorPlatform;
  username: string;
  display_name: string;
  profile_url: string;
  avatar_url: string;
  follower_count: string;
  /** Empty string means uncategorized (null). */
  category: CreatorCategory | "";
};

export type CampaignCreatorFormValues = {
  agreed_content_count: string;
  fee: string;
  notes: string;
};

export type CreateAndAssignFormValues = CreatorFormValues &
  CampaignCreatorFormValues;

export type CreatorFormState = {
  error?: string;
  fieldErrors?: Partial<
    Record<keyof CreatorFormValues, string> &
      Record<keyof CampaignCreatorFormValues, string>
  >;
  values?: CreatorFormValues | CreateAndAssignFormValues;
};

export type AssignCreatorFormState = {
  error?: string;
  fieldErrors?: Partial<Record<keyof CampaignCreatorFormValues, string>>;
  values?: CampaignCreatorFormValues;
};
