import type { ReactNode } from "react";

import { CompactCountText } from "@/components/format/compact-count-text";
import { buildReportOverviewMetrics } from "@/components/report/report-overview-section";
import {
  formatExactTurkishCount,
  formatTurkishPercent,
  formatTurkishReport,
} from "@/lib/format";
import type { DashboardData } from "@/lib/types";
import { cn } from "@/lib/utils";

type StripItem = {
  label: string;
  value: ReactNode;
  exactLabel: string;
};

/**
 * Editorial secondary metric strip under the hero creator showcase.
 * Presentation-only; values come from existing overview metrics.
 */
export function ReportKpiStrip({
  data,
}: {
  data: Pick<
    DashboardData,
    "kpis" | "creators" | "videos" | "totalReach" | "soundGrowth"
  >;
}) {
  const metrics = buildReportOverviewMetrics(data);

  const items: StripItem[] = [
    {
      label: "Etkileşim Oranı",
      value:
        metrics.engagementRate !== null
          ? formatTurkishPercent(metrics.engagementRate)
          : "—",
      exactLabel:
        metrics.engagementRate !== null
          ? formatTurkishPercent(metrics.engagementRate)
          : "Veri yok",
    },
    {
      label: "İçerik Üreticisi",
      value: formatTurkishReport(metrics.creatorCount),
      exactLabel: formatExactTurkishCount(metrics.creatorCount),
    },
    {
      label: "İçerik",
      value: formatTurkishReport(metrics.videoCount),
      exactLabel: formatExactTurkishCount(metrics.videoCount),
    },
    {
      label: "Takipçi Ağı",
      value: <CompactCountText value={metrics.followerNetwork} />,
      exactLabel: formatExactTurkishCount(metrics.followerNetwork),
    },
    {
      label: "Beğeni",
      value: formatTurkishReport(metrics.totalLikes),
      exactLabel: formatExactTurkishCount(metrics.totalLikes),
    },
    {
      label: "Yorum",
      value: formatTurkishReport(metrics.totalComments),
      exactLabel: formatExactTurkishCount(metrics.totalComments),
    },
    {
      label: "Paylaşım",
      value: formatTurkishReport(metrics.totalShares),
      exactLabel: formatExactTurkishCount(metrics.totalShares),
    },
    {
      label: "Kaydetme",
      value: formatTurkishReport(metrics.totalSaves),
      exactLabel: formatExactTurkishCount(metrics.totalSaves),
    },
  ];

  if (metrics.soundUses > 0) {
    items.push({
      label: "Ses Kullanımı",
      value: formatTurkishReport(metrics.soundUses),
      exactLabel: formatExactTurkishCount(metrics.soundUses),
    });
  }

  return (
    <div
      className="report-kpi-strip"
      data-report-kpi-strip=""
      aria-label="Özet metrikler"
    >
      {items.map((item, index) => (
        <div
          key={item.label}
          className={cn(
            "report-kpi-strip__item pdf-avoid-break",
            index > 0 && "report-kpi-strip__item--divided"
          )}
        >
          <p className="text-[10px] font-medium tracking-[0.16em] text-zinc-500 uppercase">
            {item.label}
          </p>
          <p
            className="mt-2 text-[20px] font-semibold tracking-tight text-white tabular-nums min-[1100px]:text-[22px]"
            title={item.exactLabel}
            aria-label={`${item.label}: ${item.exactLabel}`}
          >
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}
