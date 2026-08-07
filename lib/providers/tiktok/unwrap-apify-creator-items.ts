type UnknownRecord = Record<string, unknown>;

/** Known safe one-level wrapper keys used by Clockworks / Apify TikTok actors. */
const WRAPPER_KEYS = ["profiles", "data", "items", "results"] as const;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function looksLikeCreatorProfileRow(value: UnknownRecord): boolean {
  return (
    value.name !== undefined ||
    value.uniqueId !== undefined ||
    value.username !== undefined ||
    value.fans !== undefined ||
    value.followerCount !== undefined ||
    isRecord(value.authorMeta) ||
    isRecord(value.authorStats)
  );
}

/**
 * Flattens Apify creator dataset payloads into candidate profile/video rows.
 *
 * Supports:
 * - direct dataset arrays
 * - items wrapping `profiles` / `data` / `items` / `results` arrays
 * - a single direct profile object
 * - existing video-row author shapes (passed through unchanged)
 *
 * Does not recursively walk arbitrary objects.
 */
export function unwrapApifyCreatorItems(input: unknown): unknown[] {
  if (input === null || input === undefined) {
    return [];
  }

  if (Array.isArray(input)) {
    const flattened: unknown[] = [];

    for (const entry of input) {
      flattened.push(...unwrapOneLevel(entry));
    }

    return flattened;
  }

  if (isRecord(input)) {
    return unwrapOneLevel(input);
  }

  return [];
}

function unwrapOneLevel(entry: unknown): unknown[] {
  if (entry === null || entry === undefined) {
    return [];
  }

  if (!isRecord(entry)) {
    return [entry];
  }

  for (const key of WRAPPER_KEYS) {
    const nested = entry[key];
    if (Array.isArray(nested) && nested.length > 0) {
      return nested;
    }
  }

  // Direct profile object or video-author row.
  return [entry];
}

/**
 * Clockworks `clockworks~tiktok-scraper` stores loaded profile info in the run
 * KV record `AUTHOR_CACHE` as `{ [username]: profile }` even when zero videos
 * are pushed to the default dataset.
 */
export function itemsFromApifyAuthorCache(cache: unknown): unknown[] {
  if (!isRecord(cache)) {
    return [];
  }

  const items: unknown[] = [];

  for (const value of Object.values(cache)) {
    if (isRecord(value) && looksLikeCreatorProfileRow(value)) {
      items.push(value);
    }
  }

  return items;
}

export type ApifyRunDatasetRef = {
  runId: string | null;
  status: string | null;
  datasetId: string | null;
  keyValueStoreId: string | null;
};

/**
 * Reads run id / status / defaultDatasetId / defaultKeyValueStoreId from an
 * Apify runs API payload. Accepts both `{ data: { ... } }` and flat run objects.
 */
export function readApifyRunDatasetRef(payload: unknown): ApifyRunDatasetRef {
  const root = isRecord(payload) ? payload : null;
  const run = root && isRecord(root.data) ? root.data : root;

  if (!run) {
    return {
      runId: null,
      status: null,
      datasetId: null,
      keyValueStoreId: null,
    };
  }

  const runId =
    typeof run.id === "string" && run.id.trim().length > 0 ? run.id : null;
  const status =
    typeof run.status === "string" && run.status.trim().length > 0
      ? run.status
      : null;
  const datasetId =
    typeof run.defaultDatasetId === "string" &&
    run.defaultDatasetId.trim().length > 0
      ? run.defaultDatasetId
      : null;
  const keyValueStoreId =
    typeof run.defaultKeyValueStoreId === "string" &&
    run.defaultKeyValueStoreId.trim().length > 0
      ? run.defaultKeyValueStoreId
      : null;

  return { runId, status, datasetId, keyValueStoreId };
}

export type ApifyCreatorCandidateType =
  | "empty"
  | "direct_profile"
  | "video_author"
  | "wrapped_profiles"
  | "wrapped_data"
  | "wrapped_items"
  | "wrapped_results"
  | "author_cache_map"
  | "unsupported";

export function detectApifyCreatorCandidateType(
  items: unknown[]
): ApifyCreatorCandidateType {
  if (items.length === 0) {
    return "empty";
  }

  const first = items[0];
  if (!isRecord(first)) {
    return "unsupported";
  }

  for (const key of WRAPPER_KEYS) {
    if (Array.isArray(first[key]) && (first[key] as unknown[]).length > 0) {
      if (key === "profiles") return "wrapped_profiles";
      if (key === "data") return "wrapped_data";
      if (key === "items") return "wrapped_items";
      return "wrapped_results";
    }
  }

  if (
    isRecord(first.authorMeta) ||
    first.webVideoUrl !== undefined ||
    first.diggCount !== undefined
  ) {
    return "video_author";
  }

  if (looksLikeCreatorProfileRow(first)) {
    return "direct_profile";
  }

  return "unsupported";
}

export function collectApifyItemShapeKeys(items: unknown[]): {
  topLevelKeys: string[];
  nestedKeys: string[];
} {
  const top = new Set<string>();
  const nested = new Set<string>();

  for (const item of items.slice(0, 5)) {
    if (!isRecord(item)) {
      continue;
    }

    for (const key of Object.keys(item).slice(0, 40)) {
      top.add(key);
      const value = item[key];
      if (isRecord(value)) {
        for (const nestedKey of Object.keys(value).slice(0, 20)) {
          nested.add(`${key}.${nestedKey}`);
        }
      } else if (Array.isArray(value) && value[0] && isRecord(value[0])) {
        nested.add(`${key}[]`);
        for (const nestedKey of Object.keys(value[0]).slice(0, 20)) {
          nested.add(`${key}[].${nestedKey}`);
        }
      }
    }
  }

  return {
    topLevelKeys: Array.from(top),
    nestedKeys: Array.from(nested),
  };
}

/** Development-only sanitized run diagnostics. Never logs payloads or tokens. */
export function logApifyCreatorRunDiagnostics(input: {
  status: string | null;
  datasetIdPresent: boolean;
  datasetItemCount: number;
  authorCacheItemCount: number;
  items: unknown[];
  source: "dataset" | "author_cache" | "empty";
}): void {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.NODE_TEST === "1"
  ) {
    return;
  }

  const shape = collectApifyItemShapeKeys(input.items);

  console.info("[tiktok-creator-sync:run]", {
    status: input.status,
    datasetIdPresent: input.datasetIdPresent,
    datasetItemCount: input.datasetItemCount,
    authorCacheItemCount: input.authorCacheItemCount,
    source: input.source,
    topLevelKeys: shape.topLevelKeys,
    nestedKeys: shape.nestedKeys,
    detectedCandidateType: detectApifyCreatorCandidateType(input.items),
  });
}
