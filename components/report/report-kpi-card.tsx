import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type ReportKpiCardProps = {
  label: string;
  /** Compact visible value (already formatted). */
  value: ReactNode;
  /** Exact value for assistive tech / native title. */
  exactLabel?: string;
  helper?: string;
  emphasis?: "primary" | "secondary";
  className?: string;
};

/**
 * Consistent report KPI surface — presentation only; values come from callers.
 */
export function ReportKpiCard({
  label,
  value,
  exactLabel,
  helper,
  emphasis = "primary",
  className,
}: ReportKpiCardProps) {
  return (
    <article
      className={cn(
        "report-kpi-card pdf-avoid-break flex h-full min-h-[120px] flex-col justify-between rounded-2xl bg-white/[0.025] px-5 py-5",
        "ring-1 ring-inset ring-white/[0.05]",
        emphasis === "secondary" && "min-h-[96px] bg-transparent ring-white/[0.04]",
        className
      )}
    >
      <p className="text-[10px] font-medium tracking-[0.18em] text-zinc-500 uppercase">
        {label}
      </p>
      <p
        className={cn(
          "mt-4 font-semibold tracking-tight text-white tabular-nums",
          emphasis === "primary"
            ? "text-[28px] leading-none min-[1100px]:text-[32px]"
            : "text-[22px] leading-none"
        )}
        title={exactLabel}
        aria-label={exactLabel ? `${label}: ${exactLabel}` : undefined}
      >
        {value}
      </p>
      {helper ? (
        <p className="mt-3 text-xs leading-relaxed text-zinc-500">{helper}</p>
      ) : (
        <span className="mt-3 block h-4" aria-hidden="true" />
      )}
    </article>
  );
}
