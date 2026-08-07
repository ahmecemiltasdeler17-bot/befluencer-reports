import { createHash, randomBytes } from "node:crypto";

/** 32 cryptographically random bytes → 64 lowercase hex characters. */
export const PUBLIC_SHARE_TOKEN_BYTES = 32;
export const PUBLIC_SHARE_TOKEN_HEX_LENGTH = PUBLIC_SHARE_TOKEN_BYTES * 2;
export const PUBLIC_SHARE_ACCESS_NONCE_BYTES = 16;

const RAW_TOKEN_PATTERN = /^[0-9a-f]{64}$/;
const ACCESS_NONCE_PATTERN = /^[0-9a-f]{32}$/;

export function generateRawShareToken(): string {
  return randomBytes(PUBLIC_SHARE_TOKEN_BYTES).toString("hex");
}

export function hashShareToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

export function isRawShareToken(value: string): boolean {
  return RAW_TOKEN_PATTERN.test(value);
}

/**
 * Route params are used as-is. No decodeURIComponent, trim, or truncation —
 * the raw 64-hex token must round-trip unchanged into the RPC.
 */
export function normalizeRouteShareToken(value: string): string {
  return value;
}

export function generateAccessNonce(): string {
  return randomBytes(PUBLIC_SHARE_ACCESS_NONCE_BYTES).toString("hex");
}

export function isAccessNonce(value: string): boolean {
  return ACCESS_NONCE_PATTERN.test(value);
}

/**
 * Builds `/r/<raw-token>` against the trusted public-report origin
 * (`PUBLIC_REPORT_URL`, falling back to `APP_URL`).
 * Never derives the host from a request header.
 */
export function buildPublicShareUrl(
  publicReportOrigin: string,
  rawToken: string
): string {
  if (!isRawShareToken(rawToken)) {
    throw new Error("Invalid share token format");
  }

  const origin = new URL(publicReportOrigin).origin;
  const url = new URL(`/r/${rawToken}`, origin);

  if (url.origin !== origin) {
    throw new Error("Origin mismatch");
  }

  return url.toString();
}
