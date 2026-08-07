import type { ReactNode } from "react";

import { ReportKpiItem } from "./report-kpi-item";

export interface ReportKpi {
  label: string;
  value: ReactNode;
  hint?: string;
}

interface ReportKpiGridProps {
  rows: ReportKpi[][];
}

export function ReportKpiGrid({ rows }: ReportKpiGridProps) {
  return (
    <section aria-label="Campaign summary metrics" className="w-full">
      <div className="flex flex-col gap-0">
        {rows.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className={`grid grid-cols-2 min-[1100px]:grid-cols-4 ${
              rowIndex > 0 ? "border-t border-white/[0.06]" : ""
            }`}
          >
            {row.map((kpi) => (
              <ReportKpiItem
                key={kpi.label}
                label={kpi.label}
                value={kpi.value}
                hint={kpi.hint}
              />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
