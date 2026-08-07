import type {
  Creator,
  CreatorCategory,
  CreatorPlatform,
} from "@/features/creators/types";
import type { ShareExpirationPreset } from "@/features/public-reports/types";

export const CREATOR_LIST_STATUSES = ["draft", "ready", "archived"] as const;
export type CreatorListStatus = (typeof CREATOR_LIST_STATUSES)[number];

export const CREATOR_SELECTION_MAX = 500;

export type CreatorList = {
  id: string;
  name: string;
  description: string | null;
  internal_notes: string | null;
  status: CreatorListStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CreatorListItem = {
  id: string;
  creator_list_id: string;
  creator_id: string;
  position: number;
  public_note: string | null;
  internal_note: string | null;
  created_at: string;
};

export type CreatorListItemWithCreator = CreatorListItem & {
  creator: Creator;
};

export type CreatorListSummary = CreatorList & {
  creator_count: number;
  total_followers: number;
  average_followers: number | null;
  active_share_count: number;
};

export type CreatorListDetail = CreatorList & {
  items: CreatorListItemWithCreator[];
  stats: CreatorListStats;
  active_share_count: number;
};

export type CreatorListStats = {
  creatorCount: number;
  totalFollowers: number;
  averageFollowers: number | null;
  medianFollowers: number | null;
  minFollowers: number | null;
  maxFollowers: number | null;
  categoryDistribution: Record<string, number>;
  platformDistribution: Record<CreatorPlatform | string, number>;
  tiktokCount: number;
};

export type CreatorListShare = {
  id: string;
  creator_list_id: string;
  created_by: string | null;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  last_accessed_at: string | null;
  access_count: number;
  label: string | null;
  allow_csv_download: boolean;
  status: "active" | "expired" | "revoked";
};

export type CreateCreatorListInput = {
  name: string;
  description?: string | null;
  internalNotes?: string | null;
  creatorIds: string[];
  status?: CreatorListStatus;
};

export type UpdateCreatorListInput = {
  listId: string;
  name: string;
  description?: string | null;
  internalNotes?: string | null;
  status?: CreatorListStatus;
};

export type CreateCreatorListShareInput = {
  listId: string;
  expiration: ShareExpirationPreset;
  customExpiresAt?: string | null;
  allowCsvDownload: boolean;
  label?: string | null;
};

export type CreateCreatorListShareResult = {
  shareId: string;
  publicUrl: string;
  expiresAt: string | null;
  allowCsvDownload: boolean;
};

export type CreatorListActionState = {
  success?: string;
  error?: string;
  result?: CreateCreatorListShareResult;
  listId?: string;
  campaignSummary?: CampaignHandoffSummary;
};

export type CampaignHandoffSummary = {
  campaignId: string;
  selectedCount: number;
  alreadyAssignedCount: number;
  newlyAssignedCount: number;
};

export type PublicCreatorListCreator = {
  position: number;
  username: string;
  display_name: string | null;
  profile_url: string | null;
  avatar_url: string | null;
  platform: CreatorPlatform | string;
  category: CreatorCategory | string | null;
  follower_count: number;
  public_note: string | null;
};

export type PublicCreatorListPayload = {
  shareId: string;
  listId?: string | null;
  listName: string;
  description: string | null;
  status?: string | null;
  allowCsvDownload: boolean;
  expiresAt: string | null;
  label: string | null;
  creators: PublicCreatorListCreator[];
  stats: {
    creator_count: number;
    total_followers: number;
    platform_distribution: Record<string, number>;
    category_distribution: Record<string, number>;
  };
  accessRecorded?: boolean;
};

export type { ShareExpirationPreset };
