type UnknownRecord = Record<string, unknown>;

export type ThumbnailCandidateField =
  | "videoMeta.originalCover"
  | "video.originalCover"
  | "videoMeta.originCover"
  | "video.originCover"
  | "originalCover"
  | "originCover"
  | "videoMeta.coverLarge"
  | "video.coverLarge"
  | "coverLarge"
  | "videoMeta.coverUrl"
  | "video.coverUrl"
  | "videoMeta.cover"
  | "video.cover"
  | "coverUrl"
  | "cover"
  | "imageUrl"
  | "thumbnailUrl"
  | "thumbnail"
  | "videoMeta.coverMedium"
  | "video.coverMedium"
  | "coverMedium"
  | "videoMeta.dynamicCover"
  | "video.dynamicCover"
  | "dynamicCover";

export type ThumbnailSelection = {
  url: string | null;
  field: ThumbnailCandidateField | null;
  validated: boolean;
};

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
}

/**
 * Accepts absolute http(s) image URLs only.
 * Preserves CDN query strings. Rejects data/blob/file/javascript and relatives.
 */
export function isValidThumbnailUrl(value: string | null | undefined): value is string {
  if (!value || typeof value !== "string") {
    return false;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return false;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return false;
  }

  if (url.username || url.password) {
    return false;
  }

  return true;
}

function collectRejectedUrls(item: UnknownRecord): Set<string> {
  const rejected = new Set<string>();
  const authorMeta = isRecord(item.authorMeta) ? item.authorMeta : null;
  const author = isRecord(item.author) ? item.author : null;
  const musicMeta = isRecord(item.musicMeta) ? item.musicMeta : null;
  const music = isRecord(item.music) ? item.music : null;

  const avatarCandidates = [
    authorMeta?.avatar,
    authorMeta?.avatarLarger,
    author?.avatarThumb,
    author?.avatarMedium,
    author?.avatarLarger,
    item.authorAvatar,
  ];

  const musicCoverCandidates = [
    musicMeta?.coverMedium,
    musicMeta?.coverLarge,
    musicMeta?.coverThumb,
    musicMeta?.coverUrl,
    music?.coverMedium,
    music?.coverLarge,
    music?.cover,
    item.musicCover,
  ];

  for (const candidate of [...avatarCandidates, ...musicCoverCandidates]) {
    const value = readString(candidate);
    if (value && isValidThumbnailUrl(value)) {
      rejected.add(value);
    }
  }

  return rejected;
}

type Candidate = { field: ThumbnailCandidateField; value: unknown };

/**
 * Field precedence:
 * 1. Stable / original cover
 * 2. Large cover
 * 3. Standard cover / thumbnail aliases
 * 4. Medium cover
 * 5. Dynamic cover (last real-media option)
 */
function collectCandidates(item: UnknownRecord): Candidate[] {
  const videoMeta = isRecord(item.videoMeta) ? item.videoMeta : null;
  const video = isRecord(item.video) ? item.video : null;

  return [
    { field: "videoMeta.originalCover", value: videoMeta?.originalCover },
    { field: "video.originalCover", value: video?.originalCover },
    { field: "videoMeta.originCover", value: videoMeta?.originCover },
    { field: "video.originCover", value: video?.originCover },
    { field: "originalCover", value: item.originalCover },
    { field: "originCover", value: item.originCover },
    { field: "videoMeta.coverLarge", value: videoMeta?.coverLarge },
    { field: "video.coverLarge", value: video?.coverLarge },
    { field: "coverLarge", value: item.coverLarge },
    { field: "videoMeta.coverUrl", value: videoMeta?.coverUrl },
    { field: "video.coverUrl", value: video?.coverUrl },
    { field: "videoMeta.cover", value: videoMeta?.cover },
    { field: "video.cover", value: video?.cover },
    { field: "coverUrl", value: item.coverUrl },
    { field: "cover", value: item.cover },
    { field: "imageUrl", value: item.imageUrl },
    { field: "thumbnailUrl", value: item.thumbnailUrl },
    { field: "thumbnail", value: item.thumbnail },
    { field: "videoMeta.coverMedium", value: videoMeta?.coverMedium },
    { field: "video.coverMedium", value: video?.coverMedium },
    { field: "coverMedium", value: item.coverMedium },
    { field: "videoMeta.dynamicCover", value: videoMeta?.dynamicCover },
    { field: "video.dynamicCover", value: video?.dynamicCover },
    { field: "dynamicCover", value: item.dynamicCover },
  ];
}

/**
 * Chooses the best video cover URL from a Clockworks / Apify item.
 * Never returns avatar or music-cover URLs collected from the same item.
 */
export function selectVideoThumbnail(item: unknown): ThumbnailSelection {
  if (!isRecord(item)) {
    return { url: null, field: null, validated: false };
  }

  const rejected = collectRejectedUrls(item);

  for (const candidate of collectCandidates(item)) {
    const raw = readString(candidate.value);
    if (!raw) {
      continue;
    }

    if (!isValidThumbnailUrl(raw)) {
      continue;
    }

    if (rejected.has(raw)) {
      continue;
    }

    return { url: raw, field: candidate.field, validated: true };
  }

  return { url: null, field: null, validated: false };
}

/**
 * Sync write rule: only replace stored thumbnail with a newly validated URL.
 * Missing/invalid provider values preserve the existing non-empty thumbnail.
 */
export function resolveStoredThumbnailUrl(
  existing: string | null | undefined,
  incoming: string | null | undefined
): string | null {
  if (isValidThumbnailUrl(incoming)) {
    return incoming.trim();
  }

  if (isValidThumbnailUrl(existing)) {
    return existing.trim();
  }

  return null;
}

export function logThumbnailDiagnostics(input: {
  field: ThumbnailCandidateField | null;
  validated: boolean;
  preservedExisting: boolean;
  providerReturnedNone: boolean;
  host?: string | null;
}): void {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.info("[tiktok-thumbnail]", {
    field: input.field,
    validated: input.validated,
    preservedExisting: input.preservedExisting,
    providerReturnedNone: input.providerReturnedNone,
    host: input.host ?? null,
  });
}
