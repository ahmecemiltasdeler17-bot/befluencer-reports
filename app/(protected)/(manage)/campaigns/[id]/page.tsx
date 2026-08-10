import Link from "next/link";
import { notFound } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { ArchiveCampaignButton } from "@/features/campaigns/components/archive-campaign-button";
import { CampaignSectionNav } from "@/features/campaigns/components/campaign-section-nav";
import { CampaignStatusBadge } from "@/features/campaigns/components/campaign-status-badge";
import { getCampaignById } from "@/features/campaigns/queries";
import { SyncCampaignCreatorsButton } from "@/features/creator-sync/components/sync-campaign-creators-button";
import { listCampaignCreatorSyncSummaries } from "@/features/creator-sync/queries";
import { CampaignCreatorList } from "@/features/creators/components/campaign-creator-list";
import { listCampaignCreators } from "@/features/creators/queries";
import { CampaignReportSection } from "@/features/report-generation/components/campaign-report-section";
import { getCampaignReportSeriesSummary } from "@/features/report-generation/queries";
import { SyncCampaignButton } from "@/features/sync/components/sync-campaign-button";
import { SyncHistory } from "@/features/sync/components/sync-history";
import { listCampaignSyncJobs } from "@/features/sync/queries";
import { ImportCampaignVideosDialog } from "@/features/video-import/components/import-campaign-videos-dialog";
import { CampaignVideoList } from "@/features/videos/components/campaign-video-list";
import { listCampaignVideos } from "@/features/videos/queries";
import {
  getCampaignCreatorMetricSummary,
  getCampaignMetricSummary,
  getCampaignMetricTimeline,
} from "@/features/metrics/queries";
import { CampaignMetricSummaryPanel } from "@/features/metrics/components/campaign-metric-summary";
import { CampaignMetricTimeline } from "@/features/metrics/components/campaign-metric-timeline";
import { CreatorContributionTable } from "@/features/metrics/components/creator-contribution-table";
import { CampaignSoundTrackingSection } from "@/features/sound-sync/components/campaign-sound-tracking-section";
import {
  getCampaignSoundConfiguration,
  getSoundMetricSummary,
  listSoundMetricSnapshots,
} from "@/features/sound-sync/queries";
import { formatTurkishDate } from "@/lib/format";
import {
  isTikTokSoundSyncConfigured,
  isTikTokSyncConfigured,
} from "@/lib/env.server";
import { cn } from "@/lib/utils";

