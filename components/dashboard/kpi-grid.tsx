import type { KpiMetric } from "@/lib/types";

import { KPICard } from "./kpi-card";

interface KPIGridProps {
  metrics: KpiMetric[];
}

export function KPIGrid({ metrics }: KPIGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {metrics.map((metric) => (
        <KPICard key={metric.id} metric={metric} />
      ))}
    </div>
  );
}
