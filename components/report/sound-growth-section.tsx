"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Label,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { generateWaveformBars } from "@/lib/media-fallback-styles";
import { formatTurkishChartDate } from "@/lib/format";
import type { SoundGrowth } from "@/lib/types";

interface SoundGrowthSectionProps {
  data: SoundGrowth;
  hasTimeline?: boolean;
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
        {payload[0].value} kullanım
      </p>
    </div>
  );
}

function SoundWaveform({ seed }: { seed: string }) {
  const bars = generateWaveformBars(seed, 56);

  return (
    <div className="flex h-12 items-end gap-[2px] opacity-80">
      {bars.map((height, index) => (
        <span
          key={index}
          className="w-[3px] rounded-full bg-[#FF5A00]/70"
          style={{ height: `${Math.round(height * 100)}%` }}
        />
      ))}
    </div>
  );
}

export function SoundGrowthSection({
  data,
  hasTimeline = true,
}: SoundGrowthSectionProps) {
  // No large empty shell when sound timeline is unavailable.
  if (!hasTimeline || data.timeline.length < 2) {
    return null;
  }

  const chartData = data.timeline.map((point) => ({
    ...point,
    label: formatTurkishChartDate(point.date),
  }));

  const peakPoint = chartData.reduce((best, point) =>
    point.uses > best.uses ? point : best
  );
  const startPoint = chartData[0];
  const currentPoint = chartData[chartData.length - 1];

  return (
    <section
      aria-label="Ses kullanım büyümesi"
      className="pdf-section report-section mt-16 min-[1100px]:mt-20"
    >
      <div className="flex flex-col gap-8 min-[800px]:flex-row min-[800px]:items-end min-[800px]:justify-between">
        <div className="max-w-2xl">
          <p className="text-[11px] font-medium tracking-[0.2em] text-zinc-500 uppercase">
            Ses
          </p>
          <h2 className="mt-2 text-[24px] font-semibold tracking-tight text-white min-[1100px]:text-[28px]">
            Ses Performansı
          </h2>
          <p className="mt-2 text-sm text-zinc-400 min-[1100px]:text-base">
            TikTok üzerinde ses kullanımının kampanya boyunca gelişimi.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-6 min-[800px]:gap-8">
          <MetricBlock
            label="Büyüme"
            value={`×${data.multiplier.toFixed(1).replace(".", ",")}`}
            valueClassName="text-zinc-100"
          />
          <MetricBlock
            label="Güncel Kullanım"
            value={String(data.currentUses)}
            valueClassName="text-white"
          />
          <MetricBlock
            label="Başlangıç Kullanımı"
            value={String(data.initialUses)}
            valueClassName="text-zinc-500"
          />
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-4 min-[800px]:flex-row min-[800px]:items-center min-[800px]:justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">
            {data.soundName}
          </p>
          <p className="mt-1 text-xs tracking-wide text-zinc-500 uppercase">
            {data.soundAuthor
              ? `${data.soundAuthor} · TikTok ses`
              : "TikTok ses"}
          </p>
        </div>
        <div className="max-w-md flex-1">
          <SoundWaveform seed={data.soundName} />
        </div>
      </div>

      <div className="mt-8 rounded-xl border border-white/[0.06] bg-white/[0.015] px-2 py-6 min-[800px]:px-4">
        <div className="h-[280px] w-full min-[1100px]:h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 24, right: 12, left: -8, bottom: 0 }}
            >
              <defs>
                <linearGradient id="soundGrowthGradient" x1="0" y1="0" x2="0" y2="1">
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
                tick={{ fill: "#71717A", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={36}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="uses"
                stroke="#FF5A00"
                strokeWidth={2}
                fill="url(#soundGrowthGradient)"
              />
              <ReferenceDot
                x={startPoint.label}
                y={startPoint.uses}
                r={4}
                fill="#FF5A00"
                stroke="#09090B"
                strokeWidth={2}
              >
                <Label
                  value="Başlangıç"
                  position="top"
                  fill="#a1a1aa"
                  fontSize={11}
                  offset={8}
                />
              </ReferenceDot>
              <ReferenceDot
                x={peakPoint.label}
                y={peakPoint.uses}
                r={4}
                fill="#FF5A00"
                stroke="#09090B"
                strokeWidth={2}
              >
                <Label
                  value="Zirve"
                  position="top"
                  fill="#a1a1aa"
                  fontSize={11}
                  offset={8}
                />
              </ReferenceDot>
              <ReferenceDot
                x={currentPoint.label}
                y={currentPoint.uses}
                r={4}
                fill="#FF5A00"
                stroke="#09090B"
                strokeWidth={2}
              >
                <Label
                  value="Güncel"
                  position="top"
                  fill="#a1a1aa"
                  fontSize={11}
                  offset={8}
                />
              </ReferenceDot>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}

function MetricBlock({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-medium tracking-[0.2em] text-zinc-500 uppercase">
        {label}
      </p>
      <p
        className={`mt-2 text-2xl font-bold tracking-tight tabular-nums ${valueClassName ?? "text-white"}`}
      >
        {value}
      </p>
    </div>
  );
}
