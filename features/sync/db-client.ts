import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Opaque DB client accepted by sync services.
 * Cookie-session clients and the service-role admin client both satisfy this.
 */
export type SyncDbClient = SupabaseClient;
