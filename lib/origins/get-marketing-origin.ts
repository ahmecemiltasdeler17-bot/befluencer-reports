import { resolveMarketingSiteUrlCandidate } from "@/lib/origins/candidates";
import { OriginConfigError } from "@/lib/origins/types";
import {
  normalizeConfiguredOrigin,
  tryNormalizeConfiguredOrigin,
} from "@/lib/origins/validate-origin";

/**
 * Future corporate website origin (`MARKETING_SITE_URL`).
 * Optional — returns null when unset. Throws when set but invalid.
 */
export function getMarketingOrigin(): string | null {
  const candidate = resolveMarketingSiteUrlCandidate();

  if (!candidate) {
    return null;
  }

  try {
    return normalizeConfiguredOrigin(candidate);
  } catch (error) {
    if (error instanceof OriginConfigError) {
      throw new OriginConfigError(
        error.code,
        `MARKETING_SITE_URL is invalid: ${error.message}`
      );
    }
    throw error;
  }
}

/** Soft read for optional UI helpers — invalid values become null. */
export function peekMarketingOrigin(): string | null {
  return tryNormalizeConfiguredOrigin(resolveMarketingSiteUrlCandidate());
}
