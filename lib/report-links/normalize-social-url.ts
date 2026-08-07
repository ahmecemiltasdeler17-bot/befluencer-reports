import {
  isAllowedSocialHost,
  parseExternalUrl,
} from "@/lib/report-links/is-safe-external-url";
import type { Platform, SafeExternalUrl } from "@/lib/report-links/types";

/**
 * Query parameters that carry meaning. Everything else (share trackers such as
 * `is_from_webapp`, `igsh`, `si`) is dropped so links stay stable across
 * historical snapshots.
 */
const MEANINGFUL_PARAMS: Record<Platform, readonly string[]> = {
  tiktok: [],
  instagram: [],
  youtube: ["v", "t", "list"],
};

function detectPlatformFromHost(host: string): Platform | null {
  const normalized = host.toLowerCase();

  if (isAllowedSocialHost(normalized, "tiktok")) return "tiktok";
  if (isAllowedSocialHost(normalized, "instagram")) return "instagram";
  if (isAllowedSocialHost(normalized, "youtube")) return "youtube";

  return null;
}

/**
 * Strips a leading `@`, surrounding whitespace and any accidental path or query
 * remnants from a username. Returns null when nothing usable remains.
 */
export function normalizeUsername(candidate: unknown): string | null {
  if (typeof candidate !== "string") {
    return null;
  }

  const cleaned = candidate
    .trim()
    .replace(/^@+/, "")
    .split(/[/?#\s]/)[0]
    .trim();

  if (cleaned.length === 0) {
    return null;
  }

  // Social handles are ASCII word characters plus dot/dash. Anything else would
  // not survive URL construction predictably.
  if (!/^[A-Za-z0-9._-]+$/.test(cleaned)) {
    return null;
  }

  return cleaned;
}

/**
 * Normalizes a stored social URL into a canonical, safe href.
 * Returns null when the URL is unsafe, malformed or off-platform.
 */
export function normalizeSocialUrl(
  candidate: unknown,
  platform?: Platform
): SafeExternalUrl | null {
  const url = parseExternalUrl(candidate);

  if (!url) {
    return null;
  }

  const host = url.hostname.toLowerCase();
  const detected = detectPlatformFromHost(host);

  if (!detected) {
    return null;
  }

  // A stored URL pointing at a different platform than the record claims is a
  // data quality problem; trust the host but refuse a mismatch when the caller
  // asserted a platform.
  if (platform && detected !== platform) {
    return null;
  }

  const normalized = new URL(url.toString());
  normalized.protocol = "https:";
  normalized.hostname = host;
  normalized.hash = "";
  normalized.username = "";
  normalized.password = "";
  normalized.port = "";

  const keep = MEANINGFUL_PARAMS[detected];
  const params = new URLSearchParams();

  for (const key of keep) {
    const value = url.searchParams.get(key);
    if (value !== null && value.length > 0) {
      params.set(key, value);
    }
  }

  normalized.search = params.toString();

  if (normalized.pathname.length > 1 && normalized.pathname.endsWith("/")) {
    normalized.pathname = normalized.pathname.replace(/\/+$/, "");
  }

  return normalized.toString();
}

export { detectPlatformFromHost };
