import type { ReactNode } from "react";

/**
 * Shared dark tooltip surface for Recharts on report pages / PDF.
 */
export function ReportChartTooltipShell({
  children,
  label,
}: {
  children: ReactNode;
  label?: string;
}) {
  return (
    <div className="report-chart-tooltip rounded-lg border border-[var(--report-border)] bg-[var(--report-surface-elevated)] px-3 py-2 shadow-xl">
      {label ? (
        <p className="text-[11px] text-[var(--report-text-tertiary)]">{label}</p>
      ) : null}
      <div className={label ? "mt-1" : undefined}>{children}</div>
    </div>
  );
}
