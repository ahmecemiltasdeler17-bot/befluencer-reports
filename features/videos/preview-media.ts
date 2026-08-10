/** Bucket id for manually uploaded featured/report preview clips. */
export const FEATURED_PREVIEW_BUCKET = "featured-video-previews";

/** Practical upper bound for short muted preview clips. */
export const PREVIEW_MAX_BYTES = 30 * 1024 * 1024;

/**
 * Next.js default Server Action body limit is 1MB. Multi-MB MP4s must NOT be
 * proxied through Server Actions — upload directly to Supabase Storage.
 */
export const NEXT_SERVER_ACTION_DEFAULT_BODY_LIMIT_BYTES = 1 * 1024 * 1024;

export const PREVIEW_ALLOWED_MIME_TYPES = [
  "video/mp4",
  "video/webm",
] as const;

export type PreviewMediaType = (typeof PREVIEW_ALLOWED_MIME_TYPES)[number];

export type PreviewValidationResult =
  | { ok: true; mime: PreviewMediaType; extension: "mp4" | "webm" }
  | { ok: false; error: string };

export function isPreviewMediaType(value: string): value is PreviewMediaType {
  return (PREVIEW_ALLOWED_MIME_TYPES as readonly string[]).includes(value);
}

export function isHttpPreviewUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function validatePreviewUpload(file: File | null): PreviewValidationResult {
  if (!file) {
    return { ok: false, error: "Lütfen bir video dosyası seçin." };
  }

  if (file.size <= 0) {
    return { ok: false, error: "Dosya boş görünüyor." };
  }

  if (file.size > PREVIEW_MAX_BYTES) {
    return {
      ok: false,
      error: "Video 30 MB sınırını aşıyor.",
    };
  }

  let mime = file.type.trim().toLowerCase();
  if (!mime) {
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".mp4")) mime = "video/mp4";
    if (lower.endsWith(".webm")) mime = "video/webm";
  }

  if (!isPreviewMediaType(mime)) {
    return {
      ok: false,
      error: "Yalnızca MP4 veya WebM yükleyebilirsiniz.",
    };
  }

  return {
    ok: true,
    mime,
    extension: mime === "video/webm" ? "webm" : "mp4",
  };
}

/**
 * Object key uses random UUID — never trust the original filename.
 * Path: {campaignId}/{videoId}/{uuid}.{ext}
 */
export function buildPreviewObjectPath(input: {
  campaignId: string;
  videoId: string;
  uuid: string;
  extension: "mp4" | "webm";
}): string {
  return `${input.campaignId}/${input.videoId}/${input.uuid}.${input.extension}`;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Ensures a storage object path is owned by the given campaign/video and uses
 * a UUID filename inside the featured-video-previews bucket convention.
 */
export function isOwnedPreviewObjectPath(
  campaignId: string,
  videoId: string,
  objectPath: string
): boolean {
  if (!campaignId || !videoId || !objectPath) return false;
  if (objectPath.includes("..") || objectPath.startsWith("/")) return false;

  const expectedPrefix = `${campaignId}/${videoId}/`;
  if (!objectPath.startsWith(expectedPrefix)) return false;

  const filename = objectPath.slice(expectedPrefix.length);
  const match = /^([0-9a-f-]{36})\.(mp4|webm)$/i.exec(filename);
  if (!match) return false;
  return UUID_RE.test(match[1]);
}

/** Best-effort extract of the Storage object path from a public URL. */
export function extractPreviewObjectPath(
  publicUrl: string | null | undefined
): string | null {
  if (!isHttpPreviewUrl(publicUrl)) return null;
  const marker = `/object/public/${FEATURED_PREVIEW_BUCKET}/`;
  const index = publicUrl.indexOf(marker);
  if (index === -1) return null;
  const path = publicUrl.slice(index + marker.length);
  return path.length > 0 ? decodeURIComponent(path) : null;
}

/**
 * Reject arbitrary external URLs. Only public URLs for our preview bucket
 * whose object path is owned by the campaign/video are accepted.
 */
export function isOwnedPreviewPublicUrl(
  campaignId: string,
  videoId: string,
  publicUrl: string
): boolean {
  const path = extractPreviewObjectPath(publicUrl);
  if (!path) return false;
  return isOwnedPreviewObjectPath(campaignId, videoId, path);
}
