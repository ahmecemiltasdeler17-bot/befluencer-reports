import { TikTokProviderError } from "@/lib/providers/tiktok/errors";

/**
 * Hosts accepted as TikTok *profile* inputs. Deliberately narrower than the
 * video URL allowlist: `vm.tiktok.com` / `vt.tiktok.com` short links always
 * resolve to posts, never to profiles.
 */
const APPROVED_PROFILE_HOSTS = new Set([
  "www.tiktok.com",
  "tiktok.com",
  "m.tiktok.com",
]);

/** TikTok handles are ASCII word characters plus dot; 1–24 characters. */
const USERNAME_PATTERN = /^[A-Za-z0-9._]{1,24}$/;

export type NormalizedTikTokProfile = {
  username: string;
  profileUrl: string;
};

/**
 * Accepts `username`, `@username` or a TikTok profile URL and returns a bare
 * username. Throws `invalid_username` rather than returning null, because every
 * caller treats an unusable handle as a hard stop.
 */
export function normalizeTikTokUsername(input: unknown): string {
  if (typeof input !== "string") {
    throw new TikTokProviderError("invalid_username");
  }

  const trimmed = input.trim();

  if (trimmed.length === 0) {
    throw new TikTokProviderError("invalid_username");
  }

  const candidate = looksLikeUrl(trimmed)
    ? extractUsernameFromProfileUrl(trimmed)
    : trimmed.replace(/^@+/, "").trim();

  if (!USERNAME_PATTERN.test(candidate)) {
    throw new TikTokProviderError("invalid_username");
  }

  return candidate;
}

function looksLikeUrl(value: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith("//");
}

function extractUsernameFromProfileUrl(input: string): string {
  // Protocol-relative values inherit the page scheme and bypass host checks.
  if (input.startsWith("//")) {
    throw new TikTokProviderError("invalid_username");
  }

  let parsed: URL;

  try {
    parsed = new URL(input);
  } catch {
    throw new TikTokProviderError("invalid_username");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new TikTokProviderError("invalid_username");
  }

  if (!APPROVED_PROFILE_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new TikTokProviderError("invalid_username");
  }

  const segments = parsed.pathname.split("/").filter(Boolean);

  // A post URL is not a profile input: /@user/video/123 identifies content.
  if (segments.some((segment) => segment.toLowerCase() === "video")) {
    throw new TikTokProviderError("invalid_username");
  }

  const handleSegment = segments.find((segment) => segment.startsWith("@"));

  if (!handleSegment) {
    throw new TikTokProviderError("invalid_username");
  }

  return decodeURIComponent(handleSegment.slice(1)).trim();
}

/**
 * Builds the canonical profile URL. Deterministic, so the same creator always
 * produces the same URL across reports and snapshots.
 */
export function buildTikTokProfileUrl(username: string): string {
  return `https://www.tiktok.com/@${normalizeTikTokUsername(username)}`;
}

/**
 * Resolves any accepted creator input into a normalized username plus canonical
 * profile URL. The provider only ever receives values that passed through here,
 * so an arbitrary user-supplied URL is never fetched.
 */
export function assertApprovedTikTokProfile(input: {
  username?: string | null;
  profileUrl?: string | null;
}): NormalizedTikTokProfile {
  const source = input.username?.trim() || input.profileUrl?.trim() || "";
  const username = normalizeTikTokUsername(source);

  return { username, profileUrl: buildTikTokProfileUrl(username) };
}

/** Case-insensitive handle comparison for provider identity verification. */
export function usernamesMatch(left: string, right: string): boolean {
  return left.trim().replace(/^@+/, "").toLowerCase() ===
    right.trim().replace(/^@+/, "").toLowerCase();
}
