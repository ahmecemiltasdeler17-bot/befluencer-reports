import "server-only";

import { calculateCreatorListStats } from "@/features/creator-lists/calculations";
import {
  diagnoseCreatorListTokenFormat,
  logCreatorListDiagnostics,
  logPublicCreatorListResolveDiagnostic,
  mapCreatorListSupabaseError,
  readSupabaseErrorParts,
  type CreatorListOperation,
} from "@/features/creator-lists/diagnostics";
import { CreatorListError } from "@/features/creator-lists/errors";
import {
  RESOLVE_PUBLIC_CREATOR_LIST_RPC,
  RESOLVE_PUBLIC_CREATOR_LIST_RPC_PARAM,
  firstCreatorListRpcRow,
  mapCreatorListRpcPayload,
} from "@/features/creator-lists/rpc-contract";
import type {
  CreatorList,
  CreatorListDetail,
  CreatorListItemWithCreator,
  CreatorListShare,
  CreatorListSummary,
  PublicCreatorListPayload,
} from "@/features/creator-lists/types";
import { isAccessNonce, isRawShareToken } from "@/features/creator-lists/token";
import type { Creator } from "@/features/creators/types";
import { resolvePublicShareStatus } from "@/features/public-reports/calculations";
import { isUuid } from "@/features/pdf/origin";
import { getVerifiedAuth } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export {
  RESOLVE_PUBLIC_CREATOR_LIST_RPC,
  RESOLVE_PUBLIC_CREATOR_LIST_RPC_KEYS,
  RESOLVE_PUBLIC_CREATOR_LIST_RPC_PARAM,
  mapCreatorListRpcPayload,
} from "@/features/creator-lists/rpc-contract";

async function requireAuthenticatedClient() {
  const supabase = await createClient();
  const auth = await getVerifiedAuth(supabase);

  if (!auth) {
    throw new CreatorListError("not_authenticated");
  }

  return { supabase, auth };
}

function throwQueryError(
  error: unknown,
  operation: CreatorListOperation,
  tableOrRpc: string,
  authenticated: boolean
): never {
  const parts = readSupabaseErrorParts(error);
  const mapped = mapCreatorListSupabaseError(error, "database_failure");

  logCreatorListDiagnostics({
    operation,
    tableOrRpc,
    errorCode: parts.code,
    constraint: parts.constraint,
    authenticated,
    mappedCode: mapped,
  });

  throw new CreatorListError(mapped);
}

function mapList(row: Record<string, unknown>): CreatorList {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string | null) ?? null,
    internal_notes: (row.internal_notes as string | null) ?? null,
    status: row.status as CreatorList["status"],
    created_by: (row.created_by as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export async function listCreatorLists(): Promise<CreatorListSummary[]> {
  const { supabase } = await requireAuthenticatedClient();

  const { data, error } = await supabase
    .from("creator_lists")
    .select(
      `
      *,
      creator_list_items ( creator_id, creator:creators ( follower_count ) ),
      creator_list_shares ( id, revoked_at, expires_at )
    `
    )
    .order("updated_at", { ascending: false });

  if (error) {
    throwQueryError(error, "listCreatorLists", "creator_lists", true);
  }

  const now = new Date();

  return (data ?? []).map((row) => {
    const list = mapList(row);
    const items = (row.creator_list_items ?? []) as Array<{
      creator_id: string;
      creator: { follower_count: number } | null;
    }>;
    const creators = items
      .filter((item) => item.creator)
      .map((item) => ({
        id: item.creator_id,
        follower_count: Number(item.creator!.follower_count),
        category: null,
        platform: null,
      }));
    const stats = calculateCreatorListStats(creators);
    const shares = (row.creator_list_shares ?? []) as Array<{
      id: string;
      revoked_at: string | null;
      expires_at: string | null;
    }>;
    const active_share_count = shares.filter(
      (share) => resolvePublicShareStatus(share, now) === "active"
    ).length;

    return {
      ...list,
      creator_count: stats.creatorCount,
      total_followers: stats.totalFollowers,
      average_followers: stats.averageFollowers,
      active_share_count,
    };
  });
}

export async function getCreatorList(
  id: string
): Promise<CreatorListDetail | null> {
  if (!isUuid(id)) {
    return null;
  }

  const { supabase } = await requireAuthenticatedClient();

  const { data, error } = await supabase
    .from("creator_lists")
    .select(
      `
      *,
      creator_list_items (
        id,
        creator_list_id,
        creator_id,
        position,
        public_note,
        internal_note,
        created_at,
        creator:creators (*)
      ),
      creator_list_shares ( id, revoked_at, expires_at )
    `
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throwQueryError(error, "getCreatorList", "creator_lists", true);
  }

  if (!data) {
    return null;
  }

  const list = mapList(data);
  const rawItems = (data.creator_list_items ?? []) as Array<
    Record<string, unknown> & { creator: Creator | null }
  >;

  const items: CreatorListItemWithCreator[] = rawItems
    .filter((item) => item.creator)
    .map((item) => ({
      id: item.id as string,
      creator_list_id: item.creator_list_id as string,
      creator_id: item.creator_id as string,
      position: Number(item.position),
      public_note: (item.public_note as string | null) ?? null,
      internal_note: (item.internal_note as string | null) ?? null,
      created_at: item.created_at as string,
      creator: item.creator as Creator,
    }))
    .sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));

  const stats = calculateCreatorListStats(
    items.map((item) => item.creator)
  );
  const now = new Date();
  const shares = (data.creator_list_shares ?? []) as Array<{
    id: string;
    revoked_at: string | null;
    expires_at: string | null;
  }>;

  return {
    ...list,
    items,
    stats,
    active_share_count: shares.filter(
      (share) => resolvePublicShareStatus(share, now) === "active"
    ).length,
  };
}

