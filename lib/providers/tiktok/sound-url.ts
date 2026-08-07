import { TikTokProviderError } from "@/lib/providers/tiktok/errors";

const APPROVED_SOUND_HOSTS = new Set([
  "www.tiktok.com",
  "tiktok.com",
  "m.tiktok.com",
  "vm.tiktok.com",
  "vt.tiktok.com",
]);

/** Trailing numeric id on `/music/<slug>-<id>` paths. */
const MUSIC_ID_FROM_SLUG = /(\d{8,})$/;

const TRACKING_PARAMS = new Set([
  "is_from_webapp",
  "sender_device",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "refer",
  "referer",
  "share_app_id",
  "share_link_id",
  "share_item_id",
  "timestamp",
  "user_id",
  "sec_uid",
  "_d",
  "u_code",
  "preview_pb",
  "language",
]);

export type NormalizedTikTokSoundUrl = {
  normalizedUrl: string;
  soundId: string | null;
  isShortUrl: boolean;
  canonicalPath: string;
};

function looksLikeProtocolRelative(value: string): boolean {
  return value.startsWith("//");
}

function isApprovedHost(hostname: string): boolean {
  return APPROVED_SOUND_HOSTS.has(hostname.toLowerCase());
}

function stripTrackingParams(url: URL): void {
  const keys = [...url.searchParams.keys()];
  for (const key of keys) {
    if (TRACKING_PARAMS.has(key.toLowerCase())) {
      url.searchParams.delete(key);
    }
  }
}

function pathSegments(pathname: string): string[] {
  return pathname.split("/").filter(Boolean);
}

function classifyRejectedPath(segments: string[]): TikTokProviderError["code"] {
  const lower = segments.map((segment) => segment.toLowerCase());

  if (lower.includes("video")) {
    return "unsupported_sound_url";
  }

  // `/@user` profile paths are not music pages.
  if (segments.some((segment) => segment.startsWith("@"))) {
    return "unsupported_sound_url";
  }

  return "invalid_sound_url";
}

/**
 * Extracts a numeric TikTok music id from a music path slug when present.
 */
export function parseTikTokSoundId(input: string): string | null {
  const trimmed = input.trim();

  if (!trimmed) {
    return null;
  }

  if (/^\d{8,}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    const segments = pathSegments(parsed.pathname);
    const musicIndex = segments.findIndex(
      (segment) => segment.toLowerCase() === "music"
    );

    if (musicIndex >= 0 && segments[musicIndex + 1]) {
      const slug = decodeURIComponent(segments[musicIndex + 1]);
      const match = slug.match(MUSIC_ID_FROM_SLUG);
      return match?.[1] ?? null;
    }
  } catch {
    const match = trimmed.match(MUSIC_ID_FROM_SLUG);
    return match?.[1] ?? null;
  }

  return null;
}

export function isTikTokSoundUrl(input: string): boolean {
  try {
    normalizeTikTokSoundUrl(input);
    return true;
  } catch {
    return false;
  }
}

/**
 * Normalizes a TikTok music/sound URL for provider input.
 *
 * Accepts `/music/<slug>-<id>` pages and short `vm`/`vt` links (resolved only
 * inside the trusted Apify actor). Rejects video URLs, profile URLs, unsafe
 * schemes and arbitrary hosts.
 */
export function normalizeTikTokSoundUrl(input: string): NormalizedTikTokSoundUrl {
  const trimmed = input.trim();

  if (!trimmed) {
    throw new TikTokProviderError("invalid_sound_url");
  }

  if (looksLikeProtocolRelative(trimmed)) {
    throw new TikTokProviderError("invalid_sound_url");
  }

  let parsed: URL;

  try {
    parsed = new URL(trimmed);
  } catch {
    throw new TikTokProviderError("invalid_sound_url");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new TikTokProviderError("invalid_sound_url");
  }

  const hostname = parsed.hostname.toLowerCase();

  if (!isApprovedHost(hostname)) {
    throw new TikTokProviderError("invalid_sound_url");
  }

  const isShortUrl = hostname === "vm.tiktok.com" || hostname === "vt.tiktok.com";
  const segments = pathSegments(parsed.pathname);

  if (!isShortUrl) {
    const musicIndex = segments.findIndex(
      (segment) => segment.toLowerCase() === "music"
    );

    if (musicIndex < 0 || !segments[musicIndex + 1]) {
      throw new TikTokProviderError(classifyRejectedPath(segments));
    }

    // Keep only `/music/<slug>` — drop trailing junk segments.
    parsed.pathname = `/music/${segments[musicIndex + 1]}`;
  } else {
    // Short links: `/t/<code>` (and rare bare codes). Never treat as video.
    if (segments.includes("video") || segments.some((s) => s.startsWith("@"))) {
      throw new TikTokProviderError("unsupported_sound_url");
    }
  }

  stripTrackingParams(parsed);
  parsed.hash = "";
  // Prefer https + www for canonical long-form music URLs.
  if (!isShortUrl) {
    parsed.protocol = "https:";
    parsed.hostname = "www.tiktok.com";
  }

  const normalizedUrl = parsed.toString().replace(/\/+$/, "");
  const soundId = parseTikTokSoundId(normalizedUrl);

  return {
    normalizedUrl,
    soundId,
    isShortUrl,
    canonicalPath: parsed.pathname.replace(/\/+$/, ""),
  };
}

export function assertApprovedTikTokSoundUrl(
  input: string
): NormalizedTikTokSoundUrl {
  return normalizeTikTokSoundUrl(input);
}
