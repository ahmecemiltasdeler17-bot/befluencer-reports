/**
 * Strict integer counter parser for TikTok provider payloads.
 *
 * Returns null for missing, negative, non-finite or ambiguous values. Callers
 * decide whether null is fatal (required follower count) or optional.
 *
 * Documented string rules:
 * - "773000"            → 773000
 * - "773,000" / "773.000" → 773000 (exactly 3 digits after a single separator
 *   is treated as thousands grouping)
 * - "1.234.567" / "1,234,567" → 1234567 (repeated separator = thousands)
 * - "1.2M" / "1,2M" / "773K" → compact multipliers
 * - "1.234"             → 1234 (single separator + exactly 3 fraction digits
 *   = thousands; deterministic choice for the ambiguous case)
 * - "12.34" / "7.6%"    → null (non-integer decimal / percentage)
 * - negatives, NaN, Infinity → null
 */

const COMPACT_PATTERN =
  /^([0-9]+(?:[.,][0-9]+)?)\s*([kKmMbB])$/;

const MULTIPLIERS: Record<string, number> = {
  k: 1_000,
  m: 1_000_000,
  b: 1_000_000_000,
};

function toNonNegativeInt(value: number): number | null {
  if (!Number.isFinite(value) || value < 0) {
    return null;
  }

  // Whole decimals such as 84.0 are accepted; fractional counts are not.
  if (!Number.isInteger(value)) {
    return null;
  }

  return value;
}

function parseCompactCount(trimmed: string): number | null {
  const match = trimmed.match(COMPACT_PATTERN);

  if (!match) {
    return null;
  }

  const rawNumber = match[1].replace(",", ".");
  const amount = Number(rawNumber);
  const multiplier = MULTIPLIERS[match[2].toLowerCase()];

  if (!Number.isFinite(amount) || amount < 0 || !multiplier) {
    return null;
  }

  const product = amount * multiplier;

  // Compact forms may be fractional before scaling ("1.2M"); the product must
  // land on a whole number of counts.
  if (!Number.isFinite(product)) {
    return null;
  }

  const rounded = Math.round(product);

  if (Math.abs(product - rounded) > 1e-6) {
    return null;
  }

  return toNonNegativeInt(rounded);
}

/**
 * Strips thousands grouping and optional trailing ".0" / ",0" style wholes.
 * Returns null when the string cannot be resolved to a single integer.
 */
function parseGroupedInteger(trimmed: string): number | null {
  if (/[%a-zA-Z_]/.test(trimmed)) {
    return null;
  }

  if (!/^[0-9.,\s]+$/.test(trimmed)) {
    return null;
  }

  const compact = trimmed.replace(/[\s_]/g, "");

  if (compact.length === 0 || compact === "." || compact === ",") {
    return null;
  }

  const dotCount = (compact.match(/\./g) ?? []).length;
  const commaCount = (compact.match(/,/g) ?? []).length;

  // Repeated separators of one kind are always thousands grouping.
  if (dotCount > 1 && commaCount === 0) {
    return toNonNegativeInt(Number(compact.replace(/\./g, "")));
  }

  if (commaCount > 1 && dotCount === 0) {
    return toNonNegativeInt(Number(compact.replace(/,/g, "")));
  }

  if (dotCount > 0 && commaCount > 0) {
    // Rightmost separator is the decimal; the rest are thousands.
    const lastDot = compact.lastIndexOf(".");
    const lastComma = compact.lastIndexOf(",");
    const decimalAt = Math.max(lastDot, lastComma);
    const integerPart = compact
      .slice(0, decimalAt)
      .replace(/[.,]/g, "");
    const fractionPart = compact.slice(decimalAt + 1).replace(/[.,]/g, "");

    if (!/^[0-9]+$/.test(integerPart) || !/^[0-9]+$/.test(fractionPart)) {
      return null;
    }

    if (!/^0*$/.test(fractionPart)) {
      return null;
    }

    return toNonNegativeInt(Number(integerPart));
  }

  if (dotCount === 1 || commaCount === 1) {
    const separator = dotCount === 1 ? "." : ",";
    const [left, right] = compact.split(separator);

    if (!/^[0-9]+$/.test(left) || !/^[0-9]+$/.test(right)) {
      return null;
    }

    // Exactly three digits after a single separator → thousands grouping.
    // This is the deterministic resolution of the ambiguous "1.234" case.
    if (right.length === 3) {
      return toNonNegativeInt(Number(`${left}${right}`));
    }

    // One or two digits: only accept when the fractional part is all zeros
    // (provider sent a whole number as a decimal).
    if (right.length > 0 && right.length <= 2 && /^0+$/.test(right)) {
      return toNonNegativeInt(Number(left));
    }

    return null;
  }

  if (!/^[0-9]+$/.test(compact)) {
    return null;
  }

  return toNonNegativeInt(Number(compact));
}

export function parseProviderCount(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "boolean") {
    return null;
  }

  if (typeof value === "number") {
    return toNonNegativeInt(value);
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (trimmed.length === 0 || trimmed.startsWith("-")) {
    return null;
  }

  // Percentages are engagement rates, never counters.
  if (trimmed.includes("%")) {
    return null;
  }

  const compact = parseCompactCount(trimmed);

  if (compact !== null) {
    return compact;
  }

  return parseGroupedInteger(trimmed);
}

/**
 * First successfully parsed count in precedence order, or null when none of the
 * candidates yield a valid non-negative integer.
 */
export function readFirstProviderCount(candidates: unknown[]): number | null {
  for (const candidate of candidates) {
    const value = parseProviderCount(candidate);
    if (value !== null) {
      return value;
    }
  }

  return null;
}
