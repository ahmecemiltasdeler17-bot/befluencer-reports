import "server-only";

import { countLeadsByStatus } from "@/features/leads/calculations";
import type {
  Lead,
  LeadKind,
  LeadStatus,
  LeadStatusCounts,
  LeadWithCreator,
} from "@/features/leads/types";
import { getVerifiedAuth } from "@/lib/supabase/auth";
import {
  throwMappedDatabaseError,
  type SupabaseLikeError,
} from "@/lib/supabase/database-error";
import { createClient } from "@/lib/supabase/server";

async function requireAuthenticatedClient() {
  const supabase = await createClient();
  const auth = await getVerifiedAuth(supabase);

  if (!auth) {
    throw new Error("Oturum açmanız gerekiyor.");
  }

  return supabase;
}

function fail(operation: string, error: SupabaseLikeError): never {
  throwMappedDatabaseError(error, { operation, table: "leads" });
}

export type ListLeadsFilters = {
  kind?: LeadKind | "all";
  status?: LeadStatus | "all";
  query?: string;
};

const LEAD_SELECT = `
  *,
  creator:creators (id, username, platform)
`;

/**
 * Newest submissions first.
 *
 * `received_at` orders the list rather than `submitted_at`: the latter is
 * reported by the marketing site and a clock skew there must not reorder the
 * inbox.
 */
export async function listLeads(
  filters: ListLeadsFilters = {}
): Promise<LeadWithCreator[]> {
  const supabase = await requireAuthenticatedClient();

  let query = supabase
    .from("leads")
    .select(LEAD_SELECT)
    .order("received_at", { ascending: false })
    .limit(500);

  if (filters.kind && filters.kind !== "all") {
    query = query.eq("kind", filters.kind);
  }

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  if (filters.query?.trim()) {
    const safe = filters.query.trim().replace(/[%_,]/g, "");
    const term = `%${safe}%`;
    query = query.or(`full_name.ilike.${term},email.ilike.${term}`);
  }

  const { data, error } = await query;

  if (error) {
    fail("listLeads", error);
  }

  return (data ?? []).map((row) => {
    const { creator, ...lead } = row as Lead & {
      creator: LeadWithCreator["creator"] | LeadWithCreator["creator"][] | null;
    };

    return {
      ...lead,
      payload: (lead.payload ?? {}) as Record<string, unknown>,
      creator: Array.isArray(creator) ? (creator[0] ?? null) : (creator ?? null),
    };
  });
}

/**
 * Status totals across every lead, independent of the active filter — the
 * counters must not shrink when the list is narrowed.
 */
export async function getLeadStatusCounts(): Promise<LeadStatusCounts> {
  const supabase = await requireAuthenticatedClient();

  const { data, error } = await supabase.from("leads").select("status");

  if (error) {
    fail("getLeadStatusCounts", error);
  }

  return countLeadsByStatus((data ?? []) as Array<{ status: LeadStatus }>);
}

export async function getLeadById(id: string): Promise<LeadWithCreator | null> {
  const supabase = await requireAuthenticatedClient();

  const { data, error } = await supabase
    .from("leads")
    .select(LEAD_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    fail("getLeadById", error);
  }

  if (!data) {
    return null;
  }

  const { creator, ...lead } = data as Lead & {
    creator: LeadWithCreator["creator"] | LeadWithCreator["creator"][] | null;
  };

  return {
    ...lead,
    payload: (lead.payload ?? {}) as Record<string, unknown>,
    creator: Array.isArray(creator) ? (creator[0] ?? null) : (creator ?? null),
  };
}
