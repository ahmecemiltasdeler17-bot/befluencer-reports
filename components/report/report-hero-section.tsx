import type { ReportFreshness } from "@/features/reports/types";
import type { DashboardData } from "@/lib/types";

import type { ReportPresentationContext } from "./report-presentation";
import { ReportHeader } from "./report-header";
import { ReportKpiStrip } from "./report-kpi-strip";
import { TotalReachHero } from "./total-reach-hero";

interface ReportHeroSectionProps {
  data: Pick<
    DashboardData,
    "campaign" | "totalReach" | "kpis" | "creators" | "videos" | "soundGrowth"
  >;
  reportNumber?: string;
  reportDate?: string;
  freshness?: ReportFreshness;
  presentationContext?: ReportPresentationContext;
  versionLabel?: string;
}

export function ReportHeroSection({
  data,
  reportNumber,
  reportDate,
  freshness,
  presentationContext,
  versionLabel,
}: ReportHeroSectionProps) {
  const avatarCreators = data.creators.map((creator) => ({
    id: creator.id,
    avatar: creator.avatar,
    name: creator.displayName,
    handle: creator.handle,
    platform: creator.platform,
    profileUrl: creator.profileUrl,
  }));

  const soundName =
    data.soundGrowth.soundName?.trim() || data.campaign.track?.trim() || "";
  const soundAuthor =
    data.soundGrowth.soundAuthor?.trim() || data.campaign.artist?.trim() || "";
  const subtitle = [soundAuthor, soundName].filter(Boolean).join(" · ") || null;

  return (
    <div className="report-cover w-full">
      <div className="report-cover__glow" aria-hidden="true" />

      <ReportHeader
        campaign={data.campaign}
        reportNumber={reportNumber}
        reportDate={reportDate}
        freshness={freshness}
        presentationContext={presentationContext}
        versionLabel={versionLabel}
        soundGrowth={data.soundGrowth}
      />

      <TotalReachHero
        totalReach={data.totalReach}
        creators={avatarCreators}
        campaignTitle={data.campaign.name}
        subtitle={subtitle}
      />

      <div className="relative z-[1] mt-10 border-t border-white/[0.06] pt-8 pb-2 min-[1100px]:mt-12">
        <p className="mb-5 text-center text-[11px] font-medium tracking-[0.2em] text-zinc-500 uppercase">
          Genel Bakış
        </p>
        <ReportKpiStrip data={data} />
      </div>
    </div>
  );
}
