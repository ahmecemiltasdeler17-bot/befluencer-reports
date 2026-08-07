export type CompactCountOptions = {
  locale?: "tr-TR";
  /** Decimal places for scaled values. Defaults to 1. */
  fractionDigits?: 0 | 1;
  /**
   * When true, keep a trailing `,0` on scaled values (`773,0 B`).
   * When false, strip a trailing zero fraction (`773 B`).
   */
  preserveTrailingZero?: boolean;
};

const DEFAULT_OPTIONS: Required<CompactCountOptions> = {
  locale: "tr-TR",
  fractionDigits: 1,
  preserveTrailingZero: true,
};

/**
 * Exact Turkish integer, e.g. 772900 → "772.900".
 * Used for snapshot history and accessible exact-value labels.
 */
export function formatExactTurkishCount(value: number): string {
  if (!Number.isFinite(value)) {
    return "0";
  }

  return new Intl.NumberFormat("tr-TR", {
    maximumFractionDigits: 0,
  }).format(Math.trunc(value));
}

/**
 * Accessible exact follower label, e.g. "772.900 takipçi".
 */
export function formatExactFollowerLabel(value: number): string {
  return `${formatExactTurkishCount(value)} takipçi`;
}

function formatScaled(
  magnitude: number,
  divisor: number,
  suffix: string,
  options: Required<CompactCountOptions>
): string {
  const scaled = magnitude / divisor;
  let body = scaled.toFixed(options.fractionDigits).replace(".", ",");

  if (!options.preserveTrailingZero && options.fractionDigits > 0) {
    body = body.replace(/,0$/, "");
  }

  return `${body} ${suffix}`;
}

/**
 * Turkish compact counts for reports and management UI.
 *
 * Rules (magnitude-based, sign preserved):
 * - 0–999 → exact integer
 * - 1_000–999_999 → `/1000` + "B"
 * - 1_000_000–999_999_999 → `/1_000_000` + "Mn"
 * - 1_000_000_000+ → `/1_000_000_000` + "Mr"
 *
 * Intentionally avoids `Intl` compact notation — Turkish browser output varies
 * and can round 772900 to "773 B" with zero fraction digits.
 */
export function formatCompactCount(
  value: number,
  options: CompactCountOptions = {}
): string {
  const resolved = { ...DEFAULT_OPTIONS, ...options };

  if (!Number.isFinite(value)) {
    return "0";
  }

  const sign = value < 0 ? "-" : "";
  const magnitude = Math.abs(value);

  if (magnitude < 1_000) {
    return `${sign}${Math.trunc(magnitude)}`;
  }

  if (magnitude < 1_000_000) {
    return `${sign}${formatScaled(magnitude, 1_000, "B", resolved)}`;
  }

  if (magnitude < 1_000_000_000) {
    return `${sign}${formatScaled(magnitude, 1_000_000, "Mn", resolved)}`;
  }

  return `${sign}${formatScaled(magnitude, 1_000_000_000, "Mr", resolved)}`;
}

/** Report / KPI default: one decimal, trailing zero preserved. */
export function formatReportCompactCount(value: number): string {
  return formatCompactCount(value, {
    fractionDigits: 1,
    preserveTrailingZero: true,
  });
}

/** Management tables: one decimal, trailing zero optional (stripped). */
export function formatManagementCompactCount(value: number): string {
  return formatCompactCount(value, {
    fractionDigits: 1,
    preserveTrailingZero: false,
  });
}
