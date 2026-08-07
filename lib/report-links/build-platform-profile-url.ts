import {
  normalizeSocialUrl,
  normalizeUsername,
} from "@/lib/report-links/normalize-social-url";
import type {
  Platform,
  ResolvedProfileUrl,
  SafeExternalUrl,
} from "@/lib/report-links/types";

const PROFILE_URL_BUILDERS: Record<Platform, (username: string) => string> = {
  tiktok: (username) => `https://www.tiktok.com/@${username}`,
  instagram: (username) => `https://www.instagram.com/${username}`,
  youtube: (username) => `https://www.youtube.com/@${username}`,
};

/**
 * Builds a deterministic profile URL from platform + username.
 * Returns null when the username cannot be expressed safely in a URL.
 *
 * This is a display-time fallback only; it is never written back to the
 * database during report rendering.
 */
export function buildPlatformProfileUrl(
  platform: Platform | null | undefined,
  username: unknown
): SafeExternalUrl | null {
  if (!platform || !(platform in PROFILE_URL_BUILDERS)) {
    return null;
  }

  const normalizedUsername = normalizeUsername(username);

  if (!normalizedUsername) {
    return null;
  }

  const built = PROFILE_URL_BUILDERS[platform](
    encodeURIComponent(normalizedUsername)
  );

  // Round-trip through the validator so a built URL is held to the same
  // standard as a stored one.
  return normalizeSocialUrl(built, platform);
}

/**
 * Prefers a stored profile URL, falling back to a deterministic one built from
 * platform + username. Reports the source so management screens can flag
 * records that rely on the fallback.
 */
export function resolveCreatorProfileUrl(input: {
  profileUrl?: string | null;
  platform?: Platform | null;
  username?: string | null;
}): ResolvedProfileUrl {
  const stored = normalizeSocialUrl(input.profileUrl, input.platform ?? undefined);

  if (stored) {
    return { href: stored, source: "stored" };
  }

  const derived = buildPlatformProfileUrl(input.platform, input.username);

  if (derived) {
    return { href: derived, source: "derived" };
  }

  return { href: null, source: "none" };
}
