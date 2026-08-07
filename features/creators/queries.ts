import { getVerifiedAuth } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

import type {
  CampaignCreatorWithCreator,
  Creator,
  CreatorCampaignAssignment,
  CreatorCategory,
  CreatorPlatform,
  CreatorWithCampaignCount,
} from "@/features/creators/types";

function mapSupabaseError(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes("permission denied")) {
    return "Bu işlem için yetkiniz yok.";
  }

  if (normalized.includes("jwt")) {
    return "Oturumunuz geçersiz. Lütfen tekrar giriş yapın.";
  }

  return "Veritabanı hatası oluştu. Lütfen tekrar deneyin.";
}

async function requireAuthenticatedClient() {
  const supabase = await createClient();
  const auth = await getVerifiedAuth(supabase);

  if (!auth) {
    throw new Error("Oturum açmanız gerekiyor.");
  }

  return supabase;
}

export type ListCreatorsFilters = {
  query?: string;
  platform?: CreatorPlatform | "all";
  category?: CreatorCategory | "all";
  minFollowers?: number | null;
  maxFollowers?: number | null;
  syncStatus?: "all" | "pending" | "success" | "failed";
  campaignAssignment?: "all" | "assigned" | "unassigned";
  hasAvatar?: "all" | "yes" | "no";
};

export async function listCreators(
  filters: ListCreatorsFilters = {}
): Promise<CreatorWithCampaignCount[]> {
  const supabase = await requireAuthenticatedClient();

  let query = supabase
    .from("creators")
    .select("*, campaign_creators(count)")
    .order("created_at", { ascending: false });

  if (filters.platform && filters.platform !== "all") {
    query = query.eq("platform", filters.platform);
  }

  if (filters.category && filters.category !== "all") {
    query = query.eq("category", filters.category);
  }

  if (
    typeof filters.minFollowers === "number" &&
    Number.isFinite(filters.minFollowers)
  ) {
    query = query.gte("follower_count", filters.minFollowers);
  }

  if (
    typeof filters.maxFollowers === "number" &&
    Number.isFinite(filters.maxFollowers)
  ) {
    query = query.lte("follower_count", filters.maxFollowers);
  }

  if (filters.syncStatus && filters.syncStatus !== "all") {
    query = query.eq("sync_status", filters.syncStatus);
  }

  if (filters.hasAvatar === "yes") {
    query = query.not("avatar_url", "is", null);
  } else if (filters.hasAvatar === "no") {
    query = query.is("avatar_url", null);
  }

  if (filters.query?.trim()) {
    const safe = filters.query.trim().replace(/[%_,]/g, "");
    const term = `%${safe}%`;
    query = query.or(`username.ilike.${term},display_name.ilike.${term}`);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(mapSupabaseError(error.message));
  }

  let rows = (data ?? []).map((row) => {
    const countRow = row.campaign_creators as { count: number }[] | null;
    const campaignCount = countRow?.[0]?.count ?? 0;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- omit join aggregate from creator row
    const { campaign_creators, ...creator } = row;

    return {
      ...(creator as Creator),
      campaign_count: campaignCount,
    };
  });

  if (filters.campaignAssignment === "assigned") {
    rows = rows.filter((row) => row.campaign_count > 0);
  } else if (filters.campaignAssignment === "unassigned") {
    rows = rows.filter((row) => row.campaign_count === 0);
  }

  return rows;
}

export async function searchCreators(query: string): Promise<Creator[]> {
  const supabase = await requireAuthenticatedClient();
  const trimmed = query.trim();

  if (!trimmed) {
    return [];
  }

  const safe = trimmed.replace(/[%_,]/g, "").replace(/^@+/, "").toLowerCase();
  if (!safe) {
    return [];
  }

  const term = `%${safe}%`;

  const { data, error } = await supabase
    .from("creators")
    .select("*")
    .or(`username.ilike.${term},display_name.ilike.${term},platform.ilike.${term}`)
    .order("follower_count", { ascending: false })
    .limit(20);

  if (error) {
    throw new Error(mapSupabaseError(error.message));
  }

  return (data ?? []) as Creator[];
}

export async function getCreatorById(id: string): Promise<Creator | null> {
  const supabase = await requireAuthenticatedClient();

  const { data, error } = await supabase
    .from("creators")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(mapSupabaseError(error.message));
  }

  return (data as Creator | null) ?? null;
}

export async function getCreatorWithCampaigns(id: string): Promise<{
  creator: Creator;
  assignments: CreatorCampaignAssignment[];
} | null> {
  const supabase = await requireAuthenticatedClient();

  const { data, error } = await supabase
    .from("creators")
    .select(
      `
      *,
      campaign_creators (
        agreed_content_count,
        fee,
        notes,
        created_at,
        campaign:campaigns (id, name)
      )
    `
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(mapSupabaseError(error.message));
  }

  if (!data) {
    return null;
  }

  const { campaign_creators, ...creatorData } = data;
  const rows = (campaign_creators ?? []) as Array<{
    agreed_content_count: number;
    fee: number | null;
    notes: string | null;
    created_at: string;
    campaign: { id: string; name: string } | null;
  }>;

  const assignments: CreatorCampaignAssignment[] = rows
    .filter((row) => row.campaign)
    .map((row) => ({
      campaign_id: row.campaign!.id,
      campaign_name: row.campaign!.name,
      agreed_content_count: row.agreed_content_count,
      fee: row.fee,
      notes: row.notes,
      assigned_at: row.created_at,
    }));

  return {
    creator: creatorData as Creator,
    assignments,
  };
}

export async function listCampaignCreators(
  campaignId: string
): Promise<CampaignCreatorWithCreator[]> {
  const supabase = await requireAuthenticatedClient();

  const { data, error } = await supabase
    .from("campaign_creators")
    .select("*, creator:creators(*)")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(mapSupabaseError(error.message));
  }

  return (data ?? []).map((row) => ({
    ...(row as Omit<CampaignCreatorWithCreator, "creator">),
    creator: row.creator as Creator,
  }));
}

export async function getCampaignCreator(
  campaignId: string,
  creatorId: string
): Promise<CampaignCreatorWithCreator | null> {
  const supabase = await requireAuthenticatedClient();

  const { data, error } = await supabase
    .from("campaign_creators")
    .select("*, creator:creators(*)")
    .eq("campaign_id", campaignId)
    .eq("creator_id", creatorId)
    .maybeSingle();

  if (error) {
    throw new Error(mapSupabaseError(error.message));
  }

  if (!data) {
    return null;
  }

  return {
    ...(data as Omit<CampaignCreatorWithCreator, "creator">),
    creator: data.creator as Creator,
  };
}

export async function isCreatorAssignedToCampaign(
  campaignId: string,
  creatorId: string
): Promise<boolean> {
  const assignment = await getCampaignCreator(campaignId, creatorId);
  return assignment !== null;
}
