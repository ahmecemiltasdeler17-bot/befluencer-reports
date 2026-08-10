import type { Creator, Platform } from "@/lib/types";

export type NormalizedShowcaseCreator = {
  id: string;
  avatar: string;
  name: string;
  handle?: string;
  platform?: Platform;
  profileUrl?: string | null;
};

/**
 * Guarantees a real creator-object array.
 *
 * CRITICAL: never use `Array.from(value)` / `[...value]` on non-arrays.
 * Spreading a string yields one entry per character ("SIMON" → S,I,M,O,N),
 * which then renders as fake avatar items in the report showcase.
 */
export function normalizeCreatorList(value: unknown): Creator[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const result: Creator[] = [];

  for (const entry of value) {
    if (!isCreatorObject(entry)) {
      continue;
    }
    result.push(entry);
  }

  return result;
}

function isCreatorObject(value: unknown): value is Creator {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && record.id.trim().length > 0;
}

function isPlatform(value: unknown): value is Platform {
  return value === "tiktok" || value === "instagram" || value === "youtube";
}

/**
 * Showcase input may already be showcase-shaped or raw Creator[].
 * Accept only plain objects with a non-empty string id — never string chars.
 */
export function normalizeShowcaseCreators(
  value: unknown
): NormalizedShowcaseCreator[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const result: NormalizedShowcaseCreator[] = [];

  for (const entry of value) {
    if (entry === null || typeof entry !== "object") {
      continue;
    }

    const record = entry as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id.trim() : "";
    if (!id) {
      continue;
    }

    const nameFromDisplay =
      typeof record.name === "string"
        ? record.name
        : typeof record.displayName === "string"
          ? record.displayName
          : "";
    const handle =
      typeof record.handle === "string" ? record.handle : undefined;

    result.push({
      id,
      avatar: typeof record.avatar === "string" ? record.avatar : "",
      name:
        nameFromDisplay.trim() ||
        (handle ? handle.replace(/^@+/, "") : ""),
      handle,
      platform: isPlatform(record.platform) ? record.platform : undefined,
      profileUrl:
        record.profileUrl === null || typeof record.profileUrl === "string"
          ? (record.profileUrl as string | null)
          : null,
    });
  }

  return result;
}