function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }

  return formatTurkishDate(value);
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [
    campaign,
    assignments,
    videos,
    metricSummary,
    creatorMetrics,
    metricTimeline,
    soundSummary,
    soundHistory,
    clusterSoundHistory,
    soundConfiguration,
    syncJobs,
    reportSummary,
    creatorSyncSummaries,
  ] = await Promise.all([
    getCampaignById(id),
    listCampaignCreators(id),
    listCampaignVideos(id),
    getCampaignMetricSummary(id),
    getCampaignCreatorMetricSummary(id),
    getCampaignMetricTimeline(id),
    getSoundMetricSummary(id, "original"),
    listSoundMetricSnapshots(id, "original"),
    listSoundMetricSnapshots(id, "cluster"),
    getCampaignSoundConfiguration(id),
    listCampaignSyncJobs(id),
    getCampaignReportSeriesSummary(id),
    listCampaignCreatorSyncSummaries(id),
  ]);

  if (!campaign) {
    notFound();
  }

  const tiktokVideoCount = videos.filter(
    (video) => video.platform === "tiktok" && video.status !== "unavailable"
  ).length;
  const syncConfigured = isTikTokSyncConfigured();
  const soundSyncConfigured = isTikTokSoundSyncConfigured();
  const tiktokCreatorCount = new Set(
    assignments
      .filter((assignment) => assignment.creator.platform === "tiktok")
      .map((assignment) => assignment.creator_id)
  ).size;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/campaigns"
            className="text-sm text-bf-steel transition-colors hover:text-bf-text"
          >
            ← Kampanyalara dön
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-bf-text">
              {campaign.name}
            </h1>
            <CampaignStatusBadge status={campaign.status} />
          </div>
          <p className="mt-1 text-sm text-bf-steel">
            {campaign.artist_name} — {campaign.track_name}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/campaigns/${campaign.id}/report`}
            className={cn(buttonVariants({ variant: "default" }))}
          >
            Canlı Raporu Aç
          </Link>
          <Link
            href={`/campaigns/${campaign.id}/edit`}
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Düzenle
          </Link>
          {campaign.status !== "archived" ? (
            <ArchiveCampaignButton
              campaignId={campaign.id}
              campaignName={campaign.name}
              variant="outline"
            />
          ) : null}
        </div>
      </div>

      <CampaignSectionNav campaignId={campaign.id} activeSection="overview" />

      <div id="overview" className="scroll-mt-24 grid gap-6 lg:grid-cols-2">
        <DetailCard title="Kampanya Bilgileri">
          <DetailRow label="Kampanya adı" value={campaign.name} />
          <DetailRow label="Sanatçı" value={campaign.artist_name} />
          <DetailRow label="Şarkı" value={campaign.track_name} />
          <DetailRow label="Müşteri" value={campaign.client_name ?? "—"} />
          <DetailRow
            label="Rapor numarası"
            value={campaign.report_number ?? "—"}
          />
        </DetailCard>

        <DetailCard title="Tarihler ve Bağlantılar">
          <DetailRow label="Başlangıç" value={formatDate(campaign.start_date)} />
          <DetailRow label="Bitiş" value={formatDate(campaign.end_date)} />
          <DetailRow
            label="TikTok ses linki"
            value={
              campaign.sound_url ? (
                <a
                  href={campaign.sound_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-primary hover:text-primary/80"
                >
                  {campaign.sound_url}
                </a>
              ) : (
                "—"
              )
            }
          />
          <DetailRow
            label="Oluşturulma"
            value={formatDateTime(campaign.created_at)}
          />
          <DetailRow
            label="Son güncelleme"
            value={formatDateTime(campaign.updated_at)}
          />
        </DetailCard>
      </div>

      <CampaignCreatorList
        campaignId={campaign.id}
        assignments={assignments}
        syncSummaries={creatorSyncSummaries}
        syncConfigured={syncConfigured}
        syncAction={
          <SyncCampaignCreatorsButton
            campaignId={campaign.id}
            tiktokCreatorCount={tiktokCreatorCount}
            syncConfigured={syncConfigured}
          />
        }
      />

      <CampaignVideoList
        campaignId={campaign.id}
        videos={videos}
        syncAction={
          <SyncCampaignButton
            campaignId={campaign.id}
            tiktokVideoCount={tiktokVideoCount}
            syncConfigured={syncConfigured}
          />
        }
        importAction={
          <ImportCampaignVideosDialog
            campaignId={campaign.id}
            campaignCreators={assignments
              .filter((row) => row.creator.platform === "tiktok")
              .map((row) => ({
                id: row.creator.id,
                username: row.creator.username,
                display_name: row.creator.display_name,
              }))}
          />
        }
      />

      <SyncHistory campaignId={campaign.id} jobs={syncJobs} />

      <CampaignSoundTrackingSection
        campaignId={campaign.id}
        configuration={
          soundConfiguration ?? {
            campaignId: campaign.id,
            soundUrl: campaign.sound_url,
            soundId: campaign.tiktok_sound_id ?? null,
            soundTitle: campaign.tiktok_sound_title ?? null,
            soundAuthor: campaign.tiktok_sound_author ?? null,
            lastSyncedAt: campaign.sound_last_synced_at ?? null,
            syncStatus: campaign.sound_sync_status ?? "pending",
            syncError: campaign.sound_sync_error ?? null,
          }
        }
        summary={soundSummary}
        history={soundHistory}
        clusterHistory={clusterSoundHistory}
        syncConfigured={soundSyncConfigured}
      />

      <div id="metrics" className="scroll-mt-24 space-y-8">
        <CampaignMetricSummaryPanel summary={metricSummary} />
        <CreatorContributionTable rows={creatorMetrics} />
        <CampaignMetricTimeline rows={metricTimeline} />
      </div>

      <CampaignReportSection campaignId={campaign.id} summary={reportSummary} />
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
    <section className="rounded-xl border border-bf-border bg-bf-surface/80 p-5">
      <h2 className="text-base font-medium text-bf-text">{title}</h2>
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
      <dt className="text-sm text-bf-steel">{label}</dt>
      <dd className="text-sm text-bf-text/90">{value}</dd>
    </div>
  );
}
