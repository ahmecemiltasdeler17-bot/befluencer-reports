import type { SupabaseClient } from "@supabase/supabase-js";

export type VerifiedAuth = {
  subject: string;
  email?: string;
};

/**
 * Verifies the caller identity from JWT claims.
 * Use this (or getUser()) for authorization — never getSession().
 */
export async function getVerifiedAuth(
  supabase: SupabaseClient
): Promise<VerifiedAuth | null> {
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) {
    return null;
  }

  const email =
    typeof data.claims.email === "string" ? data.claims.email : undefined;

  return {
    subject: data.claims.sub,
    email,
  };
}
