import type { TikTokProviderErrorCode } from "@/lib/providers/tiktok/errors";
import { TikTokProviderError } from "@/lib/providers/tiktok/errors";

/**
 * Definitive TikTok creator unavailability for soft account_status marking.
 *
 * Empty datasets, timeouts, rate limits and generic actor failures are NOT
 * unavailable — only clear provider evidence of a dead/private profile.
 */

export type CreatorUnavailableReason =
  | "not_found"
  | "deleted"
  | "banned"
  | "suspended"
  | "private";

export const DEFINITIVE_UNAVAILABLE_PROVIDER_CODES = new Set<TikTokProviderErrorCode>([
  "creator_not_found",
  "private_profile",
]);

const NOT_FOUND_PATTERNS = [
  "not found",
  "notfound",
  "does not exist",
  "no such user",
  "user not found",
  "couldn't find this account",
  "could not find this account",
  "can't find this account",
  "cannot find this account",
  "couldn't find this account",
  "no user found",
  "404",
] as const;

const DELETED_PATTERNS = ["deleted", "removed account", "account removed"] as const;

const BANNED_PATTERNS = ["banned", "banished"] as const;

const SUSPENDED_PATTERNS = ["suspended", "terminated"] as const;

const PRIVATE_PATTERNS = [
  "private account",
  "private profile",
  "this account is private",
  "account is private",
  "user is private",
] as const;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function includesAny(text: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => text.includes(pattern));
}

/**
 * Classify an Apify item as unavailable only with definitive text/flags.
 * Unrecognized error text returns null (do not guess).
 */
export function detectUnavailableCreatorItem(
  item: unknown
): { code: "creator_not_found" | "private_profile"; reason: CreatorUnavailableReason } | null {
  if (!isRecord(item)) {
    return null;
  }

  const text = [
    readString(item.error),
    readString(item.errorMessage),
    readString(item.message),
    readString(item.status),
    readString(item.errorDescription),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (text) {
    if (includesAny(text, DELETED_PATTERNS)) {
      return { code: "creator_not_found", reason: "deleted" };
    }
    if (includesAny(text, BANNED_PATTERNS)) {
      return { code: "creator_not_found", reason: "banned" };
    }
    if (includesAny(text, SUSPENDED_PATTERNS)) {
      return { code: "creator_not_found", reason: "suspended" };
    }
    if (includesAny(text, NOT_FOUND_PATTERNS)) {
      return { code: "creator_not_found", reason: "not_found" };
    }
    if (
      text === "private" ||
      includesAny(text, PRIVATE_PATTERNS) ||
      // Keep a cautious bare "private" match for short Apify status strings.
      (text.includes("private") &&
        !text.includes("privacy") &&
        !text.includes("temporarily"))
    ) {
      return { code: "private_profile", reason: "private" };
    }

    // Non-definitive error text must not mark the account unavailable.
    return null;
  }

  if (item.privateAccount === true || item.isPrivate === true) {
    return { code: "private_profile", reason: "private" };
  }

  return null;
}

export function isDefinitiveUnavailableCreatorError(
  error: unknown
): error is TikTokProviderError {
  return (
    error instanceof TikTokProviderError &&
    DEFINITIVE_UNAVAILABLE_PROVIDER_CODES.has(error.code)
  );
}

export function unavailableReasonFromProviderError(
  error: TikTokProviderError
): CreatorUnavailableReason {
  if (error.code === "private_profile") {
    return "private";
  }

  const detail = (error.detail ?? error.message ?? "").toLowerCase();
  if (
    detail === "deleted" ||
    detail === "banned" ||
    detail === "suspended" ||
    detail === "not_found" ||
    detail === "private"
  ) {
    return detail as CreatorUnavailableReason;
  }
  if (includesAny(detail, DELETED_PATTERNS)) return "deleted";
  if (includesAny(detail, BANNED_PATTERNS)) return "banned";
  if (includesAny(detail, SUSPENDED_PATTERNS)) return "suspended";
  return "not_found";
}

export function turkishUnavailableReason(
  reason: CreatorUnavailableReason
): string {
  switch (reason) {
    case "deleted":
      return "Hesap silinmiş";
    case "banned":
      return "Hesap yasaklanmış";
    case "suspended":
      return "Hesap askıya alınmış";
    case "private":
      return "Hesap gizli veya kısıtlı";
    case "not_found":
    default:
      return "Hesap bulunamadı";
  }
}
