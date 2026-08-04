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

import {
  formatTurkishDayMonth,
  formatTurkishReport,
} from "@/lib/format";
import type { GrowthDataPoint, TrendDataPoint } from "@/lib/types";

interface PerformanceTrendSectionProps {
  growth: GrowthDataPoint[];
  trend: TrendDataPoint[];
}

interface TrendSummary {
  last7Days: number;
  dailyAverage: number;
  peakDate: string;
}

function computeTrendSummary(
  growth: GrowthDataPoint[],
  trend: TrendDataPoint[]
): TrendSummary {
  const deltas = trend.slice(1).map((point, index) => ({
    date: point.date,
    value: point.views - trend[index].views,
  }));

  const last7 = deltas.slice(-7);
  const last7Days = last7.reduce((sum, item) => sum + item.value, 0);
  const dailyAverage =
    deltas.length > 0
      ? deltas.reduce((sum, item) => sum + item.value, 0) / deltas.length
      : 0;

  const peak = deltas.reduce(
    (best, item) => (item.value > best.value ? item : best),
    deltas[0] ?? { date: trend[0]?.date ?? "", value: 0 }
  );

  if (last7Days === 0 && growth.length >= 2) {
    const recent = growth[growth.length - 1].cumulativeViews;
    const previous = growth[Math.max(0, growth.length - 3)].cumulativeViews;
    return {
      last7Days: recent - previous,
      dailyAverage: recent / growth.length,
      peakDate: trend[trend.length - 1]?.date ?? peak.date,
    };
  }

  return {
    last7Days,
    dailyAverage,
    peakDate: peak.date,
  };
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-white/10 bg-[#18181B] px-3 py-2 shadow-xl">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white tabular-nums">
        {formatTurkishReport(payload[0].value)} izlenme
      </p>
    </div>
  );
}

export function PerformanceTrendSection({
  growth,
  trend,
}: PerformanceTrendSectionProps) {
  const summary = computeTrendSummary(growth, trend);

  const chartData = growth.map((point) => ({
    label: point.date,
    views: point.cumulativeViews,
  }));

  return (
    <section aria-label="Performans trendi" className="w-full">
      <div className="flex flex-col gap-8 min-[1000px]:flex-row min-[1000px]:items-end min-[1000px]:justify-between">
        <div className="max-w-xl">
          <h2 className="text-[28px] font-semibold tracking-tight text-white min-[1000px]:text-[32px]">
            Performans Trendi
          </h2>
          <p className="mt-2 text-base text-zinc-400">
            Kampanya başlangıcından itibaren toplam izlenme
          </p>
        </div>

        <div className="flex flex-col gap-4 min-[1000px]:items-end min-[1000px]:text-right">
          <SummaryItem
            label="Son 7 gün"
            value={`+${formatTurkishReport(summary.last7Days)}`}
          />
          <SummaryItem
            label="Günlük ortalama"
            value={formatTurkishReport(summary.dailyAverage)}
          />
          <SummaryItem
            label="En yüksek gün"
            value={formatTurkishDayMonth(summary.peakDate)}
          />
        </div>
      </div>

      <div className="mt-12 border-y border-white/[0.06] py-10">
        <div className="h-[340px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
            >
              <defs>
                <linearGradient id="reachGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FF5A00" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="#FF5A00" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                stroke="rgba(255,255,255,0.04)"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fill: "#71717A", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                dy={10}
              />
              <YAxis
                tickFormatter={(value) => formatTurkishReport(value)}
                tick={{ fill: "#71717A", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={56}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="views"
                stroke="#FF5A00"
                strokeWidth={2}
                fill="url(#reachGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] tracking-[0.18em] text-zinc-500 uppercase">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-white tabular-nums">{value}</p>
    </div>
  );
}
