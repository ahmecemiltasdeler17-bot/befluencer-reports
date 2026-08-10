import { Info } from "lucide-react";

/**
 * Communicates measurement density without sounding defensive.
 * `count` is the real observation count — never a fabricated resolution.
 */
export function ReportMeasurementNote({
  count,
  hint = "Grafik yalnızca gerçek ölçüm noktalarını gösterir; ara tarihler için değer üretilmez.",
}: {
  count: number;
  hint?: string;
}) {
  return (
    <p className="report-chart-note" title={hint}>
      <Info
        className="size-3 shrink-0 text-[var(--report-accent)]"
        aria-hidden
      />
      <span className="tabular-nums">{count} doğrulanmış ölçüm</span>
    </p>
  );
}
