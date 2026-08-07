/**
 * Raw env candidates for platform origins.
 * Values are not validated here — pass through normalizeConfiguredOrigin.
 * Never derived from Host / X-Forwarded-Host.
 */

/** True when running on a Vercel deployment (production or preview). */
export function isVercelRuntime(): boolean {
  return process.env.VERCEL === "1" || Boolean(process.env.VERCEL_ENV);
}

/**
 * Detect localhost / loopback origins that are valid for local dev but must
 * never win on Vercel when a real deployment URL is available.
 */
export function isLocalhostOriginCandidate(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  try {
    const url = new URL(
      trimmed.includes("://") ? trimmed : `http://${trimmed}`
    );
    const host = url.hostname.toLowerCase();
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host === "[::1]"
    );
  } catch {
    return /^localhost(?::\d+)?$/i.test(trimmed);
  }
}

function stripProtocol(hostOrUrl: string): string {
  return hostOrUrl.trim().replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

/**
 * Prefer the stable production hostname, then the current deployment URL.
 * Vercel provides these without a scheme.
 */
export function resolveVercelHttpsOriginCandidate(): string | undefined {
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (production) {
    return `https://${stripProtocol(production)}`;
  }

  const deployment = process.env.VERCEL_URL?.trim();
  if (deployment) {
    return `https://${stripProtocol(deployment)}`;
  }

  return undefined;
}

/**
 * Whether a configured origin value should be used as-is.
 * Localhost values are ignored on Vercel so a copied `.env.local` cannot
 * poison production share links.
 */
function acceptConfiguredOriginCandidate(
  value: string | undefined
): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  if (isLocalhostOriginCandidate(trimmed) && isVercelRuntime()) {
    return undefined;
  }

  return trimmed;
}

/**
 * Internal app origin candidate (`APP_URL`).
 *
 * Priority:
 * 1. Non-localhost `APP_URL` (or localhost when not on Vercel)
 * 2. Vercel deployment / production HTTPS origin
 * 3. Development-only `http://localhost:3000`
 */
export function resolveAppUrlCandidate(): string | undefined {
  const fromEnv = acceptConfiguredOriginCandidate(process.env.APP_URL);
  if (fromEnv) {
    return fromEnv;
  }

  const fromVercel = resolveVercelHttpsOriginCandidate();
  if (fromVercel) {
    return fromVercel;
  }

  // Local fallback only outside production builds.
  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:3000";
  }

  return undefined;
}

/**
 * Public report / share origin candidate.
 *
 * Priority:
 * 1. `PUBLIC_REPORT_URL` (ignored when localhost on Vercel)
 * 2. `APP_URL` resolution (including Vercel + dev fallbacks)
 */
export function resolvePublicReportUrlCandidate(): string | undefined {
  const fromEnv = acceptConfiguredOriginCandidate(process.env.PUBLIC_REPORT_URL);
  if (fromEnv) {
    return fromEnv;
  }

  return resolveAppUrlCandidate();
}

export function resolveMarketingSiteUrlCandidate(): string | undefined {
  const direct = process.env.MARKETING_SITE_URL?.trim();
  return direct || undefined;
}
