import { ReportCreatorLink } from "@/components/report/links/report-creator-link";
import { ReportExternalLinkIcon } from "@/components/report/links/report-external-link-icon";
import { CompactCountText } from "@/components/format/compact-count-text";
import {
  formatTurkishDate,
  formatTurkishPercent,
  formatTurkishReport,
} from "@/lib/format";
import {
  CREATOR_CATEGORY_LABELS,
  engagementVsCampaignAverage,
} from "@/lib/content-helpers";
import { resolveCreatorLink } from "@/lib/report-links/resolve-report-links";
import type { Creator, Video } from "@/lib/types";

import { SafeAvatar } from "./safe-media";

interface FeaturedContentMetricsProps {
  video: Video;
  creator: Creator | undefined;
  campaignAverageEngagement: number;
}

export function FeaturedContentMetrics({
  video,
  creator,
  campaignAverageEngagement,
}: FeaturedContentMetricsProps) {
  const engagementRate = creator?.engagementRate ?? video.engagementRate;
  const vsAverage = engagementVsCampaignAverage(
    engagementRate,
    campaignAverageEngagement
  );

  const creatorLink = resolveCreatorLink({
    profileUrl: creator?.profileUrl ?? video.creatorProfileUrl,
    platform: creator?.platform ?? video.platform,
    handle: video.creatorHandle,
  });

  return (
    <div className="flex flex-col justify-center py-4 min-[800px]:py-0">
      <ReportCreatorLink link={creatorLink} className="flex items-center gap-3">
        <SafeAvatar
          src={video.creatorAvatar}
          name={video.creatorName}
          seed={video.id}
          size={44}
        />
        <div>
          <p className="flex items-center gap-1.5 text-base font-semibold text-white">
            {video.creatorHandle}
            {creatorLink && <ReportExternalLinkIcon />}
          </p>
          <p className="mt-0.5 text-sm text-zinc-400">
            <CompactCountText
              value={creator?.followers ?? 0}
              showNoun
            />
            {creator && (
              <>
                {" · "}
                {CREATOR_CATEGORY_LABELS[creator.category]}
              </>
            )}
          </p>
        </div>
      </ReportCreatorLink>

      <p className="mt-5 text-sm text-zinc-500">
        Yayın Tarihi:{" "}
        <span className="text-zinc-300">{formatTurkishDate(video.publishedAt)}</span>
      </p>

      <div className="mt-8 grid grid-cols-1 gap-8 min-[800px]:grid-cols-2 min-[800px]:gap-12">
        <div>
          <p className="text-[10px] font-medium tracking-[0.22em] text-zinc-500 uppercase">
            İzlenme
          </p>
          <p className="mt-2 text-[40px] leading-none font-bold tracking-tight text-white tabular-nums min-[800px]:text-[48px]">
            {formatTurkishReport(video.views)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-medium tracking-[0.22em] text-zinc-500 uppercase">
            Etkileşim Oranı
          </p>
          <p className="mt-2 text-[40px] leading-none font-bold tracking-tight text-white tabular-nums min-[800px]:text-[48px]">
            {formatTurkishPercent(engagementRate)}
          </p>
          <p className="mt-2 text-sm text-[#FF5A00]">
            Kampanya ortalamasının %{Math.round(vsAverage).toLocaleString("tr-TR")}{" "}
            üzerinde
          </p>
        </div>
      </div>

      <div className="mt-10 grid grid-cols-2 border-t border-white/[0.06] min-[800px]:grid-cols-4">
        <MetricCell label="Beğeni" value={formatTurkishReport(video.likes)} />
        <MetricCell
          label="Yorum"
          value={formatTurkishReport(video.comments)}
          bordered
        />
        <MetricCell
          label="Paylaşım"
          value={formatTurkishReport(video.shares)}
          bordered
        />
        <MetricCell
          label="Kaydetme"
          value={formatTurkishReport(video.saves)}
          bordered
        />
      </div>
    </div>
  );
}

function MetricCell({
  label,
  value,
  bordered = false,
}: {
  label: string;
  value: string;
  bordered?: boolean;
}) {
  return (
    <div
      className={`px-3 py-5 text-center min-[800px]:px-4 ${
        bordered ? "border-l border-white/[0.06]" : ""
      }`}
    >
      <p className="text-[10px] tracking-[0.18em] text-zinc-500 uppercase">
        {label}
      </p>
      <p className="mt-2 text-lg font-bold text-white tabular-nums">{value}</p>
    </div>
  );
}
