import { createClient } from "@/lib/supabase/server";

export type SupabaseConnectionStatus = {
  ok: boolean;
  message: string;
};

function isMissingSessionError(message: string): boolean {
  const normalized = message.toLowerCase();

  return (
    normalized.includes("auth session missing") ||
    normalized.includes("jwt") ||
    normalized.includes("session")
  );
}

/**
 * Verifies that the server Supabase client can be initialized and reach the
 * Supabase Auth endpoint. Does not query application tables.
 *
 * Uses getClaims() for the auth handshake. This is a connectivity check only —
 * not an authorization decision. A missing session is expected when no user
 * is signed in.
 */
export async function verifySupabaseConnection(): Promise<SupabaseConnectionStatus> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.getClaims();

    if (error && !isMissingSessionError(error.message)) {
      return {
        ok: false,
        message: `Supabase auth handshake failed: ${error.message}`,
      };
    }

    return {
      ok: true,
      message: "Supabase client initialized successfully.",
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown Supabase initialization error.";

    return {
      ok: false,
      message,
    };
  }
}
