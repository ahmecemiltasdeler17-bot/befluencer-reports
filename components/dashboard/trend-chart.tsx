"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CHART_COLORS } from "@/lib/constants";
import { formatCompact, formatShortDate } from "@/lib/format";
import type { TrendDataPoint } from "@/lib/types";

interface TrendChartProps {
  data: TrendDataPoint[];
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-white/10 bg-[#18181B] px-3 py-2 shadow-xl">
      <p className="mb-1.5 text-xs text-zinc-500">
        {label ? formatShortDate(label) : ""}
      </p>
      {payload.map((entry) => (
        <div
          key={entry.dataKey}
          className="flex items-center justify-between gap-6 text-sm"
        >
          <span className="capitalize text-zinc-400">{entry.dataKey}</span>
          <span className="font-medium text-white tabular-nums">
            {formatCompact(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function TrendChart({ data }: TrendChartProps) {
  return (
    <Card className="border-white/8 bg-[#111113] py-0 ring-0">
      <CardHeader className="border-b border-white/6 pb-4">
        <CardTitle className="text-sm font-medium text-zinc-200">
          Performance Trend
        </CardTitle>
        <p className="text-xs text-zinc-500">Daily views and engagement</p>
      </CardHeader>
      <CardContent className="p-5 pt-4">
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FAFAFA" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#FAFAFA" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="engagementGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                stroke={CHART_COLORS.grid}
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tickFormatter={(value) => formatShortDate(value)}
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
              <Area
                type="monotone"
                dataKey="views"
                stroke="#FAFAFA"
                strokeWidth={2}
                fill="url(#viewsGradient)"
              />
              <Area
                type="monotone"
                dataKey="engagement"
                stroke="#3B82F6"
                strokeWidth={2}
                fill="url(#engagementGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 flex items-center gap-5">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span className="size-2 rounded-full bg-white" />
            Views
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span className="size-2 rounded-full bg-blue-500" />
            Engagement
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
