import "server-only";

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

export type ExistingCreatorMatch = {
  id: string;
  username: string;
  profile_url: string | null;
};

/**
 * Finds TikTok creators matching any of the usernames or canonical profile URLs.
 * Username comparison is case-insensitive in memory after fetching lowercase keys
 * and ilike OR filters for legacy mixed-case rows.
 */
export async function findExistingTikTokCreators(
  usernames: string[]
): Promise<ExistingCreatorMatch[]> {
  const unique = Array.from(
    new Set(
      usernames
        .map((value) => value.trim().replace(/^@+/, "").toLowerCase())
        .filter((value) => value.length > 0)
    )
  );

  if (unique.length === 0) {
    return [];
  }

  const supabase = await requireAuthenticatedClient();
  const found = new Map<string, ExistingCreatorMatch>();

  for (let i = 0; i < unique.length; i += 50) {
    const chunk = unique.slice(i, i + 50);
    const profileUrls = chunk.map((username) => `https://www.tiktok.com/@${username}`);

    const { data: byUsername, error: usernameError } = await supabase
      .from("creators")
      .select("id, username, profile_url")
      .eq("platform", "tiktok")
      .in("username", chunk);

    if (usernameError) {
      throw new Error(mapSupabaseError(usernameError.message));
    }

    for (const row of byUsername ?? []) {
      found.set(row.id as string, {
        id: row.id as string,
        username: row.username as string,
        profile_url: (row.profile_url as string | null) ?? null,
      });
    }

    const { data: byUrl, error: urlError } = await supabase
      .from("creators")
      .select("id, username, profile_url")
      .eq("platform", "tiktok")
      .in("profile_url", profileUrls);

    if (urlError) {
      throw new Error(mapSupabaseError(urlError.message));
    }

    for (const row of byUrl ?? []) {
      found.set(row.id as string, {
        id: row.id as string,
        username: row.username as string,
        profile_url: (row.profile_url as string | null) ?? null,
      });
    }

    // Legacy mixed-case usernames (unique constraint is case-sensitive in Postgres).
    const orFilter = chunk
      .map((username) => `username.ilike."${username.replace(/"/g, "")}"`)
      .join(",");

    const { data: byIlike, error: ilikeError } = await supabase
      .from("creators")
      .select("id, username, profile_url")
      .eq("platform", "tiktok")
      .or(orFilter);

    if (ilikeError) {
      throw new Error(mapSupabaseError(ilikeError.message));
    }

    for (const row of byIlike ?? []) {
      found.set(row.id as string, {
        id: row.id as string,
        username: row.username as string,
        profile_url: (row.profile_url as string | null) ?? null,
      });
    }
  }

  return Array.from(found.values());
}

export async function insertCreatorImportBatch(
  rows: Array<{
    username: string;
    display_name: string;
    profile_url: string;
  }>
): Promise<{ inserted: ExistingCreatorMatch[]; error?: string; code?: string }> {
  if (rows.length === 0) {
    return { inserted: [] };
  }

  const supabase = await requireAuthenticatedClient();

  const payload = rows.map((row) => ({
    platform: "tiktok" as const,
    username: row.username,
    display_name: row.display_name,
    profile_url: row.profile_url,
    avatar_url: null,
    follower_count: 0,
    // Unknown until profile sync; zero followers must not imply "micro".
    category: null,
    category_source: "auto" as const,
  }));

  const { data, error } = await supabase
    .from("creators")
    .insert(payload)
    .select("id, username, profile_url");

  if (error) {
    return {
      inserted: [],
      error: error.message,
      code: error.code,
    };
  }

  return {
    inserted: (data ?? []).map((row) => ({
      id: row.id as string,
      username: row.username as string,
      profile_url: (row.profile_url as string | null) ?? null,
    })),
  };
}
