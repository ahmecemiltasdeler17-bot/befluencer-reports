import type { CreatorListErrorCode } from "@/features/creator-lists/errors";
import { isRawShareToken } from "@/features/creator-lists/token";

export type CreatorListOperation =
  | "createCreatorList"
  | "insertCreatorListItems"
  | "addCreatorsToList"
  | "removeCreatorFromList"
  | "reorderCreatorListItems"
  | "updateCreatorList"
  | "updateCreatorListItemNotes"
  | "archiveCreatorList"
  | "deleteCreatorList"
  | "listCreatorLists"
  | "getCreatorList"
  | "listCreatorListShares"
  | "createCreatorListShare"
  | "revokeCreatorListShare"
  | "updateCreatorListShare"
  | "addCreatorListToCampaign"
  | "resolvePublicCreatorList"
  | "consumePublicCreatorList"
  | "consumePublicCreatorListCsv";

export type CreatorListDiagnosticInput = {
  operation: CreatorListOperation;
  tableOrRpc?: string;
  errorCode?: string | null;
  constraint?: string | null;
  authenticated?: boolean;
  insertedItemCount?: number;
  mappedCode?: CreatorListErrorCode;
  tokenFormatValid?: boolean;
  shareRowFound?: boolean;
  shareUsable?: boolean;
  creatorListFound?: boolean;
  itemCount?: number;
  parserSuccess?: boolean;
};

export type PublicCreatorListResolveDiagnostic = {
  tokenFormatValid: boolean;
  shareRowFound: boolean;
  shareUsable: boolean;
  creatorListFound: boolean;
  itemCount: number | null;
  rpcErrorCode: string | null;
  parserSuccess: boolean;
};

/**
 * Development-only sanitized diagnostics for `/lists/<token>` resolve.
 * Never logs raw tokens, hashes, notes, creator private data, or keys.
 */
export function logPublicCreatorListResolveDiagnostic(
  diagnostic: PublicCreatorListResolveDiagnostic
): void {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.NODE_TEST === "1"
  ) {
    return;
  }

  console.info("[creator-list-share:resolve]", {
    tokenFormatValid: diagnostic.tokenFormatValid,
    shareRowFound: diagnostic.shareRowFound,
    shareUsable: diagnostic.shareUsable,
    creatorListFound: diagnostic.creatorListFound,
    itemCount: diagnostic.itemCount,
    rpcErrorCode: diagnostic.rpcErrorCode,
    parserSuccess: diagnostic.parserSuccess,
  });
}

export function diagnoseCreatorListTokenFormat(rawToken: string): boolean {
  return isRawShareToken(rawToken);
}

/**
 * Development-only sanitized diagnostics. Never logs tokens, notes, keys,
 * raw SQL, or creator private payloads.
 */
export function logCreatorListDiagnostics(
  input: CreatorListDiagnosticInput
): void {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.NODE_TEST === "1"
  ) {
    return;
  }

  console.error("[creator-lists]", {
    operation: input.operation,
    tableOrRpc: input.tableOrRpc ?? null,
    supabaseErrorCode: input.errorCode ?? null,
    constraint: input.constraint ?? null,
    authenticatedUserPresent: Boolean(input.authenticated),
    insertedItemCount:
      typeof input.insertedItemCount === "number"
        ? input.insertedItemCount
        : null,
    mappedCode: input.mappedCode ?? null,
    tokenFormatValid: input.tokenFormatValid ?? null,
    shareRowFound: input.shareRowFound ?? null,
    shareUsable: input.shareUsable ?? null,
    creatorListFound: input.creatorListFound ?? null,
    itemCount:
      typeof input.itemCount === "number" ? input.itemCount : null,
    parserSuccess: input.parserSuccess ?? null,
  });
}

type SupabaseLikeError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

export function readSupabaseErrorParts(error: unknown): {
  code: string | null;
  constraint: string | null;
  message: string;
} {
  const err = (error ?? {}) as SupabaseLikeError;
  const message = typeof err.message === "string" ? err.message : "";
  const details = typeof err.details === "string" ? err.details : "";
  const hint = typeof err.hint === "string" ? err.hint : "";
  const combined = `${message} ${details} ${hint}`;

  const constraintMatch =
    combined.match(/constraint["\s:]+"?([a-z0-9_]+)"?/i) ??
    combined.match(/\(([a-z0-9_]+)\)/i);

  return {
    code: typeof err.code === "string" ? err.code : null,
    constraint: constraintMatch?.[1] ?? null,
    message,
  };
}

/**
 * Maps PostgREST / Postgres failures onto typed creator-list errors.
 * Prefer specific codes over generic database_failure.
 */
export function mapCreatorListSupabaseError(
  error: unknown,
  fallback: CreatorListErrorCode = "database_failure"
): CreatorListErrorCode {
  const { code, message } = readSupabaseErrorParts(error);
  const normalized = `${code ?? ""} ${message}`.toLowerCase();

  if (
    code === "42P01" ||
    code === "PGRST205" ||
    normalized.includes("could not find the table") ||
    normalized.includes("does not exist") ||
    normalized.includes("schema cache")
  ) {
    return "migration_missing";
  }

  if (
    code === "42501" ||
    code === "PGRST301" ||
    normalized.includes("permission denied") ||
    normalized.includes("row-level security") ||
    normalized.includes("rls")
  ) {
    return "rls_denied";
  }

  if (
    code === "23503" ||
    normalized.includes("foreign key") ||
    normalized.includes("violates foreign key")
  ) {
    return "invalid_creator_ids";
  }

  if (
    code === "23505" ||
    normalized.includes("duplicate key") ||
    normalized.includes("unique constraint")
  ) {
    return "duplicate_item";
  }

  if (
    code === "23514" ||
    normalized.includes("check constraint") ||
    normalized.includes("violates check")
  ) {
    return "validation_failed";
  }

  return fallback;
}
