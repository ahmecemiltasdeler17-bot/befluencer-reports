import "server-only";

import { VIDEO_IMPORT_PREVIEW_CACHE_TTL_MS } from "@/lib/providers/tiktok/sync-policy";
import type { TikTokVideoBatchItemResult } from "@/lib/providers/tiktok/types";

type CacheEntry = {
  expiresAt: number;
  result: TikTokVideoBatchItemResult;
};

/**
 * Short-lived server memory cache for video-import preview scrapes.
 * Keyed only by normalized TikTok URL. Never used for report snapshots.
 */
const cache = new Map<string, CacheEntry>();

export function getVideoImportPreviewCache(
  normalizedUrl: string
): TikTokVideoBatchItemResult | null {
  const entry = cache.get(normalizedUrl);
  if (!entry) {
    return null;
  }
  if (Date.now() > entry.expiresAt) {
    cache.delete(normalizedUrl);
    return null;
  }
  return entry.result;
}

export function setVideoImportPreviewCache(
  normalizedUrl: string,
  result: TikTokVideoBatchItemResult,
  ttlMs: number = VIDEO_IMPORT_PREVIEW_CACHE_TTL_MS
): void {
  cache.set(normalizedUrl, {
    expiresAt: Date.now() + ttlMs,
    result,
  });
}

/** Test helper — clears in-memory preview cache. */
export function clearVideoImportPreviewCacheForTests(): void {
  cache.clear();
}
