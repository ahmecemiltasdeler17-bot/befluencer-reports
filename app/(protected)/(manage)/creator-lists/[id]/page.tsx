import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CompactCountText } from "@/components/format/compact-count-text";
import { buttonVariants } from "@/components/ui/button";
import { AddListToCampaignDialog } from "@/features/creator-lists/components/add-list-to-campaign-dialog";
import { CreateListShareDialog } from "@/features/creator-lists/components/create-list-share-dialog";
import { ListItemActions } from "@/features/creator-lists/components/list-item-actions";
import { ListStatusBadge } from "@/features/creator-lists/components/list-status-badge";
import { RevokeListShareButton } from "@/features/creator-lists/components/revoke-list-share-button";
import {
  getCreatorList,
  listCreatorListShares,
} from "@/features/creator-lists/queries";
import { listCampaigns } from "@/features/campaigns/queries";
import { listCreatorGrowthByIds } from "@/features/creator-sync/queries";
import {
  CreatorGrowthCell,
} from "@/features/creator-sync/components/creator-sync-state";
import { CreatorAvatar } from "@/features/creators/components/creator-avatar";
import { CreatorCategoryBadge } from "@/features/creators/components/creator-category-badge";
import { CreatorPlatformBadge } from "@/features/creators/components/creator-platform-badge";
import { cn } from "@/lib/utils";

