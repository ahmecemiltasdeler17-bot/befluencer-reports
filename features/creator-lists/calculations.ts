import type { CreatorPlatform } from "@/features/creators/types";
import type { CreatorListStats } from "@/features/creator-lists/types";
import { CREATOR_SELECTION_MAX } from "@/features/creator-lists/types";

export type CreatorMetricInput = {
  id: string;
  follower_count: number;
  category?: string | null;
  platform?: string | null;
};

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    if (seen.has(item.id)) {
      continue;
    }
    seen.add(item.id);
    result.push(item);
  }

  return result;
}

export function creatorCount(creators: CreatorMetricInput[]): number {
  return dedupeById(creators).length;
}

export function totalFollowers(creators: CreatorMetricInput[]): number {
  return dedupeById(creators).reduce(
    (sum, creator) => sum + Math.max(0, Number(creator.follower_count) || 0),
    0
  );
}

export function averageFollowers(creators: CreatorMetricInput[]): number | null {
  const items = dedupeById(creators);
  if (items.length === 0) {
    return null;
  }

  return totalFollowers(items) / items.length;
}

export function medianFollowers(creators: CreatorMetricInput[]): number | null {
  const values = dedupeById(creators)
    .map((creator) => Math.max(0, Number(creator.follower_count) || 0))
    .sort((a, b) => a - b);

  if (values.length === 0) {
    return null;
  }

  const mid = Math.floor(values.length / 2);

  if (values.length % 2 === 1) {
    return values[mid]!;
  }

  return (values[mid - 1]! + values[mid]!) / 2;
}

export function minFollowers(creators: CreatorMetricInput[]): number | null {
  const items = dedupeById(creators);
  if (items.length === 0) {
    return null;
  }

  return Math.min(
    ...items.map((creator) => Math.max(0, Number(creator.follower_count) || 0))
  );
}

export function maxFollowers(creators: CreatorMetricInput[]): number | null {
  const items = dedupeById(creators);
  if (items.length === 0) {
    return null;
  }

  return Math.max(
    ...items.map((creator) => Math.max(0, Number(creator.follower_count) || 0))
  );
}

export function categoryDistribution(
  creators: CreatorMetricInput[]
): Record<string, number> {
  const distribution: Record<string, number> = {};

  for (const creator of dedupeById(creators)) {
    const key = creator.category ?? "uncategorized";
    distribution[key] = (distribution[key] ?? 0) + 1;
  }

  return distribution;
}

export function platformDistribution(
  creators: CreatorMetricInput[]
): Record<string, number> {
  const distribution: Record<string, number> = {};

  for (const creator of dedupeById(creators)) {
    const key = creator.platform ?? "unknown";
    distribution[key] = (distribution[key] ?? 0) + 1;
  }

  return distribution;
}

export function calculateCreatorListStats(
  creators: CreatorMetricInput[]
): CreatorListStats {
  const items = dedupeById(creators);
  const platforms = platformDistribution(items);
  const tiktokCount = platforms.tiktok ?? 0;

  return {
    creatorCount: creatorCount(items),
    totalFollowers: totalFollowers(items),
    averageFollowers: averageFollowers(items),
    medianFollowers: medianFollowers(items),
    minFollowers: minFollowers(items),
    maxFollowers: maxFollowers(items),
    categoryDistribution: categoryDistribution(items),
    platformDistribution: platforms as Record<CreatorPlatform | string, number>,
    tiktokCount,
  };
}

export function normalizeSelectedCreatorIds(
  ids: string[],
  max = CREATOR_SELECTION_MAX
): string[] {
  const unique: string[] = [];
  const seen = new Set<string>();

  for (const id of ids) {
    if (typeof id !== "string" || seen.has(id)) {
      continue;
    }
    seen.add(id);
    unique.push(id);
    if (unique.length >= max) {
      break;
    }
  }

  return unique;
}

export function mergeSelection(
  current: string[],
  visibleIds: string[],
  checked: boolean,
  max = CREATOR_SELECTION_MAX
): { ids: string[]; limited: boolean } {
  const set = new Set(current);

  if (checked) {
    let limited = false;
    for (const id of visibleIds) {
      if (set.has(id)) {
        continue;
      }
      if (set.size >= max) {
        limited = true;
        break;
      }
      set.add(id);
    }
    return { ids: Array.from(set), limited };
  }

  for (const id of visibleIds) {
    set.delete(id);
  }

  return { ids: Array.from(set), limited: false };
}

export function slugifyListName(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return slug.length > 0 ? slug : "liste";
}

export function buildCreatorListCsvFilename(name: string): string {
  return `befluencer-creator-listesi-${slugifyListName(name)}.csv`;
}

/** Escape a CSV field; prefix formula-like values to prevent spreadsheet injection. */
export function escapeCsvField(value: string | number | null | undefined): string {
  let text = value == null ? "" : String(value);

  if (/^[=+\-@]/.test(text)) {
    text = `'${text}`;
  }

  if (/[;"\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

/**
 * Builds UTF-8 BOM + semicolon-delimited CSV (Excel-friendly TR locale).
 * Public columns only — never include IDs, fees, or internal notes.
 */
export function buildCreatorListCsv(rows: Array<{
  position: number;
  username: string;
  displayName: string | null;
  platform: string;
  category: string | null;
  followerCount: number;
  profileUrl: string | null;
  publicNote: string | null;
}>): string {
  const header = [
    "Sıra",
    "Kullanıcı Adı",
    "Görünen Ad",
    "Platform",
    "Kategori",
    "Takipçi",
    "Profil URL",
    "Public Not",
  ];

  const lines = [
    header.map(escapeCsvField).join(";"),
    ...rows.map((row) =>
      [
        row.position,
        row.username,
        row.displayName,
        row.platform,
        row.category,
        row.followerCount,
        row.profileUrl,
        row.publicNote,
      ]
        .map(escapeCsvField)
        .join(";")
    ),
  ];

  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export const PUBLIC_CREATOR_LIST_FIELDS = [
  "username",
  "display_name",
  "profile_url",
  "avatar_url",
  "platform",
  "category",
  "follower_count",
  "public_note",
] as const;

export const FORBIDDEN_PUBLIC_FIELDS = [
  "internal_notes",
  "internal_note",
  "fee",
  "fees",
  "token_hash",
  "sync_status",
  "last_synced_at",
  "email",
  "phone",
  "contact",
] as const;

export function assertNoPrivatePublicLeakage(payload: unknown): void {
  const json = JSON.stringify(payload);

  for (const field of FORBIDDEN_PUBLIC_FIELDS) {
    if (json.includes(`"${field}"`)) {
      throw new Error(`private_field_leak:${field}`);
    }
  }
}
