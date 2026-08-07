/**
 * Pure cron Authorization header checks.
 * Never logs or returns the secret.
 */

export function extractBearerToken(
  authorizationHeader: string | null
): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const match = /^Bearer\s+(.+)$/i.exec(authorizationHeader.trim());
  if (!match) {
    return null;
  }

  const token = match[1].trim();
  return token.length > 0 ? token : null;
}

/**
 * Constant-time-ish comparison for secrets of equal length.
 * Different lengths short-circuit without leaking the expected value.
 */
export function secretsEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return mismatch === 0;
}

export function isAuthorizedCronRequest(
  authorizationHeader: string | null,
  cronSecret: string | null | undefined
): boolean {
  if (!cronSecret || cronSecret.trim().length === 0) {
    return false;
  }

  const token = extractBearerToken(authorizationHeader);
  if (!token) {
    return false;
  }

  return secretsEqual(token, cronSecret.trim());
}
