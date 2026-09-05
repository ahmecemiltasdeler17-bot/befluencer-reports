import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time `Authorization: Bearer …` check for the marketing-site ingest.
 *
 * Kept free of server-only imports so the unit suite can exercise it directly —
 * this is the only thing standing between a public URL and the leads table.
 *
 * Length is compared before `timingSafeEqual`, which throws on mismatched
 * buffer sizes. That reveals the length of a rejected guess and nothing else.
 */
export function bearerMatches(
  header: string | null | undefined,
  expected: string
): boolean {
  if (!header || expected.length === 0) {
    return false;
  }

  const match = header.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return false;
  }

  const provided = Buffer.from(match[1].trim(), "utf8");
  const secret = Buffer.from(expected, "utf8");

  if (provided.length !== secret.length) {
    return false;
  }

  return timingSafeEqual(provided, secret);
}