export async function listCreatorListShares(
  listId: string
): Promise<CreatorListShare[]> {
  if (!isUuid(listId)) {
    return [];
  }

  const { supabase } = await requireAuthenticatedClient();

  const { data, error } = await supabase
    .from("creator_list_shares")
    .select(
      "id, creator_list_id, created_by, created_at, expires_at, revoked_at, last_accessed_at, access_count, label, allow_csv_download"
    )
    .eq("creator_list_id", listId)
    .order("created_at", { ascending: false });

  if (error) {
    throwQueryError(error, "listCreatorListShares", "creator_list_shares", true);
  }

  const now = new Date();

  return (data ?? []).map((row) => {
    const status = resolvePublicShareStatus(row, now);
    return {
      id: row.id as string,
      creator_list_id: row.creator_list_id as string,
      created_by: (row.created_by as string | null) ?? null,
      created_at: row.created_at as string,
      expires_at: (row.expires_at as string | null) ?? null,
      revoked_at: (row.revoked_at as string | null) ?? null,
      last_accessed_at: (row.last_accessed_at as string | null) ?? null,
      access_count: Number(row.access_count),
      label: (row.label as string | null) ?? null,
      allow_csv_download: Boolean(row.allow_csv_download),
      status,
    };
  });
}

export async function getCreatorListShare(shareId: string) {
  if (!isUuid(shareId)) {
    return null;
  }

  const { supabase } = await requireAuthenticatedClient();
  const { data, error } = await supabase
    .from("creator_list_shares")
    .select(
      "id, creator_list_id, created_by, created_at, expires_at, revoked_at, last_accessed_at, access_count, label, allow_csv_download"
    )
    .eq("id", shareId)
    .maybeSingle();

  if (error) {
    throwQueryError(error, "listCreatorListShares", "creator_list_shares", true);
  }

  if (!data) {
    return null;
  }

  return {
    ...data,
    status: resolvePublicShareStatus(data),
  } as CreatorListShare;
}

export async function resolvePublicCreatorList(
  rawToken: string
): Promise<PublicCreatorListPayload | null> {
  const tokenFormatValid = diagnoseCreatorListTokenFormat(rawToken);

  if (!tokenFormatValid) {
    logPublicCreatorListResolveDiagnostic({
      tokenFormatValid: false,
      shareRowFound: false,
      shareUsable: false,
      creatorListFound: false,
      itemCount: null,
      rpcErrorCode: "invalid_token_format",
      parserSuccess: false,
    });
    return null;
  }

  // Publishable/anon client — session optional; RPC is SECURITY DEFINER.
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(RESOLVE_PUBLIC_CREATOR_LIST_RPC, {
    [RESOLVE_PUBLIC_CREATOR_LIST_RPC_PARAM]: rawToken,
  });

  if (error) {
    logPublicCreatorListResolveDiagnostic({
      tokenFormatValid: true,
      shareRowFound: false,
      shareUsable: false,
      creatorListFound: false,
      itemCount: null,
      rpcErrorCode: error.code ?? "rpc_error",
      parserSuccess: false,
    });
    return null;
  }

  const row = firstCreatorListRpcRow(data);

  if (!row) {
    logPublicCreatorListResolveDiagnostic({
      tokenFormatValid: true,
      shareRowFound: false,
      shareUsable: false,
      creatorListFound: false,
      itemCount: null,
      rpcErrorCode: null,
      parserSuccess: false,
    });
    return null;
  }

  const payload = mapCreatorListRpcPayload(row);
  const itemCount = payload?.stats.creator_count ?? null;

  logPublicCreatorListResolveDiagnostic({
    tokenFormatValid: true,
    shareRowFound: true,
    shareUsable: payload !== null,
    creatorListFound: Boolean(row.list_id || row.list_name),
    itemCount,
    rpcErrorCode: null,
    parserSuccess: payload !== null,
  });

  return payload;
}

export async function consumePublicCreatorListAccess(
  rawToken: string,
  accessNonce: string
): Promise<PublicCreatorListPayload | null> {
  if (!isRawShareToken(rawToken) || !isAccessNonce(accessNonce)) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("consume_public_creator_list", {
    [RESOLVE_PUBLIC_CREATOR_LIST_RPC_PARAM]: rawToken,
    p_access_nonce: accessNonce,
  });

  if (error) {
    return null;
  }

  const row = firstCreatorListRpcRow(data);
  if (!row) {
    return null;
  }

  return mapCreatorListRpcPayload(row);
}

export async function consumePublicCreatorListCsv(
  rawToken: string
): Promise<PublicCreatorListPayload | null> {
  if (!isRawShareToken(rawToken)) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("consume_public_creator_list_csv", {
    [RESOLVE_PUBLIC_CREATOR_LIST_RPC_PARAM]: rawToken,
  });

  if (error) {
    return null;
  }

  const row = firstCreatorListRpcRow(data);
  if (!row) {
    return null;
  }

  return mapCreatorListRpcPayload(row);
}
