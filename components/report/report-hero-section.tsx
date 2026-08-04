import type { Creator, DashboardData, KpiMetric, Video } from "@/lib/types";
import {
  formatTurkishPercent,
  formatTurkishReport,
} from "@/lib/format";

import { ReportAccentDivider } from "./report-accent-divider";
import { ReportHeader } from "./report-header";
import { ReportKpiGrid, type ReportKpi } from "./report-kpi-grid";
import { TotalReachHero } from "./total-reach-hero";

function findKpi(kpis: KpiMetric[], id: string): KpiMetric | undefined {
  return kpis.find((kpi) => kpi.id === id);
}

function sumVideoMetric(videos: Video[], key: "likes" | "comments" | "shares" | "saves"): number {
  return videos.reduce((sum, video) => sum + video[key], 0);
}

function sumCreatorFollowers(creators: Creator[]): number {
  return creators.reduce((sum, creator) => sum + creator.followers, 0);
}

function buildKpiRows(
  data: Pick<DashboardData, "kpis" | "creators" | "videos">
): ReportKpi[][] {
  const engagementRate = findKpi(data.kpis, "engagement-rate");
  const creators = findKpi(data.kpis, "creators");
  const videos = findKpi(data.kpis, "videos-live");
  const totalShares = findKpi(data.kpis, "total-shares");

  const totalLikes = sumVideoMetric(data.videos, "likes");
  const totalComments = sumVideoMetric(data.videos, "comments");
  const creatorAudience = sumCreatorFollowers(data.creators);
  const totalSaves = sumVideoMetric(data.videos, "saves");

  return [
    [
      {
        label: "Etkileşim Oranı",
        value: engagementRate
          ? formatTurkishPercent(engagementRate.value)
          : "%7,2",
        hint: "Etkileşim / izlenme",
      },
      {
        label: "İçerik Üreticisi",
        value: creators ? String(creators.value) : "23",
        hint: "Kampanyaya dahil",
      },
      {
        label: "İçerik",
        value: videos ? String(videos.value) : "47",
        hint: "Yayında",
      },
      {
        label: "Takipçi Ağı",
        value: formatTurkishReport(creatorAudience),
        hint: "Toplam takipçi kitlesi",
      },
    ],
    [
      {
        label: "Beğeni",
        value: formatTurkishReport(totalLikes),
      },
      {
        label: "Yorum",
        value: formatTurkishReport(totalComments),
      },
      {
        label: "Paylaşım",
        value: totalShares
          ? formatTurkishReport(totalShares.value)
          : formatTurkishReport(156_800),
      },
      {
        label: "Kaydetme",
        value: formatTurkishReport(totalSaves),
      },
    ],
  ];
}

interface ReportHeroSectionProps {
  data: Pick<
    DashboardData,
    "campaign" | "totalReach" | "kpis" | "creators" | "videos"
  >;
}

export function ReportHeroSection({ data }: ReportHeroSectionProps) {
  const avatarCreators = data.creators.map((creator) => ({
    id: creator.id,
    avatar: creator.avatar,
    name: creator.displayName,
  }));

  const creatorCount =
    findKpi(data.kpis, "creators")?.value ?? data.creators.length;
  const maxVisible = 11;
  const overflowCount = Math.max(creatorCount - maxVisible, 0);

  return (
    <div className="w-full">
      <ReportHeader campaign={data.campaign} />

      <TotalReachHero
        totalReach={data.totalReach}
        creators={avatarCreators}
        overflowCount={overflowCount}
      />

      <ReportAccentDivider />

      <ReportKpiGrid rows={buildKpiRows(data)} />
    </div>
  );
}
