import {
  VIDEO_IMPORT_MAX_URLS,
  VIDEO_IMPORT_MESSAGES,
} from "@/features/video-import/constants";
import type { VideoImportParsedUrl } from "@/features/video-import/types";
import { normalizeTikTokVideoUrl } from "@/lib/providers/tiktok/url";

export type ParseVideoImportUrlsResult = {
  urls: VideoImportParsedUrl[];
  invalid: Array<{ originalUrl: string; message: string }>;
  skippedEmptyLines: number;
  dedupedCount: number;
  truncated: boolean;
  nonEmptyLineCount: number;
};

/**
 * Splits pasted text into TikTok video URLs: trim, drop empties, normalize,
 * dedupe by normalized URL, enforce max batch size on non-empty lines.
 */
export function parseVideoImportUrls(text: string): ParseVideoImportUrlsResult {
  const lines = text.split(/\r?\n/);
  let skippedEmptyLines = 0;
  const nonEmpty: string[] = [];

  for (const line of lines) {
    const originalUrl = line.trim();
    if (!originalUrl) {
      skippedEmptyLines += 1;
      continue;
    }
    nonEmpty.push(originalUrl);
  }

  if (nonEmpty.length > VIDEO_IMPORT_MAX_URLS) {
    return {
      urls: [],
      invalid: [],
      skippedEmptyLines,
      dedupedCount: 0,
      truncated: true,
      nonEmptyLineCount: nonEmpty.length,
    };
  }

  const seen = new Set<string>();
  const urls: VideoImportParsedUrl[] = [];
  const invalid: Array<{ originalUrl: string; message: string }> = [];
  let dedupedCount = 0;

  for (const originalUrl of nonEmpty) {
    try {
      const normalized = normalizeTikTokVideoUrl(originalUrl);
      if (seen.has(normalized.normalizedUrl)) {
        dedupedCount += 1;
        continue;
      }
      seen.add(normalized.normalizedUrl);
      urls.push({
        originalUrl,
        normalizedUrl: normalized.normalizedUrl,
        platformVideoId: normalized.platformVideoId,
        isShortUrl: normalized.isShortUrl,
      });
    } catch {
      invalid.push({
        originalUrl,
        message: VIDEO_IMPORT_MESSAGES.invalid_url,
      });
    }
  }

  return {
    urls,
    invalid,
    skippedEmptyLines,
    dedupedCount,
    truncated: false,
    nonEmptyLineCount: nonEmpty.length,
  };
}

export function createVideoImportRowKey(
  normalizedUrl: string,
  index: number
): string {
  return `${index}:${normalizedUrl}`;
}
