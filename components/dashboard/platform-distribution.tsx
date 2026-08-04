"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCompact } from "@/lib/format";
import type { PlatformStat } from "@/lib/types";

interface PlatformDistributionProps {
  data: PlatformStat[];
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: PlatformStat }>;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;

  return (
    <div className="rounded-lg border border-white/10 bg-[#18181B] px-3 py-2 shadow-xl">
      <p className="text-sm font-medium text-white">{item.label}</p>
      <p className="text-xs text-zinc-400">
        {formatCompact(item.value)} · {item.percentage}%
      </p>
    </div>
  );
}

export function PlatformDistribution({ data }: PlatformDistributionProps) {
  return (
    <Card className="border-white/8 bg-[#111113] py-0 ring-0">
      <CardHeader className="border-b border-white/6 pb-4">
        <CardTitle className="text-sm font-medium text-zinc-200">
          Platform Distribution
        </CardTitle>
        <p className="text-xs text-zinc-500">Views by platform</p>
      </CardHeader>
      <CardContent className="p-5 pt-4">
        <div className="flex flex-col items-center gap-6 sm:flex-row">
          <div className="h-[200px] w-full sm:w-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={56}
                  outerRadius={80}
                  paddingAngle={3}
                  stroke="none"
                >
                  {data.map((entry) => (
                    <Cell key={entry.platform} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex w-full flex-1 flex-col gap-3">
            {data.map((platform) => (
              <div key={platform.platform} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: platform.color }}
                    />
                    <span className="text-zinc-300">{platform.label}</span>
                  </div>
                  <span className="font-medium text-white tabular-nums">
                    {platform.percentage}%
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/6">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${platform.percentage}%`,
                      backgroundColor: platform.color,
                    }}
                  />
                </div>
                <p className="text-xs text-zinc-500 tabular-nums">
                  {formatCompact(platform.value)} views
                </p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
