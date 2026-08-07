import "server-only";

import { isRawShareToken } from "@/features/public-reports/token";

export type PublicShareResolveDiagnostic = {
  tokenFormatValid: boolean;
  shareRowFound: boolean;
  shareUsable: boolean;
  reportVersionStatus: string | null;
  rpcErrorCode: string | null;
};

/**
 * Development-only sanitized diagnostics for public share resolution.
 * Never logs raw tokens, hashes, snapshots, or Supabase keys.
 */
export function logPublicShareResolveDiagnostic(
  diagnostic: PublicShareResolveDiagnostic
): void {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.info("[public-share:resolve]", {
    tokenFormatValid: diagnostic.tokenFormatValid,
    shareRowFound: diagnostic.shareRowFound,
    shareUsable: diagnostic.shareUsable,
    reportVersionStatus: diagnostic.reportVersionStatus,
    rpcErrorCode: diagnostic.rpcErrorCode,
  });
}

export function diagnoseTokenFormat(rawToken: string): boolean {
  return isRawShareToken(rawToken);
}
