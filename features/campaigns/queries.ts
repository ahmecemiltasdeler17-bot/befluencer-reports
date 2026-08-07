import { getVerifiedAuth } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

import type { Campaign } from "@/features/campaigns/types";

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

export async function listCampaigns(): Promise<Campaign[]> {
  const supabase = await requireAuthenticatedClient();

  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(mapSupabaseError(error.message));
  }

  return (data ?? []) as Campaign[];
}

export async function getCampaignById(id: string): Promise<Campaign | null> {
  const supabase = await requireAuthenticatedClient();

  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(mapSupabaseError(error.message));
  }

  return (data as Campaign | null) ?? null;
}
