import Link from "next/link";
import { notFound } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { CreatorFollowerHistory } from "@/features/creator-sync/components/creator-follower-history";
import { CreatorFollowerSummary } from "@/features/creator-sync/components/creator-follower-summary";
import { SyncCreatorButton } from "@/features/creator-sync/components/sync-creator-button";
import {
  buildCreatorFollowerHistory,
  getCreatorMetricSummary,
} from "@/features/creator-sync/queries";
import type { CreatorSyncStatus } from "@/features/creator-sync/types";
import { CreatorAvatar } from "@/features/creators/components/creator-avatar";
import { CreatorCategoryBadge } from "@/features/creators/components/creator-category-badge";
import { CreatorPlatformBadge } from "@/features/creators/components/creator-platform-badge";
import { getCreatorWithCampaigns } from "@/features/creators/queries";
import { isTikTokCreatorSyncConfigured } from "@/lib/env.server";
import { CompactCountText } from "@/components/format/compact-count-text";
import { formatTurkishDate } from "@/lib/format";
import { buildPlatformProfileUrl } from "@/lib/report-links/build-platform-profile-url";
import { cn } from "@/lib/utils";

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatFee(fee: number | null): string {
  if (fee === null) {
    return "—";
  }

  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(fee);
}

export default async function CreatorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getCreatorWithCampaigns(id);

  if (!result) {
    notFound();
  }

  const { creator, assignments } = result;

  // Reading history on the server keeps the provider out of the render path: the
  // page never triggers a sync merely by being opened.
  const [followerSummary, followerHistory] = await Promise.all([
    getCreatorMetricSummary(creator.id, creator.follower_count),
    buildCreatorFollowerHistory(creator.id),
  ]);

  const syncStatus = (creator.sync_status ?? "pending") as CreatorSyncStatus;
  const syncConfigured = isTikTokCreatorSyncConfigured();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/creators"
            className="text-sm text-zinc-400 transition-colors hover:text-white"
          >
            ← İçerik üreticilerine dön
          </Link>
          <div className="mt-3 flex items-center gap-4">
            <CreatorAvatar
              username={creator.username}
              displayName={creator.display_name}
              avatarUrl={creator.avatar_url}
              size="lg"
            />
            <div>
              <h1 className="text-2xl font-semibold text-white">
                @{creator.username}
              </h1>
              <p className="mt-1 text-sm text-zinc-400">
                {creator.display_name ?? "—"}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <CreatorPlatformBadge platform={creator.platform} />
                <CreatorCategoryBadge category={creator.category} />
              </div>
            </div>
          </div>
        </div>

        <Link
          href={`/creators/${creator.id}/edit`}
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Düzenle
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <DetailCard title="Profil Bilgileri">
          <DetailRow
            label="Platform"
            value={<CreatorPlatformBadge platform={creator.platform} />}
          />
          <DetailRow label="Kullanıcı adı" value={`@${creator.username}`} />
          <DetailRow label="Görünen ad" value={creator.display_name ?? "—"} />
          <DetailRow
            label="Profil URL"
            value={
              creator.profile_url ? (
                <a
                  href={creator.profile_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-primary hover:text-[var(--bf-accent-soft)]"
                >
                  {creator.profile_url}
                </a>
              ) : (
                <MissingProfileUrlNotice
                  platform={creator.platform}
                  username={creator.username}
                />
              )
            }
          />
          <DetailRow
            label="Takipçi"
            value={
              <CompactCountText
                value={creator.follower_count}
                variant="management"
              />
            }
          />
          <DetailRow
            label="Son profil senkronizasyonu"
            value={
              creator.last_synced_at
                ? formatDateTime(creator.last_synced_at)
                : "Henüz güncellenmedi"
            }
          />
          <DetailRow
            label="Oluşturulma"
            value={formatDateTime(creator.created_at)}
          />
          <DetailRow
            label="Son güncelleme"
            value={formatDateTime(creator.updated_at)}
          />
        </DetailCard>

        <DetailCard title="Kampanya Özeti">
          <DetailRow
            label="Atandığı kampanya"
            value={String(assignments.length)}
          />
          <DetailRow
            label="Toplam anlaşılan içerik"
            value={String(
              assignments.reduce(
                (sum, item) => sum + item.agreed_content_count,
                0
              )
            )}
          />
        </DetailCard>
      </div>

      <CreatorFollowerSummary
        summary={followerSummary}
        syncStatus={syncStatus}
        lastSyncedAt={creator.last_synced_at}
        syncAction={
          <SyncCreatorButton
            creatorId={creator.id}
            platform={creator.platform}
            syncConfigured={syncConfigured}
            accountStatus={creator.account_status ?? "active"}
          />
        }
      />

      <CreatorFollowerHistory rows={followerHistory} />

      <section className="space-y-4">
        <h2 className="text-lg font-medium text-white">Kampanyalar</h2>
        {assignments.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-800 px-6 py-10 text-center text-sm text-zinc-400">
            Bu içerik üreticisi henüz bir kampanyaya atanmamış.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-800">
            <table className="min-w-full divide-y divide-zinc-800 text-sm">
              <thead className="bg-zinc-950/80">
                <tr className="text-left text-zinc-400">
                  <th className="px-4 py-3 font-medium">Kampanya</th>
                  <th className="px-4 py-3 font-medium">İçerik</th>
                  <th className="px-4 py-3 font-medium">Ücret</th>
                  <th className="px-4 py-3 font-medium">Notlar</th>
                  <th className="px-4 py-3 font-medium">Atanma</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80 bg-zinc-950/40">
                {assignments.map((assignment) => (
                  <tr key={assignment.campaign_id} className="text-zinc-200">
                    <td className="px-4 py-3">
                      <Link
                        href={`/campaigns/${assignment.campaign_id}`}
                        className="font-medium text-white hover:text-primary"
                      >
                        {assignment.campaign_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {assignment.agreed_content_count}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {formatFee(assignment.fee)}
                    </td>
                    <td className="px-4 py-3 max-w-[240px] truncate text-zinc-400">
                      {assignment.notes ?? "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-zinc-400">
                      {formatTurkishDate(assignment.assigned_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/20 p-6">
        <h3 className="text-sm font-medium text-zinc-300">Videolar</h3>
        <p className="mt-2 text-sm text-zinc-500">
          Bu içerik üreticisine ait video analitiği yakında eklenecek.
        </p>
      </section>
    </div>
  );
}

/**
 * Reports fall back to a deterministic profile URL when this field is empty, so
 * a missing value is a data quality warning rather than an error. The preview
 * shows exactly what reports will link to.
 */
function MissingProfileUrlNotice({
  platform,
  username,
}: {
  platform: string;
  username: string;
}) {
  const preview = buildPlatformProfileUrl(
    platform === "instagram" || platform === "youtube" ? platform : "tiktok",
    username
  );

  return (
    <div className="space-y-1">
      <p className="text-amber-400">Profil bağlantısı eksik</p>
      {preview && (
        <p className="text-xs break-all text-zinc-500">
          Raporlarda kullanılacak bağlantı: {preview}
        </p>
      )}
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
