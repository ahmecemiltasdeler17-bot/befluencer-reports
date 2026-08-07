import type { Platform, SafeExternalUrl } from "@/lib/report-links/types";

/** Only these two schemes may ever reach an href. */
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * Host allowlist per platform. Navigating anywhere else from a report is not a
 * supported action, so an unexpected host is treated as "no link" rather than
 * being rendered and hoping for the best.
 */
export const ALLOWED_SOCIAL_HOSTS: Record<Platform, readonly string[]> = {
  tiktok: ["tiktok.com", "www.tiktok.com", "vm.tiktok.com", "vt.tiktok.com"],
  instagram: ["instagram.com", "www.instagram.com"],
  youtube: ["youtube.com", "www.youtube.com", "youtu.be", "m.youtube.com"],
};

const ALL_ALLOWED_HOSTS = new Set(
  Object.values(ALLOWED_SOCIAL_HOSTS).flatMap((hosts) => hosts)
);

export function isAllowedSocialHost(host: string, platform?: Platform): boolean {
  const normalized = host.toLowerCase();

  if (platform) {
    return ALLOWED_SOCIAL_HOSTS[platform].includes(normalized);
  }

  return ALL_ALLOWED_HOSTS.has(normalized);
}

/**
 * Parses a candidate URL, rejecting anything that is not an absolute http(s)
 * address. Protocol-relative values like `//evil.example.com` are rejected
 * because they inherit the page scheme and bypass host expectations.
 */
export function parseExternalUrl(candidate: unknown): URL | null {
  if (typeof candidate !== "string") {
    return null;
  }

  const trimmed = candidate.trim();

  if (trimmed.length === 0 || trimmed.startsWith("//")) {
    return null;
  }

  let url: URL;

  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    return null;
  }

  if (url.hostname.length === 0) {
    return null;
  }

  return url;
}

/**
 * True only for an absolute http(s) URL on an approved social host.
 * Rejects javascript:, data:, file:, blob:, protocol-relative and malformed.
 */
export function isSafeExternalUrl(
  candidate: unknown,
  platform?: Platform
): candidate is SafeExternalUrl {
  const url = parseExternalUrl(candidate);

  if (!url) {
    return false;
  }

  return isAllowedSocialHost(url.hostname, platform);
}
