import type { ReactNode } from "react";
import {
  Bookmark,
  Eye,
  Heart,
  MessageCircle,
  Music2,
  Share2,
  Users,
  Video,
  Activity,
} from "lucide-react";

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
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  group: "performance" | "scale" | "engagement" | "audio";
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
      hint: "Kampanya ortalaması etkileşim oranı",
      icon: Activity,
      group: "performance",
    },
    {
      label: "İçerik Üreticisi",
      value: formatTurkishReport(metrics.creatorCount),
      exactLabel: formatExactTurkishCount(metrics.creatorCount),
      hint: "Kampanyadaki içerik üreticisi sayısı",
      icon: Users,
      group: "scale",
    },
    {
      label: "İçerik",
      value: formatTurkishReport(metrics.videoCount),
      exactLabel: formatExactTurkishCount(metrics.videoCount),
      hint: "Kampanyadaki video sayısı",
      icon: Video,
      group: "scale",
    },
    {
      label: "Takipçi Ağı",
      value: <CompactCountText value={metrics.followerNetwork} />,
      exactLabel: formatExactTurkishCount(metrics.followerNetwork),
      hint: "İçerik üreticilerinin toplam takipçi ağı",
      icon: Eye,
      group: "scale",
    },
    {
      label: "Beğeni",
      value: formatTurkishReport(metrics.totalLikes),
      exactLabel: formatExactTurkishCount(metrics.totalLikes),
      hint: "Tüm içeriklerdeki toplam beğeni",
      icon: Heart,
      group: "engagement",
    },
    {
      label: "Yorum",
      value: formatTurkishReport(metrics.totalComments),
      exactLabel: formatExactTurkishCount(metrics.totalComments),
      hint: "Tüm içeriklerdeki toplam yorum",
      icon: MessageCircle,
      group: "engagement",
    },
    {
      label: "Paylaşım",
      value: formatTurkishReport(metrics.totalShares),
      exactLabel: formatExactTurkishCount(metrics.totalShares),
      hint: "Tüm içeriklerdeki toplam paylaşım",
      icon: Share2,
      group: "engagement",
    },
    {
      label: "Kaydetme",
      value: formatTurkishReport(metrics.totalSaves),
      exactLabel: formatExactTurkishCount(metrics.totalSaves),
      hint: "Tüm içeriklerdeki toplam kaydetme",
      icon: Bookmark,
      group: "engagement",
    },
  ];

  if (metrics.soundUses > 0) {
    items.push({
      label: "Ses Kullanımı",
      value: formatTurkishReport(metrics.soundUses),
      exactLabel: formatExactTurkishCount(metrics.soundUses),
      hint: "Kampanya sesinin güncel kullanım sayısı",
      icon: Music2,
      group: "audio",
    });
  }

  return (
    <div
      className="report-kpi-strip"
      data-report-kpi-strip=""
      aria-label="Özet metrikler"
    >
      {items.map((item, index) => {
        const Icon = item.icon;
        return (
          <div
            key={item.label}
            className={cn(
              "report-kpi-strip__item report-interactive pdf-avoid-break group/kpi",
              index > 0 && "report-kpi-strip__item--divided"
            )}
            data-kpi-group={item.group}
            title={item.hint}
          >
            <div className="flex items-center justify-center gap-1.5">
              <Icon
                className="size-3 text-[var(--report-steel)] transition-colors group-hover/kpi:text-[var(--report-accent)]"
                aria-hidden
              />
              <p className="text-[10px] font-medium tracking-[0.12em] text-[var(--report-text-tertiary)] uppercase">
                {item.label}
              </p>
            </div>
            <p
              className="mt-3 text-[26px] font-semibold tracking-tight text-[var(--report-text)] tabular-nums transition-colors group-hover/kpi:text-[var(--report-accent-soft)] min-[1100px]:text-[28px]"
              aria-label={`${item.label}: ${item.exactLabel}`}
            >
              {item.value}
            </p>
            <p className="report-kpi-strip__hint mt-1.5 text-[10px] leading-snug text-[var(--report-text-tertiary)] opacity-0 transition-opacity group-hover/kpi:opacity-100 group-focus-within/kpi:opacity-100">
              {item.hint}
            </p>
          </div>
        );
      })}
    </div>
  );
}
