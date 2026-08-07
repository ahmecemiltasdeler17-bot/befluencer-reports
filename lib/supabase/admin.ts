import "server-only";

import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";

/**
 * Server-only Supabase client using the service-role key.
 *
 * Used exclusively by scheduled/cron sync so work can run without a browser
 * session while still writing under RLS. Never import this module from client
 * components or any browser-reachable bundle entry.
 */
export function createServiceClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!serviceRoleKey) {
    throw new Error(
      [
        "BeFluencer Reports — scheduled sync requires SUPABASE_SERVICE_ROLE_KEY.",
        "",
        "Add the following server-only variable to .env.local:",
        "  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key",
        "",
        "Never prefix this with NEXT_PUBLIC_.",
      ].join("\n")
    );
  }

  const { NEXT_PUBLIC_SUPABASE_URL } = env();

  return createSupabaseJsClient(NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function isServiceRoleConfigured(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}
