import { notFound } from "next/navigation";

import { mapCampaignReportData } from "@/features/reports/mapper";
import type { CampaignReportData, RawCampaignReportInput } from "@/features/reports/types";
import { getVerifiedAuth } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

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

export async function getCampaignReportData(
  campaignId: string
): Promise<CampaignReportData> {
  const supabase = await requireAuthenticatedClient();

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .maybeSingle();

  if (campaignError) {
    throw new Error(mapSupabaseError(campaignError.message));
  }

  if (!campaign) {
    notFound();
  }

  const [
    reportResult,
    videosResult,
    soundSnapshotsResult,
  ] = await Promise.all([
    supabase
      .from("reports")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("videos")
      .select(
        `
        *,
        creator:creators (
          id,
          username,
          display_name,
          avatar_url,
          profile_url,
          follower_count,
          category,
          platform
        )
      `
      )
      .eq("campaign_id", campaignId)
      .neq("status", "unavailable")
      .order("published_at", { ascending: false, nullsFirst: false }),
    supabase
      .from("sound_metric_snapshots")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("captured_at", { ascending: true }),
  ]);

  if (videosResult.error) {
    throw new Error(mapSupabaseError(videosResult.error.message));
  }

  if (soundSnapshotsResult.error) {
    throw new Error(mapSupabaseError(soundSnapshotsResult.error.message));
  }

  if (reportResult.error) {
    throw new Error(mapSupabaseError(reportResult.error.message));
  }

  const videos = (videosResult.data ?? []) as RawCampaignReportInput["videos"];
  const videoIds = videos.map((video) => video.id);

  let videoSnapshots: RawCampaignReportInput["videoSnapshots"] = [];

  if (videoIds.length > 0) {
    const { data, error } = await supabase
      .from("video_metric_snapshots")
      .select("*")
      .in("video_id", videoIds)
      .order("captured_at", { ascending: true });

    if (error) {
      throw new Error(mapSupabaseError(error.message));
    }

    videoSnapshots = (data ?? []) as RawCampaignReportInput["videoSnapshots"];
  }

  return mapCampaignReportData({
    campaign: campaign as RawCampaignReportInput["campaign"],
    report: (reportResult.data as RawCampaignReportInput["report"]) ?? null,
    videos,
    videoSnapshots,
    soundSnapshots: (soundSnapshotsResult.data ??
      []) as RawCampaignReportInput["soundSnapshots"],
  });
}

export async function campaignHasReportRecord(
  campaignId: string
): Promise<boolean> {
  const supabase = await requireAuthenticatedClient();

  const { count, error } = await supabase
    .from("reports")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", campaignId);

  if (error) {
    throw new Error(mapSupabaseError(error.message));
  }

  return (count ?? 0) > 0;
}
