import type { TikTokVideoMetrics } from "@/lib/providers/tiktok/types";
import { TikTokProviderError } from "@/lib/providers/tiktok/errors";
import {
  logThumbnailDiagnostics,
  selectVideoThumbnail,
} from "@/lib/providers/tiktok/select-video-thumbnail";
import { normalizeTikTokVideoUrl } from "@/lib/providers/tiktok/url";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function readNonNegativeInt(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value.replace(/,/g, ""), 10)
        : Number.NaN;

  if (!Number.isFinite(parsed)) {
    return null;
  }

  const rounded = Math.trunc(parsed);
  return rounded < 0 ? 0 : rounded;
}

function readRequiredMetric(
  candidates: unknown[],
  label: string
): number {
  for (const candidate of candidates) {
    const value = readNonNegativeInt(candidate);
    if (value !== null) {
      return value;
    }
  }

  throw new TikTokProviderError(
    "malformed_result",
    `TikTok veri sağlayıcı yanıtında ${label} bulunamadı.`
  );
}

function readOptionalMetric(candidates: unknown[]): number | null {
  for (const candidate of candidates) {
    const value = readNonNegativeInt(candidate);
    if (value !== null) {
      return value;
    }
  }

  return null;
}

function readPublishedAt(item: UnknownRecord): string | null {
  const iso = readString(item.createTimeISO);
  if (iso) {
    const date = new Date(iso);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  const createTime = readNonNegativeInt(item.createTime);
  if (createTime !== null && createTime > 0) {
    const seconds = createTime > 1_000_000_000_000 ? createTime / 1000 : createTime;
    return new Date(seconds * 1000).toISOString();
  }

  return null;
}

function isUnavailableItem(item: UnknownRecord): boolean {
  const errorText = [
    readString(item.error),
    readString(item.message),
    readString(item.status),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (!errorText) {
    return false;
  }

  return (
    errorText.includes("private") ||
    errorText.includes("unavailable") ||
    errorText.includes("deleted") ||
    errorText.includes("removed") ||
    errorText.includes("not found") ||
    errorText.includes("404")
  );
}

/**
 * Normalizes Apify actor dataset items into TikTokVideoMetrics.
 * Saves default to 0 when the provider does not expose collect/favorite counts.
 */
export function parseApifyTikTokItem(
  item: unknown,
  fallbackUrl: string
): TikTokVideoMetrics {
  if (!isRecord(item)) {
    throw new TikTokProviderError("malformed_result");
  }

  if (isUnavailableItem(item)) {
    throw new TikTokProviderError("unavailable_video");
  }

  const authorMeta = isRecord(item.authorMeta) ? item.authorMeta : null;
  const author = isRecord(item.author) ? item.author : null;
  const authorStats = isRecord(item.authorStats) ? item.authorStats : null;

  const platformVideoId =
    readString(item.id) ??
    readString(item.videoId) ??
    readString(item.awemeId);

  const videoUrl =
    readString(item.webVideoUrl) ??
    readString(item.url) ??
    fallbackUrl;

  const views = readRequiredMetric(
    [item.playCount, item.views, item.viewCount],
    "görüntülenme"
  );
  const likes = readRequiredMetric(
    [item.diggCount, item.likes, item.likeCount],
    "beğeni"
  );
  const comments = readRequiredMetric(
    [item.commentCount, item.comments],
    "yorum"
  );
  const shares = readRequiredMetric(
    [item.shareCount, item.shares],
    "paylaşım"
  );

  const saves =
    readOptionalMetric([
      item.collectCount,
      item.saves,
      item.favoritesCount,
    ]) ?? 0;

  const thumbnail = selectVideoThumbnail(item);
  let thumbnailHost: string | null = null;
  if (thumbnail.url) {
    try {
      thumbnailHost = new URL(thumbnail.url).host;
    } catch {
      thumbnailHost = null;
    }
  }

  logThumbnailDiagnostics({
    field: thumbnail.field,
    validated: thumbnail.validated,
    preservedExisting: false,
    providerReturnedNone: thumbnail.url === null,
    host: thumbnailHost,
  });

  return {
    platformVideoId,
    videoUrl,
    creatorUsername:
      readString(authorMeta?.name) ??
      readString(author?.uniqueId) ??
      readString(item.authorName),
    creatorDisplayName:
      readString(authorMeta?.nickName) ??
      readString(author?.nickname) ??
      readString(item.authorNickname),
    creatorAvatarUrl:
      readString(authorMeta?.avatar) ??
      readString(author?.avatarThumb) ??
      readString(item.authorAvatar),
    creatorFollowerCount: readOptionalMetric([
      authorMeta?.fans,
      authorStats?.followerCount,
      item.followerCount,
    ]),
    caption: readString(item.text) ?? readString(item.caption),
    thumbnailUrl: thumbnail.url,
    publishedAt: readPublishedAt(item),
    views,
    likes,
    comments,
    shares,
    saves,
  };
}

export function parseApifyTikTokDataset(
  items: unknown[],
  fallbackUrl: string
): TikTokVideoMetrics {
  if (items.length === 0) {
    throw new TikTokProviderError("empty_result");
  }

  return parseApifyTikTokItem(items[0], fallbackUrl);
}

export type VideoBatchRequest = {
  /** Normalized TikTok video URL (request key). */
  normalizedUrl: string;
  platformVideoId: string | null;
};

export type VideoBatchItemResult =
  | { status: "ok"; metrics: TikTokVideoMetrics }
  | { status: "error"; error: TikTokProviderError };

function extractItemVideoId(item: UnknownRecord): string | null {
  return (
    readString(item.id) ??
    readString(item.videoId) ??
    readString(item.awemeId)
  );
}

function extractItemVideoUrl(item: UnknownRecord): string | null {
  return readString(item.webVideoUrl) ?? readString(item.url);
}

function normalizeUrlKey(url: string): string | null {
  try {
    return normalizeTikTokVideoUrl(url).normalizedUrl;
  } catch {
    return null;
  }
}

/**
 * Maps a multi-URL actor dataset back to requested videos.
 * Result order is never trusted. Duplicate provider rows are collapsed by
 * platform_video_id (first wins). Missing URLs become empty_result errors —
 * callers may upgrade to login_required_content after log inspection.
 */
export function parseApifyTikTokDatasetBatch(
  items: unknown[],
  requests: VideoBatchRequest[]
): Map<string, VideoBatchItemResult> {
  const byId = new Map<string, UnknownRecord>();
  const byUrl = new Map<string, UnknownRecord>();

  for (const raw of items) {
    if (!isRecord(raw)) {
      continue;
    }
    const id = extractItemVideoId(raw);
    if (id && !byId.has(id)) {
      byId.set(id, raw);
    }
    const url = extractItemVideoUrl(raw);
    if (url) {
      const key = normalizeUrlKey(url) ?? url.trim();
      if (key && !byUrl.has(key)) {
        byUrl.set(key, raw);
      }
    }
  }

  const out = new Map<string, VideoBatchItemResult>();

  for (const request of requests) {
    const key = request.normalizedUrl;
    let matched: UnknownRecord | null = null;

    if (request.platformVideoId && byId.has(request.platformVideoId)) {
      matched = byId.get(request.platformVideoId) ?? null;
    }

    if (!matched && byUrl.has(key)) {
      matched = byUrl.get(key) ?? null;
    }

    if (!matched) {
      out.set(key, {
        status: "error",
        error: new TikTokProviderError("empty_result"),
      });
      continue;
    }

    try {
      const metrics = parseApifyTikTokItem(matched, key);
      // Strict identity: if both sides have platform ids, they must match.
      if (
        request.platformVideoId &&
        metrics.platformVideoId &&
        request.platformVideoId !== metrics.platformVideoId
      ) {
        out.set(key, {
          status: "error",
          error: new TikTokProviderError(
            "malformed_result",
            "Sağlayıcı farklı bir TikTok videosu döndürdü."
          ),
        });
        continue;
      }
      out.set(key, { status: "ok", metrics });
    } catch (error) {
      out.set(key, {
        status: "error",
        error:
          error instanceof TikTokProviderError
            ? error
            : new TikTokProviderError("malformed_result"),
      });
    }
  }

  return out;
}
