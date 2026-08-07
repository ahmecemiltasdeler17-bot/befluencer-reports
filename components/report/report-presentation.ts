export type ReportPresentationContext =
  | "live"
  | "historical"
  | "archived"
  | "public";

/** Human-friendly context labels for report surfaces. */
export function reportContextLabel(
  context: ReportPresentationContext | undefined
): string | null {
  switch (context) {
    case "live":
      return "Canlı Rapor";
    case "historical":
      return "Kayıtlı Rapor";
    case "archived":
      return "Arşivlenmiş Rapor";
    case "public":
      return "Paylaşılan Rapor";
    default:
      return null;
  }
}

export function formatReportPeriod(
  startDate: string | null | undefined,
  endDate: string | null | undefined
): string | null {
  if (!startDate && !endDate) {
    return null;
  }

  const formatter = new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const start = startDate ? formatter.format(new Date(startDate)) : null;
  const end = endDate ? formatter.format(new Date(endDate)) : null;

  if (start && end) {
    return `${start} – ${end}`;
  }

  return start ?? end;
}