export default async function CreatorListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const list = await getCreatorList(id);

  if (!list) {
    notFound();
  }

  const [shares, campaigns, growthByCreator] = await Promise.all([
    listCreatorListShares(list.id),
    listCampaigns(),
    listCreatorGrowthByIds(
      list.items.map((item) => ({
        id: item.creator.id,
        follower_count: item.creator.follower_count,
      }))
    ),
  ]);

  const orderedItemIds = list.items.map((item) => item.id);
  const categoryEntries = Object.entries(list.stats.categoryDistribution);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-bf-text">{list.name}</h1>
            <ListStatusBadge status={list.status} />
          </div>
          {list.description ? (
            <p className="max-w-2xl text-sm text-bf-steel">{list.description}</p>
          ) : null}
          <p className="text-xs text-bf-steel/80">
            {list.stats.creatorCount} creator · oluşturulma{" "}
            {new Date(list.created_at).toLocaleString("tr-TR")}
          </p>
          {list.internal_notes ? (
            <p className="max-w-2xl rounded-md border border-bf-border bg-bf-surface/80 px-3 py-2 text-xs text-bf-steel">
              İç not: {list.internal_notes}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/creators"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Creator Ekle
          </Link>
          <a
            href={`/api/creator-lists/${list.id}/csv`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            CSV İndir
          </a>
          <CreateListShareDialog
            listId={list.id}
            disabled={list.status === "archived"}
          />
          <AddListToCampaignDialog
            listId={list.id}
            creatorCount={list.stats.creatorCount}
            campaigns={campaigns.map((campaign) => ({
              id: campaign.id,
              name: campaign.name,
            }))}
          />
          <Link
            href={`/creator-lists/${list.id}/edit`}
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            Düzenle
          </Link>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Creator" value={String(list.stats.creatorCount)} />
        <StatCard
          label="Toplam takipçi"
          value={
            <CompactCountText
              value={list.stats.totalFollowers}
              variant="management"
            />
          }
        />
        <StatCard
          label="Ortalama / medyan"
          value={
            <span className="tabular-nums">
              {list.stats.averageFollowers == null ? (
                "—"
              ) : (
                <CompactCountText
                  value={list.stats.averageFollowers}
                  variant="management"
                />
              )}
              {" / "}
              {list.stats.medianFollowers == null ? (
                "—"
              ) : (
                <CompactCountText
                  value={list.stats.medianFollowers}
                  variant="management"
                />
              )}
            </span>
          }
        />
        <StatCard
          label="TikTok"
          value={String(list.stats.tiktokCount)}
        />
      </section>

      {categoryEntries.length > 0 ? (
        <div className="flex flex-wrap gap-2 text-xs text-bf-steel">
          {categoryEntries.map(([key, count]) => (
            <span
              key={key}
              className="rounded-full border border-bf-border px-2.5 py-1"
            >
              {key}: {count}
            </span>
          ))}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-bf-border">
        <table className="min-w-full divide-y divide-bf-border text-sm">
          <thead className="bg-bf-surface text-left text-bf-steel">
            <tr>
              <th className="px-4 py-2.5 font-medium">Sıra</th>
              <th className="px-4 py-2.5 font-medium">Creator</th>
              <th className="px-4 py-2.5 font-medium">Platform</th>
              <th className="px-4 py-2.5 font-medium">Kategori</th>
              <th className="px-4 py-2.5 font-medium">Takipçi</th>
              <th className="px-4 py-2.5 font-medium">Büyüme</th>
              <th className="px-4 py-2.5 font-medium">Notlar</th>
              <th className="px-4 py-2.5 font-medium text-right">İşlemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-bf-border/80 bg-bf-bg/40 text-bf-text/90">
            {list.items.map((item, index) => (
              <tr
                key={item.id}
                className="transition-colors hover:bg-primary/[0.04]"
              >
                <td className="px-4 py-3 tabular-nums text-bf-steel">
                  {index + 1}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <CreatorAvatar
                      username={item.creator.username}
                      displayName={item.creator.display_name}
                      avatarUrl={item.creator.avatar_url}
                      size="sm"
                    />
                    <div>
                      <p className="font-medium text-bf-text">
                        @{item.creator.username}
                      </p>
                      <p className="text-xs text-bf-steel">
                        {item.creator.display_name ?? "—"}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <CreatorPlatformBadge platform={item.creator.platform} />
                </td>
                <td className="px-4 py-3">
                  <CreatorCategoryBadge category={item.creator.category} />
                </td>
                <td className="px-4 py-3 tabular-nums">
                  <CompactCountText
                    value={
                      growthByCreator.get(item.creator.id)?.currentFollowers ??
                      item.creator.follower_count
                    }
                    variant="management"
                  />
                </td>
                <td className="px-4 py-3">
                  <CreatorGrowthCell
                    absoluteGrowth={
                      growthByCreator.get(item.creator.id)?.absoluteGrowth ??
                      null
                    }
                    growthPercentage={
                      growthByCreator.get(item.creator.id)?.growthPercentage ??
                      null
                    }
                  />
                </td>
                <td className="px-4 py-3 text-xs text-bf-steel">
                  <p>Public: {item.public_note ?? "—"}</p>
                  <p>İç: {item.internal_note ?? "—"}</p>
                </td>
                <td className="px-4 py-3">
                  <ListItemActions
                    listId={list.id}
                    itemId={item.id}
                    orderedItemIds={orderedItemIds}
                    publicNote={item.public_note}
                    internalNote={item.internal_note}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-bf-text">Paylaşımlar</h2>
        {shares.length === 0 ? (
          <p className="text-sm text-bf-steel">Aktif veya geçmiş paylaşım yok.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-bf-border">
            <table className="min-w-full divide-y divide-bf-border text-sm">
              <thead className="bg-bf-surface text-left text-bf-steel">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Etiket</th>
                  <th className="px-4 py-2.5 font-medium">Durum</th>
                  <th className="px-4 py-2.5 font-medium">CSV</th>
                  <th className="px-4 py-2.5 font-medium">Erişim</th>
                  <th className="px-4 py-2.5 font-medium">Bitiş</th>
                  <th className="px-4 py-2.5 font-medium text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bf-border/80 bg-bf-bg/40 text-bf-text/90">
                {shares.map((share) => (
                  <tr
                    key={share.id}
                    className="transition-colors hover:bg-primary/[0.04]"
                  >
                    <td className="px-4 py-3">{share.label ?? "—"}</td>
                    <td className="px-4 py-3">{share.status}</td>
                    <td className="px-4 py-3">
                      {share.allow_csv_download ? "Açık" : "Kapalı"}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {share.access_count}
                    </td>
                    <td className="px-4 py-3 text-xs text-bf-steel">
                      {share.expires_at
                        ? new Date(share.expires_at).toLocaleString("tr-TR")
                        : "Süresiz"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {share.status !== "revoked" ? (
                        <RevokeListShareButton shareId={share.id} />
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-bf-border bg-bf-surface/80 px-4 py-3">
      <p className="text-xs text-bf-steel">{label}</p>
      <div className="mt-1 text-lg font-semibold text-bf-text">{value}</div>
    </div>
  );
}
