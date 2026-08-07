import { OriginConfigError, type ConfiguredOrigin } from "@/lib/origins/types";

/**
 * Validates and normalizes a configured origin.
 *
 * Accepts only absolute http(s) URLs whose path is empty or `/`, with no
 * query, fragment or credentials. Returns `url.origin` (no trailing slash).
 * Never reads request headers.
 */
export function normalizeConfiguredOrigin(value: string): ConfiguredOrigin {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new OriginConfigError("missing", "Origin value is empty.");
  }

  let url: URL;

  try {
    url = new URL(trimmed);
  } catch {
    throw new OriginConfigError("invalid_url", "Origin is not a valid URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new OriginConfigError(
      "invalid_scheme",
      "Origin must use http or https."
    );
  }

  if (url.username || url.password) {
    throw new OriginConfigError(
      "has_credentials",
      "Origin must not include credentials."
    );
  }

  if (url.search) {
    throw new OriginConfigError(
      "has_query",
      "Origin must not include a query string."
    );
  }

  if (url.hash) {
    throw new OriginConfigError(
      "has_fragment",
      "Origin must not include a fragment."
    );
  }

  // Allow bare origin or a single trailing slash only.
  if (url.pathname !== "/" && url.pathname !== "") {
    throw new OriginConfigError(
      "has_path",
      "Origin must not include a path."
    );
  }

  return url.origin;
}

export function isValidConfiguredOrigin(value: string): boolean {
  try {
    normalizeConfiguredOrigin(value);
    return true;
  } catch {
    return false;
  }
}

/** Safe parse that returns null instead of throwing. */
export function tryNormalizeConfiguredOrigin(
  value: string | undefined | null
): ConfiguredOrigin | null {
  if (value == null || value.trim() === "") {
    return null;
  }

  try {
    return normalizeConfiguredOrigin(value);
  } catch {
    return null;
  }
}
