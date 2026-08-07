"use client";

import {
  Bookmark,
  Eye,
  Heart,
  MessageCircle,
  Play,
  Share2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { ReportCreatorLink } from "@/components/report/links/report-creator-link";
import { ReportExternalLinkIcon } from "@/components/report/links/report-external-link-icon";
import { ReportVideoLink } from "@/components/report/links/report-video-link";
import {
  engagementVsCampaignAverage,
  PLATFORM_LABELS,
} from "@/lib/content-helpers";
import { formatTurkishDate, formatTurkishPercent, formatTurkishReport } from "@/lib/format";
import {
  resolveCreatorLink,
  resolveVideoLink,
} from "@/lib/report-links/resolve-report-links";
import type { Video } from "@/lib/types";
import { cn } from "@/lib/utils";

import { ReportVideoThumbnail } from "@/components/report/media/report-video-thumbnail";

import { SafeAvatar } from "./safe-media";

interface TikTokContentCardProps {
  video: Video;
  campaignAverageEngagement: number;
  showCreatorHeader?: boolean;
}

export function TikTokContentCard({
  video,
  campaignAverageEngagement,
  showCreatorHeader = true,
}: TikTokContentCardProps) {
  const vsAverage = video.hasMetrics === false
    ? 0
    : engagementVsCampaignAverage(
        video.engagementRate,
        campaignAverageEngagement
      );
  const isAboveAverage = video.hasMetrics !== false && vsAverage >= 0;
  const creatorLink = resolveCreatorLink({
    profileUrl: video.creatorProfileUrl,
    platform: video.platform,
    handle: video.creatorHandle,
  });
  const videoLink = resolveVideoLink({
    videoUrl: video.url,
    platform: video.platform,
  });

  return (
    <article className="pdf-avoid-break overflow-hidden rounded-xl border border-white/[0.07] bg-[#0C0C0E]">
      {showCreatorHeader && (
        <ReportCreatorLink
          link={creatorLink}
          className="flex items-center gap-3 border-b border-white/[0.05] px-4 py-3"
        >
          <SafeAvatar
            src={video.creatorAvatar}
            name={video.creatorName}
            seed={video.creatorHandle}
            size={32}
          />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-sm font-medium text-white">
              <span className="truncate">{video.creatorHandle}</span>
              {creatorLink && <ReportExternalLinkIcon />}
            </p>
            <p className="truncate text-xs text-zinc-500">
              {PLATFORM_LABELS[video.platform]} · Yayın:{" "}
              {formatTurkishDate(video.publishedAt)}
            </p>
          </div>
        </ReportCreatorLink>
      )}

      <div className="relative aspect-[9/16] w-full overflow-hidden bg-zinc-900">
        <ReportVideoThumbnail
          src={video.thumbnail}
          seed={video.id}
          name={video.creatorName}
          username={video.creatorHandle}
          title={video.title}
          platform={video.platform}
          sizes="(max-width: 800px) 50vw, 280px"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />

        <div className="absolute top-3 left-3">
          <span className="rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white ring-1 ring-white/15 backdrop-blur-sm">
            {PLATFORM_LABELS[video.platform]}
          </span>
        </div>

        <div className="absolute top-3 right-3">
          <div className="flex size-8 items-center justify-center rounded-full bg-black/50 ring-1 ring-white/15 backdrop-blur-sm">
            <Play className="size-3.5 fill-white text-white" />
          </div>
        </div>

        <ReportVideoLink link={videoLink} />
      </div>

      <div className="space-y-3 px-4 py-4">
        {video.title ? (
          <p className="line-clamp-2 text-sm leading-snug text-zinc-300">
            {video.title}
          </p>
        ) : null}
        {video.hasMetrics === false ? (
          <p className="text-sm text-zinc-500">Henüz metrik yok</p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-white tabular-nums">
                <Eye className="size-3.5 text-zinc-500" aria-hidden />
                {formatTurkishReport(video.views)}
              </div>
              <div
                className={cn(
                  "flex items-center gap-1 text-xs font-medium tabular-nums",
                  isAboveAverage ? "text-zinc-200" : "text-zinc-400"
                )}
                title="Kampanya ortalamasına göre etkileşim oranı"
              >
                {isAboveAverage ? (
                  <TrendingUp className="size-3" aria-hidden />
                ) : (
                  <TrendingDown className="size-3" aria-hidden />
                )}
                {formatTurkishPercent(video.engagementRate)}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 border-t border-white/[0.06] pt-3">
              <MiniMetric icon={Heart} label="Beğeni" value={formatTurkishReport(video.likes)} />
              <MiniMetric
                icon={MessageCircle}
                label="Yorum"
                value={formatTurkishReport(video.comments)}
              />
              <MiniMetric
                icon={Share2}
                label="Paylaşım"
                value={formatTurkishReport(video.shares)}
              />
              <MiniMetric
                icon={Bookmark}
                label="Kaydetme"
                value={formatTurkishReport(video.saves)}
              />
            </div>
          </>
        )}
      </div>
    </article>
  );
}

function MiniMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="text-center" title={label}>
      <Icon className="mx-auto size-3.5 text-zinc-500" />
      <p className="mt-1 text-[11px] font-medium text-zinc-300 tabular-nums">
        {value}
      </p>
    </div>
  );
}
