"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CHART_COLORS } from "@/lib/constants";
import { formatCompact } from "@/lib/format";
import type { GrowthDataPoint } from "@/lib/types";

interface GrowthChartProps {
  data: GrowthDataPoint[];
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-white/10 bg-[#18181B] px-3 py-2 shadow-xl">
      <p className="mb-1.5 text-xs text-zinc-500">{label}</p>
      {payload.map((entry) => (
        <div
          key={entry.dataKey}
          className="flex items-center justify-between gap-6 text-sm"
        >
          <span className="text-zinc-400">
            {entry.dataKey === "cumulativeViews" ? "Total Views" : "Period Views"}
          </span>
          <span className="font-medium text-white tabular-nums">
            {formatCompact(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function GrowthChart({ data }: GrowthChartProps) {
  return (
    <Card className="border-white/8 bg-[#111113] py-0 ring-0">
      <CardHeader className="border-b border-white/6 pb-4">
        <CardTitle className="text-sm font-medium text-zinc-200">
          Campaign Growth
        </CardTitle>
        <p className="text-xs text-zinc-500">Cumulative views over campaign lifetime</p>
      </CardHeader>
      <CardContent className="p-5 pt-4">
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
              <CartesianGrid
                stroke={CHART_COLORS.grid}
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tick={{ fill: "#71717A", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                dy={8}
              />
              <YAxis
                tickFormatter={(value) => formatCompact(value)}
                tick={{ fill: "#71717A", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={48}
              />
              <Tooltip content={<ChartTooltip />} />
              <Bar
                dataKey="cumulativeViews"
                fill="#FAFAFA"
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
