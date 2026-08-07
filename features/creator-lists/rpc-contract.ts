import type {
  PublicCreatorListCreator,
  PublicCreatorListPayload,
} from "@/features/creator-lists/types";

/** Must match SQL parameter name on resolve/consume RPCs. */
export const RESOLVE_PUBLIC_CREATOR_LIST_RPC = "resolve_public_creator_list";
export const RESOLVE_PUBLIC_CREATOR_LIST_RPC_PARAM = "p_raw_token";

/** Exact keys returned by resolve_public_creator_list RETURNS TABLE. */
export const RESOLVE_PUBLIC_CREATOR_LIST_RPC_KEYS = [
  "share_id",
  "list_id",
  "list_name",
  "description",
  "status",
  "allow_csv_download",
  "expires_at",
  "label",
  "creator_count",
  "creators",
  "stats",
] as const;

export const PUBLIC_CREATOR_ITEM_KEYS = [
  "position",
  "username",
  "display_name",
  "profile_url",
  "avatar_url",
  "platform",
  "category",
  "follower_count",
  "public_note",
] as const;

export const FORBIDDEN_PUBLIC_CREATOR_LIST_KEYS = [
  "internal_notes",
  "internal_note",
  "token_hash",
  "created_by",
  "fee",
  "fees",
  "email",
  "phone",
  "sync_status",
  "last_synced_at",
] as const;

export type RpcCreatorListRow = {
  share_id: string;
  list_id?: string | null;
  list_name: string;
  description: string | null;
  status?: string | null;
  allow_csv_download: boolean;
  expires_at?: string | null;
  label?: string | null;
  creator_count?: number | null;
  creators: unknown;
  stats?: unknown;
  access_recorded?: boolean;
};

function parseCreators(value: unknown): PublicCreatorListCreator[] {
  let raw: unknown = value;

  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.map((entry, index) => {
    const row = (entry ?? {}) as Record<string, unknown>;
    return {
      position: Number(row.position ?? index),
      username: String(row.username ?? ""),
      display_name:
        row.display_name == null ? null : String(row.display_name),
      profile_url: row.profile_url == null ? null : String(row.profile_url),
      avatar_url: row.avatar_url == null ? null : String(row.avatar_url),
      platform: String(row.platform ?? "tiktok"),
      category: row.category == null ? null : String(row.category),
      follower_count: Number(row.follower_count ?? 0),
      public_note: row.public_note == null ? null : String(row.public_note),
    };
  });
}

function parseStats(value: unknown): PublicCreatorListPayload["stats"] {
  let raw: unknown = value;

  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = {};
    }
  }

  const stats = (raw ?? {}) as Record<string, unknown>;

  return {
    creator_count: Number(stats.creator_count ?? 0),
    total_followers: Number(stats.total_followers ?? 0),
    platform_distribution:
      (stats.platform_distribution as Record<string, number> | undefined) ??
      {},
    category_distribution:
      (stats.category_distribution as Record<string, number> | undefined) ??
      {},
  };
}

export function firstCreatorListRpcRow(
  data: unknown
): RpcCreatorListRow | null {
  if (Array.isArray(data)) {
    return (data[0] as RpcCreatorListRow | undefined) ?? null;
  }

  if (data && typeof data === "object") {
    return data as RpcCreatorListRow;
  }

  return null;
}

export function mapCreatorListRpcPayload(
  row: RpcCreatorListRow
): PublicCreatorListPayload | null {
  if (!row.share_id || !row.list_name) {
    return null;
  }

  const creators = parseCreators(row.creators);
  const stats = parseStats(row.stats);
  const creatorCount =
    typeof row.creator_count === "number"
      ? row.creator_count
      : stats.creator_count || creators.length;

  return {
    shareId: row.share_id,
    listId: row.list_id ?? null,
    listName: row.list_name,
    description: row.description ?? null,
    status: row.status ?? null,
    allowCsvDownload: Boolean(row.allow_csv_download),
    expiresAt: row.expires_at ?? null,
    label: row.label ?? null,
    creators,
    stats: {
      ...stats,
      creator_count: creatorCount,
    },
    accessRecorded: row.access_recorded,
  };
}

export function assertPublicCreatorListPayloadSafe(
  payload: PublicCreatorListPayload
): void {
  const json = JSON.stringify(payload);

  for (const key of FORBIDDEN_PUBLIC_CREATOR_LIST_KEYS) {
    if (json.includes(`"${key}"`)) {
      throw new Error(`private_field_leak:${key}`);
    }
  }
}
