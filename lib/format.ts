import { formatReportCompactCount } from "@/lib/formatters/format-compact-count";

/** English mock-dashboard compact formatter (K / M). Not used by live reports. */
export function formatCompact(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  }
  return value.toLocaleString("en-US");
}

export function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatDelta(current: number, previous: number): number {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

export function formatDateRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);

  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return `${formatter.format(startDate)} – ${formatter.format(endDate)}`;
}

export function formatShortDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

/**
 * Turkish report formatting: Mn = million, B = bin (thousand), Mr = milyar.
 * Delegates to the shared compact-count helper so management UI and reports
 * never diverge. Preserves one decimal and trailing zeros (`772,9 B`, `773,0 B`).
 */
export function formatTurkishReport(value: number): string {
  return formatReportCompactCount(value);
}

export {
  formatCompactCount,
  formatExactFollowerLabel,
  formatExactTurkishCount,
  formatManagementCompactCount,
  formatReportCompactCount,
} from "@/lib/formatters/format-compact-count";

export function formatTurkishPercent(value: number, decimals = 1): string {
  return `%${value.toFixed(decimals).replace(".", ",")}`;
}

export function formatTurkishDate(date: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

export function formatTurkishChartDate(date: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
  }).format(new Date(date));
}

export function formatTurkishDayMonth(date: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
  }).format(new Date(date));
}
