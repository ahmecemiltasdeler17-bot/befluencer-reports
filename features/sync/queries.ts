import type { SyncJobWithRelations } from "@/features/sync/types";
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

export async function listCampaignSyncJobs(
  campaignId: string,
  limit = 20
): Promise<SyncJobWithRelations[]> {
  const supabase = await requireAuthenticatedClient();

  const { data, error } = await supabase
    .from("sync_jobs")
    .select(
      `
      *,
      video:videos (
        id,
        video_url,
        platform,
        creator:creators (
          id,
          username,
          display_name
        )
      )
    `
    )
    .eq("campaign_id", campaignId)
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(mapSupabaseError(error.message));
  }

  return (data ?? []).map((row) => ({
    ...(row as SyncJobWithRelations),
    video: row.video as SyncJobWithRelations["video"],
  }));
}
