"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import {
  formatTurkishPercent,
  formatTurkishReport,
} from "@/lib/format";
import type { KpiMetric, Video } from "@/lib/types";

const ENGAGEMENT_COLORS = {
  likes: "#FF5A00",
  comments: "#F472B6",
  shares: "#A78BFA",
  saves: "#22D3EE",
} as const;

interface EngagementDistributionProps {
  videos: Video[];
  kpis: KpiMetric[];
}

interface EngagementSlice {
  key: keyof typeof ENGAGEMENT_COLORS;
  label: string;
  value: number;
  color: string;
}

function sumVideoMetric(
  videos: Video[],
  key: "likes" | "comments" | "shares" | "saves"
): number {
  return videos.reduce((sum, video) => sum + video[key], 0);
}

function buildEngagementData(
  videos: Video[]
): EngagementSlice[] {
  const likes = sumVideoMetric(videos, "likes");
  const comments = sumVideoMetric(videos, "comments");
  const shares = sumVideoMetric(videos, "shares");
  const saves = sumVideoMetric(videos, "saves");

  return [
    { key: "likes", label: "Beğeni", value: likes, color: ENGAGEMENT_COLORS.likes },
    {
      key: "comments",
      label: "Yorum",
      value: comments,
      color: ENGAGEMENT_COLORS.comments,
    },
    {
      key: "shares",
      label: "Paylaşım",
      value: shares,
      color: ENGAGEMENT_COLORS.shares,
    },
    { key: "saves", label: "Kaydetme", value: saves, color: ENGAGEMENT_COLORS.saves },
  ];
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: EngagementSlice }>;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;

  return (
    <div className="rounded-lg border border-white/10 bg-[#18181B] px-3 py-2 shadow-xl">
      <p className="text-sm font-medium text-white">{item.label}</p>
      <p className="text-xs text-zinc-400 tabular-nums">
        {formatTurkishReport(item.value)}
      </p>
    </div>
  );
}

export function EngagementDistribution({
  videos,
  kpis,
}: EngagementDistributionProps) {
  const data = buildEngagementData(videos);
  const totalEngagement = data.reduce((sum, item) => sum + item.value, 0);
  const engagementRate = kpis.find((kpi) => kpi.id === "engagement-rate");

  if (totalEngagement <= 0) {
    return (
      <section aria-label="Etkileşim dağılımı" className="w-full">
        <h3 className="text-[11px] font-medium tracking-[0.24em] text-zinc-500 uppercase">
          Etkileşim Dağılımı
        </h3>
        <div className="mt-8 rounded-xl border border-white/[0.06] px-6 py-12 text-center">
          <p className="text-sm text-zinc-500">
            Etkileşim verisi henüz kaydedilmedi.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Etkileşim dağılımı" className="w-full">
      <h3 className="text-[11px] font-medium tracking-[0.24em] text-zinc-500 uppercase">
        Etkileşim Dağılımı
      </h3>

      <div className="mt-8 flex flex-col items-center gap-8 min-[1000px]:flex-row min-[1000px]:items-start">
        <div className="h-[220px] w-[220px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={62}
                outerRadius={88}
                paddingAngle={2}
                stroke="none"
              >
                {data.map((entry) => (
                  <Cell key={entry.key} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="w-full flex-1 space-y-5">
          {data.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between gap-4 border-b border-white/[0.04] pb-4 last:border-b-0 last:pb-0"
            >
              <div className="flex items-center gap-3">
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm text-zinc-300">{item.label}</span>
              </div>
              <span className="text-sm font-semibold text-white tabular-nums">
                {formatTurkishReport(item.value)}
              </span>
            </div>
          ))}

          <div className="space-y-3 border-t border-white/[0.06] pt-5">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-zinc-400">Ortalama etkileşim oranı</span>
              <span className="font-semibold text-white tabular-nums">
                {engagementRate
                  ? formatTurkishPercent(engagementRate.value)
                  : "%7,2"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-zinc-400">Toplam etkileşim</span>
              <span className="font-semibold text-white tabular-nums">
                {formatTurkishReport(totalEngagement)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
