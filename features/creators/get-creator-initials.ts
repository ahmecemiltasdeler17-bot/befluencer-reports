/**
 * Deterministic creator initials for SSR + client hydration.
 * No Intl.Segmenter, no browser APIs, no host-locale casing.
 */

const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;
const COLLAPSE_WHITESPACE = /\s+/g;
/** Zero-width / format characters that must not become initials. */
const INVISIBLE = /[\u200B-\u200D\uFEFF\u2060]/u;
const COMBINING_MARK = /\p{M}/u;
const LETTER_OR_NUMBER = /\p{L}|\p{N}/u;
const EMOJI = /\p{Extended_Pictographic}/u;

/**
 * Sanitize display/username text for initials only.
 * Does not mutate stored creator rows.
 */
export function sanitizeCreatorNameText(value: string): string {
  return value
    .normalize("NFC")
    .replace(/\uFFFD/g, "")
    .replace(CONTROL_CHARS, "")
    .replace(COLLAPSE_WHITESPACE, " ")
    .trim();
}

/**
 * First safe visible code point of a word, uppercased with a fixed locale
 * for letters/numbers. Emoji are kept as-is (not case-mapped).
 */
function firstInitialCodePoint(word: string): string | null {
  for (const codePoint of Array.from(word)) {
    if (COMBINING_MARK.test(codePoint)) {
      continue;
    }

    if (INVISIBLE.test(codePoint)) {
      continue;
    }

    if (codePoint === "\uFFFD") {
      continue;
    }

    if (LETTER_OR_NUMBER.test(codePoint)) {
      return codePoint.toLocaleUpperCase("en-US");
    }

    if (EMOJI.test(codePoint)) {
      return codePoint;
    }
  }

  return null;
}

function initialsFromSource(source: string): string {
  const parts = source.split(" ").filter((part) => part.length > 0);
  const letters: string[] = [];

  for (const part of parts) {
    const initial = firstInitialCodePoint(part);
    if (initial) {
      letters.push(initial);
    }
    if (letters.length >= 2) {
      break;
    }
  }

  if (letters.length >= 2) {
    return `${letters[0]}${letters[1]}`;
  }

  if (letters.length === 1) {
    // One-word: take up to two safe code points from that single word.
    const word = parts[0] ?? source;
    const codePoints = Array.from(word).filter(
      (ch) =>
        !COMBINING_MARK.test(ch) &&
        !INVISIBLE.test(ch) &&
        ch !== "\uFFFD" &&
        (LETTER_OR_NUMBER.test(ch) || EMOJI.test(ch))
    );

    if (codePoints.length === 0) {
      return letters[0]!;
    }

    if (codePoints.length === 1) {
      const only = codePoints[0]!;
      return LETTER_OR_NUMBER.test(only)
        ? only.toLocaleUpperCase("en-US")
        : only;
    }

    const first = codePoints[0]!;
    const second = codePoints[1]!;
    return (
      (LETTER_OR_NUMBER.test(first) ? first.toLocaleUpperCase("en-US") : first) +
      (LETTER_OR_NUMBER.test(second) ? second.toLocaleUpperCase("en-US") : second)
    );
  }

  return "?";
}

/**
 * Prefer sanitized displayName; fall back to username; otherwise "?".
 */
export function getCreatorInitials(
  displayName: string | null | undefined,
  username: string | null | undefined
): string {
  const sanitizedDisplay = sanitizeCreatorNameText(
    typeof displayName === "string" ? displayName : ""
  );
  const sanitizedUsername = sanitizeCreatorNameText(
    typeof username === "string" ? username : ""
  );

  const source =
    sanitizedDisplay.length > 0 ? sanitizedDisplay : sanitizedUsername;

  if (source.length === 0) {
    return "?";
  }

  return initialsFromSource(source);
}

/**
 * Deterministic non-negative hash for gradient selection.
 * Uses UTF-16 code units of the seed string only — identical on server/client.
 */
export function getCreatorAvatarSeed(username: string): number {
  const seed = sanitizeCreatorNameText(username) || username || "?";
  let hash = 0;

  for (let i = 0; i < seed.length; i += 1) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }

  return Math.abs(hash);
}
