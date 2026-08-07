import Link from "next/link";
import { notFound } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { CampaignSectionNav } from "@/features/campaigns/components/campaign-section-nav";
import { CreatorAvatar } from "@/features/creators/components/creator-avatar";
import { CreatorPlatformBadge } from "@/features/creators/components/creator-platform-badge";
import {
  buildVideoMetricHistory,
  getVideoMetricSummary,
} from "@/features/metrics/queries";
import { VideoMetricHistory } from "@/features/metrics/components/video-metric-history";
import { VideoMetricSummaryPanel } from "@/features/metrics/components/video-metric-summary";
import { SyncStatusBadge } from "@/features/sync/components/sync-status-badge";
import { SyncVideoButton } from "@/features/sync/components/sync-video-button";
import { DeleteVideoButton } from "@/features/videos/components/delete-video-button";
import { VideoStatusBadge } from "@/features/videos/components/video-status-badge";
import { VideoSyncStatusBadge } from "@/features/videos/components/video-sync-status-badge";
import { getVideoById } from "@/features/videos/queries";
import { formatTurkishDate } from "@/lib/format";
import { isTikTokSyncConfigured } from "@/lib/env.server";
import { cn } from "@/lib/utils";

function formatDateTime(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function CampaignVideoDetailPage({
  params,
}: {
  params: Promise<{ id: string; videoId: string }>;
}) {
  const { id, videoId } = await params;
  const video = await getVideoById(videoId);

  if (!video || video.campaign_id !== id) {
    notFound();
  }

  const [summary, history] = await Promise.all([
    getVideoMetricSummary(videoId),
    buildVideoMetricHistory(videoId),
  ]);

  const syncConfigured = isTikTokSyncConfigured();
  const lastSuccessfulSync =
    video.sync_status === "success" ? video.last_synced_at : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href={`/campaigns/${id}#videos`}
            className="text-sm text-zinc-400 transition-colors hover:text-white"
          >
            ← Videolara dön
          </Link>
          <h1 className="mt-3 text-2xl font-semibold text-white">Video Detayı</h1>
          <p className="mt-1 text-sm text-zinc-400">{video.campaign.name}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/campaigns/${id}/videos/${video.id}/edit`}
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Düzenle
          </Link>
          <DeleteVideoButton campaignId={id} videoId={video.id} />
        </div>
      </div>

      <CampaignSectionNav campaignId={id} activeSection="videos" />

      <section className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-medium text-white">
              TikTok Senkronizasyonu
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <span className="text-zinc-500">Durum:</span>
              <SyncStatusBadge status={video.sync_status} />
              <span className="text-zinc-500">Son başarılı senkron:</span>
              <span className="text-zinc-200">
                {formatDateTime(lastSuccessfulSync)}
              </span>
            </div>
          </div>
          <SyncVideoButton
            campaignId={id}
            videoId={videoId}
            platform={video.platform}
            syncConfigured={syncConfigured}
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <DetailCard title="Video Bilgileri">
          <DetailRow
            label="İçerik üreticisi"
            value={
              <div className="flex items-center gap-3">
                <CreatorAvatar
                  username={video.creator.username}
                  displayName={video.creator.display_name}
                  avatarUrl={video.creator.avatar_url}
                  size="sm"
                />
                <span>@{video.creator.username}</span>
              </div>
            }
          />
          <DetailRow label="Kampanya" value={video.campaign.name} />
          <DetailRow
            label="Platform"
            value={<CreatorPlatformBadge platform={video.platform} />}
          />
          <DetailRow
            label="Durum"
            value={<VideoStatusBadge status={video.status} />}
          />
          <DetailRow
            label="Senkron durumu"
            value={<VideoSyncStatusBadge status={video.sync_status} />}
          />
        </DetailCard>

        <DetailCard title="Bağlantılar ve Tarihler">
          <DetailRow
            label="Video URL"
            value={
              <a
                href={video.video_url}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-orange-400 hover:text-orange-300"
              >
                {video.video_url}
              </a>
            }
          />
          <DetailRow
            label="Thumbnail"
            value={
              video.thumbnail_url ? (
                <div className="space-y-2">
                  <div className="relative aspect-[9/16] w-24 overflow-hidden rounded-md border border-zinc-800 bg-zinc-900">
                    {/* eslint-disable-next-line @next/next/no-img-element -- management preview of stored CDN URL */}
                    <img
                      src={video.thumbnail_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <a
                    href={video.thumbnail_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-orange-400 hover:text-orange-300"
                  >
                    Görseli aç
                  </a>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-amber-400">Thumbnail bulunamadı</p>
                  {video.platform === "tiktok" && (
                    <p className="text-xs text-zinc-500">
                      Senkronize ederek görseli yenile
                    </p>
                  )}
                </div>
              )
            }
          />
          <DetailRow
            label="Video ID"
            value={video.platform_video_id ?? "—"}
          />
          <DetailRow
            label="Yayın tarihi"
            value={formatTurkishDate(video.published_at ?? video.created_at)}
          />
          <DetailRow
            label="Son senkron"
            value={formatDateTime(video.last_synced_at)}
          />
          <DetailRow
            label="Oluşturulma"
            value={formatDateTime(video.created_at)}
          />
          <DetailRow
            label="Son güncelleme"
            value={formatDateTime(video.updated_at)}
          />
        </DetailCard>
      </div>

      <section className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-6">
        <h2 className="text-base font-medium text-white">Açıklama</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-300">
          {video.caption?.trim() ? video.caption : "—"}
        </p>
      </section>

      <VideoMetricSummaryPanel
        campaignId={id}
        videoId={videoId}
        summary={summary}
      />

      <VideoMetricHistory rows={history} />
    </div>
  );
}

function DetailCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-6">
      <h2 className="text-base font-medium text-white">{title}</h2>
      <dl className="mt-4 space-y-3">{children}</dl>
    </section>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="grid gap-1 sm:grid-cols-[140px_1fr] sm:gap-4">
      <dt className="text-sm text-zinc-500">{label}</dt>
      <dd className="text-sm text-zinc-200">{value}</dd>
    </div>
  );
}
