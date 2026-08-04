import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import {
  formatCompact,
  formatDelta,
  formatNumber,
  formatPercent,
} from "@/lib/format";
import type { KpiMetric } from "@/lib/types";
import { cn } from "@/lib/utils";

interface KPICardProps {
  metric: KpiMetric;
}

function formatValue(metric: KpiMetric): string {
  switch (metric.format) {
    case "compact":
      return formatCompact(metric.value);
    case "percent":
      return formatPercent(metric.value);
    default:
      return formatNumber(metric.value);
  }
}

export function KPICard({ metric }: KPICardProps) {
  const delta = formatDelta(metric.value, metric.previousValue);
  const isPositive = delta > 0;
  const isNeutral = delta === 0;

  return (
    <Card className="border-white/8 bg-[#111113] py-0 ring-0">
      <CardContent className="flex flex-col gap-3 p-5">
        <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
          {metric.label}
        </p>
        <div className="flex items-end justify-between gap-3">
          <p className="text-2xl font-semibold tracking-tight text-white tabular-nums sm:text-3xl">
            {formatValue(metric)}
            {metric.suffix && (
              <span className="ml-1 text-lg text-zinc-500">{metric.suffix}</span>
            )}
          </p>
          <div
            className={cn(
              "flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium",
              isNeutral && "bg-zinc-800 text-zinc-400",
              isPositive && "bg-emerald-500/10 text-emerald-400",
              !isPositive && !isNeutral && "bg-red-500/10 text-red-400"
            )}
          >
            {isNeutral ? (
              <Minus className="size-3" />
            ) : isPositive ? (
              <ArrowUpRight className="size-3" />
            ) : (
              <ArrowDownRight className="size-3" />
            )}
            {Math.abs(delta).toFixed(1)}%
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
