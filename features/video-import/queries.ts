import "server-only";

import { calculateCreatorCategory } from "@/features/creators/calculate-creator-category";
import type { ExistingVideoIdentity } from "@/features/video-import/matching";
import { getVerifiedAuth } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { buildTikTokProfileUrl } from "@/lib/providers/tiktok";

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

export async function findVideosByUrlsOrPlatformIds(input: {
  urls: string[];
  platformVideoIds: string[];
}): Promise<ExistingVideoIdentity[]> {
  const supabase = await requireAuthenticatedClient();
  const found = new Map<string, ExistingVideoIdentity>();

  const urls = Array.from(new Set(input.urls.filter(Boolean)));
  const ids = Array.from(new Set(input.platformVideoIds.filter(Boolean)));

  for (let i = 0; i < urls.length; i += 50) {
    const chunk = urls.slice(i, i + 50);
    const { data, error } = await supabase
      .from("videos")
      .select("id, campaign_id, video_url, platform_video_id")
      .in("video_url", chunk);

    if (error) {
      throw new Error(mapSupabaseError(error.message));
    }

    for (const row of data ?? []) {
      found.set(row.id as string, {
        id: row.id as string,
        campaign_id: row.campaign_id as string,
        video_url: row.video_url as string,
        platform_video_id: (row.platform_video_id as string | null) ?? null,
      });
    }
  }

  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const { data, error } = await supabase
      .from("videos")
      .select("id, campaign_id, video_url, platform_video_id")
      .in("platform_video_id", chunk);

    if (error) {
      throw new Error(mapSupabaseError(error.message));
    }

    for (const row of data ?? []) {
      found.set(row.id as string, {
        id: row.id as string,
        campaign_id: row.campaign_id as string,
        video_url: row.video_url as string,
        platform_video_id: (row.platform_video_id as string | null) ?? null,
      });
    }
  }

  return Array.from(found.values());
}

/**
 * Ensures campaign_creators row exists. Never updates fee/notes/count.
 */
export async function ensureCampaignCreatorAssignment(
  campaignId: string,
  creatorId: string
): Promise<{ created: boolean }> {
  const supabase = await requireAuthenticatedClient();

  const { data: existing, error: existingError } = await supabase
    .from("campaign_creators")
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("creator_id", creatorId)
    .maybeSingle();

  if (existingError) {
    throw new Error(mapSupabaseError(existingError.message));
  }

  if (existing) {
    return { created: false };
  }

  const { error } = await supabase.from("campaign_creators").insert({
    campaign_id: campaignId,
    creator_id: creatorId,
    agreed_content_count: 0,
    fee: null,
    notes: null,
  });

  if (error) {
    if (error.code === "23505") {
      return { created: false };
    }
    throw new Error(mapSupabaseError(error.message));
  }

  return { created: true };
}

export async function createMinimalTikTokCreator(input: {
  username: string;
  displayName: string | null;
  profileUrl: string | null;
  avatarUrl: string | null;
  followerCount: number | null;
}): Promise<{ id: string }> {
  const supabase = await requireAuthenticatedClient();
  const username = input.username.trim().replace(/^@+/, "").toLowerCase();
  const followerCount = Math.max(0, Number(input.followerCount) || 0);
  const category = calculateCreatorCategory(
    followerCount > 0 ? followerCount : null
  );

  const { data, error } = await supabase
    .from("creators")
    .insert({
      platform: "tiktok",
      username,
      display_name: input.displayName?.trim() || username,
      profile_url: input.profileUrl ?? buildTikTokProfileUrl(username),
      avatar_url: input.avatarUrl,
      follower_count: followerCount,
      category,
      category_source: "auto",
    })
    .select("id")
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      const { data: existing, error: lookupError } = await supabase
        .from("creators")
        .select("id")
        .eq("platform", "tiktok")
        .eq("username", username)
        .maybeSingle();

      if (lookupError || !existing) {
        throw new Error(mapSupabaseError(error?.message ?? "duplicate"));
      }

      return { id: existing.id as string };
    }

    throw new Error(mapSupabaseError(error?.message ?? "insert failed"));
  }

  return { id: data.id as string };
}

export async function insertCampaignVideoFromImport(input: {
  campaignId: string;
  creatorId: string;
  videoUrl: string;
  platformVideoId: string | null;
  caption: string | null;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  metrics?: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
  } | null;
}): Promise<{ id: string }> {
  const supabase = await requireAuthenticatedClient();

  const { data, error } = await supabase
    .from("videos")
    .insert({
      campaign_id: input.campaignId,
      creator_id: input.creatorId,
      platform: "tiktok",
      video_url: input.videoUrl,
      platform_video_id: input.platformVideoId,
      caption: input.caption,
      thumbnail_url: input.thumbnailUrl,
      published_at: input.publishedAt,
      status: "published",
      sync_status: "pending",
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(mapSupabaseError(error?.message ?? "insert failed"));
  }

  const videoId = data.id as string;

  if (input.metrics) {
    await supabase.from("video_metric_snapshots").insert({
      video_id: videoId,
      captured_at: new Date().toISOString(),
      views: input.metrics.views,
      likes: input.metrics.likes,
      comments: input.metrics.comments,
      shares: input.metrics.shares,
      saves: input.metrics.saves,
    });
  }

  return { id: videoId };
}

export async function getCreatorByIdForImport(creatorId: string): Promise<{
  id: string;
  username: string;
  platform: string;
} | null> {
  const supabase = await requireAuthenticatedClient();
  const { data, error } = await supabase
    .from("creators")
    .select("id, username, platform")
    .eq("id", creatorId)
    .maybeSingle();

  if (error) {
    throw new Error(mapSupabaseError(error.message));
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id as string,
    username: data.username as string,
    platform: data.platform as string,
  };
}
