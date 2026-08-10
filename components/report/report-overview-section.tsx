import { CompactCountText } from "@/components/format/compact-count-text";
import { ReportKpiCard } from "@/components/report/report-kpi-card";
import { ReportSection } from "@/components/report/report-section";
import { normalizeCreatorList } from "@/features/reports/normalize-creators";
import {
  formatExactTurkishCount,
  formatTurkishPercent,
  formatTurkishReport,
} from "@/lib/format";
import type { Creator, DashboardData, KpiMetric, Video } from "@/lib/types";

function findKpi(kpis: KpiMetric[], id: string): KpiMetric | undefined {
  return kpis.find((kpi) => kpi.id === id);
}

function sumVideoMetric(
  videos: Video[],
  key: "likes" | "comments" | "shares" | "saves" | "views"
): number {
  return videos.reduce((sum, video) => sum + (Number(video[key]) || 0), 0);
}

function sumCreatorFollowers(creators: Creator[]): number {
  return creators.reduce((sum, creator) => sum + (Number(creator.followers) || 0), 0);
}

export function buildReportOverviewMetrics(
  data: Pick<DashboardData, "kpis" | "creators" | "videos" | "totalReach" | "soundGrowth">
) {
  const engagementRate = findKpi(data.kpis, "engagement-rate");
  const creatorKpi = findKpi(data.kpis, "creators");
  const videoKpi = findKpi(data.kpis, "videos-live");
  const sharesKpi = findKpi(data.kpis, "total-shares");
  const creators = normalizeCreatorList(data.creators);

  const totalViews = data.totalReach.value;
  const totalLikes = sumVideoMetric(data.videos, "likes");
  const totalComments = sumVideoMetric(data.videos, "comments");
  const totalShares = sharesKpi?.value ?? sumVideoMetric(data.videos, "shares");
  const totalSaves = sumVideoMetric(data.videos, "saves");
  const totalEngagement = totalLikes + totalComments + totalShares + totalSaves;
  const creatorCount = creatorKpi?.value ?? creators.length;
  const videoCount = videoKpi?.value ?? data.videos.length;
  const followerNetwork = sumCreatorFollowers(creators);
  const soundUses = data.soundGrowth.currentUses;

  return {
    totalViews,
    totalLikes,
    totalComments,
    totalShares,
    totalSaves,
    totalEngagement,
    engagementRate: engagementRate?.value ?? null,
    creatorCount,
    videoCount,
    followerNetwork,
    soundUses,
  };
}

export function ReportOverviewSection({
  data,
}: {
  data: Pick<
    DashboardData,
    "kpis" | "creators" | "videos" | "totalReach" | "soundGrowth"
  >;
}) {
  const metrics = buildReportOverviewMetrics(data);
  const showSound = metrics.soundUses > 0;

  return (
    <ReportSection
      id="overview"
      eyebrow="Özet"
      title="Genel Bakış"
      description="Kampanyanın birincil performans göstergeleri. Değerler mevcut rapor verisinden hesaplanır."
    >
      <div className="grid grid-cols-2 gap-3 min-[800px]:grid-cols-3 min-[1100px]:grid-cols-6">
        <ReportKpiCard
          label="Toplam İzlenme"
          value={<CompactCountText value={metrics.totalViews} />}
          exactLabel={formatExactTurkishCount(metrics.totalViews)}
          helper="Toplam erişim"
          className="col-span-2 min-[800px]:col-span-1 min-[1100px]:col-span-2"
        />
        <ReportKpiCard
          label="Toplam Etkileşim"
          value={<CompactCountText value={metrics.totalEngagement} />}
          exactLabel={formatExactTurkishCount(metrics.totalEngagement)}
          helper="Beğeni + yorum + paylaşım + kaydetme"
        />
        <ReportKpiCard
          label="Etkileşim Oranı"
          value={
            metrics.engagementRate !== null
              ? formatTurkishPercent(metrics.engagementRate)
              : "—"
          }
          exactLabel={
            metrics.engagementRate !== null
              ? formatTurkishPercent(metrics.engagementRate)
              : "Veri yok"
          }
          helper="Etkileşim / izlenme"
        />
        <ReportKpiCard
          label="İçerik Üreticisi"
          value={formatTurkishReport(metrics.creatorCount)}
          exactLabel={formatExactTurkishCount(metrics.creatorCount)}
          helper="Kampanyaya dahil"
        />
        <ReportKpiCard
          label="İçerik"
          value={formatTurkishReport(metrics.videoCount)}
          exactLabel={formatExactTurkishCount(metrics.videoCount)}
          helper="Rapor kapsamındaki video"
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 min-[800px]:grid-cols-4 min-[1100px]:grid-cols-5">
        <ReportKpiCard
          label="Beğeni"
          value={formatTurkishReport(metrics.totalLikes)}
          exactLabel={formatExactTurkishCount(metrics.totalLikes)}
          emphasis="secondary"
        />
        <ReportKpiCard
          label="Yorum"
          value={formatTurkishReport(metrics.totalComments)}
          exactLabel={formatExactTurkishCount(metrics.totalComments)}
          emphasis="secondary"
        />
        <ReportKpiCard
          label="Paylaşım"
          value={formatTurkishReport(metrics.totalShares)}
          exactLabel={formatExactTurkishCount(metrics.totalShares)}
          emphasis="secondary"
        />
        <ReportKpiCard
          label="Kaydetme"
          value={formatTurkishReport(metrics.totalSaves)}
          exactLabel={formatExactTurkishCount(metrics.totalSaves)}
          emphasis="secondary"
        />
        <ReportKpiCard
          label={showSound ? "Ses Kullanımı" : "Takipçi Ağı"}
          value={
            showSound ? (
              formatTurkishReport(metrics.soundUses)
            ) : (
              <CompactCountText value={metrics.followerNetwork} />
            )
          }
          exactLabel={
            showSound
              ? formatExactTurkishCount(metrics.soundUses)
              : formatExactTurkishCount(metrics.followerNetwork)
          }
          helper={showSound ? "Güncel kullanım" : "Toplam takipçi kitlesi"}
          emphasis="secondary"
          className="col-span-2 min-[800px]:col-span-4 min-[1100px]:col-span-1"
        />
      </div>
    </ReportSection>
  );
}
