import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import {
  EXPORT_TOKEN_BYTES,
  EXPORT_TOKEN_MAX_TTL_SECONDS,
  EXPORT_TOKEN_TTL_SECONDS,
} from "@/features/pdf/constants";

/** Raw token is 64 lowercase hex characters; only its SHA-256 hash is stored. */
export function generateRawExportToken(): string {
  return randomBytes(EXPORT_TOKEN_BYTES).toString("hex");
}

export function hashExportToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

export function tokensMatch(hashA: string, hashB: string): boolean {
  if (hashA.length !== hashB.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(hashA), Buffer.from(hashB));
}

/** Clamped so a caller can never request a lifetime the database would reject. */
export function resolveTokenTtlSeconds(requested?: number): number {
  if (!Number.isFinite(requested ?? NaN)) {
    return EXPORT_TOKEN_TTL_SECONDS;
  }

  const seconds = Math.floor(requested as number);

  if (seconds < 1) {
    return EXPORT_TOKEN_TTL_SECONDS;
  }

  return Math.min(seconds, EXPORT_TOKEN_MAX_TTL_SECONDS);
}

export function buildTokenExpiry(
  now: Date,
  ttlSeconds = EXPORT_TOKEN_TTL_SECONDS
): string {
  const ttl = resolveTokenTtlSeconds(ttlSeconds);
  return new Date(now.getTime() + ttl * 1000).toISOString();
}

export function isTokenExpired(expiresAt: string, now: Date): boolean {
  const expiry = new Date(expiresAt).getTime();

  if (!Number.isFinite(expiry)) {
    return true;
  }

  return expiry <= now.getTime();
}

export function isTokenUsable(
  token: { expiresAt: string; usedAt: string | null },
  now: Date
): boolean {
  if (token.usedAt !== null) {
    return false;
  }

  return !isTokenExpired(token.expiresAt, now);
}
