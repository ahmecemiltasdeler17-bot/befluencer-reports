"use client";

import { useState } from "react";
import {
  Pie,
  PieChart,
  ResponsiveContainer,
  Sector,
  type PieSectorShapeProps,
} from "recharts";

import { REPORT_THEME } from "@/components/report/report-theme";
import { formatTurkishPercent, formatTurkishReport } from "@/lib/format";
import type { KpiMetric, Video } from "@/lib/types";

const ENGAGEMENT_COLORS = REPORT_THEME.engagement;

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

function buildEngagementData(videos: Video[]): EngagementSlice[] {
  const likes = sumVideoMetric(videos, "likes");
  const comments = sumVideoMetric(videos, "comments");
  const shares = sumVideoMetric(videos, "shares");
  const saves = sumVideoMetric(videos, "saves");

  return [
    {
      key: "likes",
      label: "Beğeni",
      value: likes,
      color: ENGAGEMENT_COLORS.likes,
    },
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
    {
      key: "saves",
      label: "Kaydetme",
      value: saves,
      color: ENGAGEMENT_COLORS.saves,
    },
  ];
}

/** Recharts wraps the datum differently across chart types. */
function resolveSlice(payload: unknown): EngagementSlice | null {
  const candidate = payload as { payload?: unknown } | undefined;
  const item = (candidate?.payload ?? candidate) as
    | EngagementSlice
    | undefined;
  return item && typeof item.key === "string" ? item : null;
}

export function EngagementDistribution({
  videos,
  kpis,
}: EngagementDistributionProps) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const data = buildEngagementData(videos);
  const totalEngagement = data.reduce((sum, item) => sum + item.value, 0);
  const engagementRate = kpis.find((kpi) => kpi.id === "engagement-rate");

  if (totalEngagement <= 0) {
    return (
      <section aria-label="Etkileşim dağılımı" className="w-full">
        <h3 className="text-[11px] font-medium tracking-[0.16em] text-[var(--report-text-tertiary)] uppercase">
          Etkileşim Dağılımı
        </h3>
        <div className="report-empty-panel mt-8 px-6 py-12 text-center">
          <p className="text-sm text-[var(--report-text-tertiary)]">
            Etkileşim verisi henüz kaydedilmedi.
          </p>
        </div>
      </section>
    );
  }

  const activeSlice = data.find((item) => item.key === activeKey) ?? null;
  const activeShare = activeSlice
    ? (activeSlice.value / totalEngagement) * 100
    : null;

  /**
   * Only the drawn radius/opacity changes on hover — the angle of every
   * segment stays exactly proportional to its real value.
   */
  function renderSector(props: PieSectorShapeProps) {
    const slice = resolveSlice(props.payload);
    const isActive = slice !== null && slice.key === activeKey;
    const dimmed = activeKey !== null && !isActive;

    return (
      <Sector
        cx={props.cx}
        cy={props.cy}
        innerRadius={props.innerRadius}
        outerRadius={props.outerRadius + (isActive ? 4 : 0)}
        startAngle={props.startAngle}
        endAngle={props.endAngle}
        fill={slice?.color ?? props.fill}
        opacity={dimmed ? 0.42 : 1}
      />
    );
  }

  return (
    <section aria-label="Etkileşim dağılımı" className="w-full">
      <h3 className="text-[11px] font-medium tracking-[0.16em] text-[var(--report-text-tertiary)] uppercase">
        Etkileşim Dağılımı
      </h3>

      <div className="report-chart-panel mt-7 flex flex-col items-center gap-8 px-4 py-6 min-[560px]:flex-row min-[560px]:items-center min-[560px]:gap-7 min-[560px]:px-6">
        <div className="relative h-[200px] w-[200px] shrink-0">
          <div className="report-chart-panel__plot h-full w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={82}
                  paddingAngle={2.5}
                  stroke="none"
                  isAnimationActive={false}
                  shape={renderSector}
                  onMouseEnter={(_, index) =>
                    setActiveKey(data[index]?.key ?? null)
                  }
                  onMouseLeave={() => setActiveKey(null)}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <p className="text-[10px] tracking-[0.14em] text-[var(--report-text-tertiary)] uppercase">
              {activeSlice ? activeSlice.label : "Toplam"}
            </p>
            <p className="mt-1 text-base font-semibold text-[var(--report-text)] tabular-nums">
              {formatTurkishReport(
                activeSlice ? activeSlice.value : totalEngagement
              )}
            </p>
            {activeShare !== null ? (
              <p className="mt-0.5 text-[11px] text-[var(--report-accent-soft)] tabular-nums">
                {formatTurkishPercent(activeShare)}
              </p>
            ) : null}
          </div>
        </div>

        <div className="w-full flex-1 space-y-1.5">
          {data.map((item) => (
            <button
              key={item.key}
              type="button"
              className="report-legend-row report-interactive report-focus-ring flex items-center justify-between gap-4"
              data-print-keep="true"
              data-active={activeKey === item.key ? "true" : "false"}
              data-dimmed={
                activeKey !== null && activeKey !== item.key ? "true" : "false"
              }
              onMouseEnter={() => setActiveKey(item.key)}
              onMouseLeave={() => setActiveKey(null)}
              onFocus={() => setActiveKey(item.key)}
              onBlur={() => setActiveKey(null)}
              aria-label={`${item.label}: ${formatTurkishReport(item.value)}`}
            >
              <span className="flex min-w-0 items-center gap-3">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="truncate text-sm text-[var(--report-text-secondary)]">
                  {item.label}
                </span>
              </span>
              <span className="shrink-0 text-sm font-semibold text-[var(--report-text)] tabular-nums">
                {formatTurkishReport(item.value)}
              </span>
            </button>
          ))}

          <div className="space-y-3 border-t border-[var(--report-border)] pt-4">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-[var(--report-text-secondary)]">
                Ortalama etkileşim oranı
              </span>
              <span className="font-semibold text-[var(--report-text)] tabular-nums">
                {engagementRate
                  ? formatTurkishPercent(engagementRate.value)
                  : "%7,2"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-[var(--report-text-secondary)]">
                Toplam etkileşim
              </span>
              <span className="font-semibold text-[var(--report-text)] tabular-nums">
                {formatTurkishReport(totalEngagement)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
