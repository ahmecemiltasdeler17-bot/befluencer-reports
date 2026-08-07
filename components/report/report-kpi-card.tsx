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
        "pdf-avoid-break flex h-full min-h-[112px] flex-col justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-4",
        emphasis === "secondary" && "min-h-[88px] bg-transparent",
        className
      )}
    >
      <p className="text-[10px] font-medium tracking-[0.18em] text-zinc-500 uppercase">
        {label}
      </p>
      <p
        className={cn(
          "mt-3 font-semibold tracking-tight text-white tabular-nums",
          emphasis === "primary"
            ? "text-[26px] leading-none min-[1100px]:text-[30px]"
            : "text-[20px] leading-none"
        )}
        title={exactLabel}
        aria-label={exactLabel ? `${label}: ${exactLabel}` : undefined}
      >
        {value}
      </p>
      {helper ? (
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">{helper}</p>
      ) : (
        <span className="mt-2 block h-4" aria-hidden="true" />
      )}
    </article>
  );
}
