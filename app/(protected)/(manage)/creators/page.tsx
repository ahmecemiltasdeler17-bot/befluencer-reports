import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { CreatorDirectorySelection } from "@/features/creator-lists/components/creator-directory-selection";
import { listCreatorLists } from "@/features/creator-lists/queries";
import { listCreatorGrowthByIds } from "@/features/creator-sync/queries";
import {
  CREATOR_CATEGORIES,
  CREATOR_PLATFORMS,
  type CreatorCategory,
  type CreatorPlatform,
} from "@/features/creators/types";
import { CreatorDirectoryFilterForm } from "@/features/creators/components/creator-directory-filter-form";
import { DeleteUnavailableCreatorsButton } from "@/features/creators/components/delete-unavailable-creators-button";
import { parseCreatorDirectorySortState } from "@/features/creators/directory-sort";
import { listCreators } from "@/features/creators/queries";
import { getCategoryLabel } from "@/features/creators/components/creator-category-badge";
import { getPlatformLabel } from "@/features/creators/components/creator-platform-badge";
import { isTikTokCreatorSyncConfigured } from "@/lib/env.server";
import { cn } from "@/lib/utils";

type SearchParams = {
  q?: string;
  platform?: string;
  category?: string;
  min_followers?: string;
  max_followers?: string;
  sync_status?: string;
  account_status?: string;
  campaign?: string;
  has_avatar?: string;
  sort?: string;
  direction?: string;
};

function parseOptionalInt(value: string | undefined): number | null {
  if (!value?.trim()) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : null;
}

export default async function CreatorsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const platform =
    params.platform && CREATOR_PLATFORMS.includes(params.platform as CreatorPlatform)
      ? (params.platform as CreatorPlatform)
      : "all";
  const category =
    params.category &&
    CREATOR_CATEGORIES.includes(params.category as CreatorCategory)
      ? (params.category as CreatorCategory)
      : "all";
  const syncStatus =
    params.sync_status === "pending" ||
    params.sync_status === "success" ||
    params.sync_status === "failed"
      ? params.sync_status
      : "all";
  const accountStatus =
    params.account_status === "active" ||
    params.account_status === "unavailable"
      ? params.account_status
      : "all";
  const campaignAssignment =
    params.campaign === "assigned" || params.campaign === "unassigned"
      ? params.campaign
      : "all";
  const hasAvatar =
    params.has_avatar === "yes" || params.has_avatar === "no"
      ? params.has_avatar
      : "all";
  const minFollowers = parseOptionalInt(params.min_followers);
  const maxFollowers = parseOptionalInt(params.max_followers);
  const initialSortState = parseCreatorDirectorySortState({
    sort: params.sort,
    direction: params.direction,
  });

  const [creators, lists] = await Promise.all([
    listCreators({
      query: params.q,
      platform,
      category,
      minFollowers,
      maxFollowers,
      syncStatus,
      accountStatus,
      campaignAssignment,
      hasAvatar,
    }),
    listCreatorLists().catch(() => []),
  ]);

  const growthByCreator = await listCreatorGrowthByIds(creators);
  const syncConfigured = isTikTokCreatorSyncConfigured();
  const unavailableCount = creators.filter(
    (creator) => (creator.account_status ?? "active") === "unavailable"
  ).length;
  const hasFilters = Boolean(
    params.q ||
      platform !== "all" ||
      category !== "all" ||
      minFollowers !== null ||
      maxFollowers !== null ||
      syncStatus !== "all" ||
      accountStatus !== "all" ||
      campaignAssignment !== "all" ||
      hasAvatar !== "all"
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-bf-text">
            İçerik Üreticileri
          </h1>
          <p className="mt-1 text-sm text-bf-steel">
            Global içerik üreticisi havuzunu yönetin ve listeler oluşturun
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/creator-lists"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Creator Listeleri
          </Link>
          <Link
            href="/creators/import"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Toplu Creator Ekle
          </Link>
          <Link
            href="/creators/new"
            className={cn(buttonVariants({ variant: "default" }))}
          >
            Yeni İçerik Üreticisi
          </Link>
        </div>
      </div>

      <CreatorDirectoryFilterForm className="flex flex-wrap items-end gap-3 rounded-xl border border-bf-border bg-bf-surface/50 p-3">
        <div className="min-w-[180px] flex-1 space-y-1">
          <label htmlFor="q" className="text-xs text-bf-steel">
            Ara
          </label>
          <input
            id="q"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Kullanıcı adı veya görünen ad"
            className="h-10 w-full rounded-lg border border-bf-border bg-bf-bg px-3 text-sm text-bf-text outline-none placeholder:text-bf-steel/60 focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="platform" className="text-xs text-bf-steel">
            Platform
          </label>
          <select
            id="platform"
            name="platform"
            defaultValue={platform}
            className="h-10 rounded-lg border border-bf-border bg-bf-bg px-3 text-sm text-bf-text outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">Tümü</option>
            {CREATOR_PLATFORMS.map((value) => (
              <option key={value} value={value}>
                {getPlatformLabel(value)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="category" className="text-xs text-bf-steel">
            Kategori
          </label>
          <select
            id="category"
            name="category"
            defaultValue={category}
            className="h-10 rounded-lg border border-bf-border bg-bf-bg px-3 text-sm text-bf-text outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">Tümü</option>
            {CREATOR_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {getCategoryLabel(value)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="min_followers" className="text-xs text-bf-steel">
            Min takipçi
          </label>
          <input
            id="min_followers"
            name="min_followers"
            type="number"
            min={0}
            defaultValue={params.min_followers ?? ""}
            className="h-10 w-28 rounded-lg border border-bf-border bg-bf-bg px-3 text-sm text-bf-text outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="max_followers" className="text-xs text-bf-steel">
            Max takipçi
          </label>
          <input
            id="max_followers"
            name="max_followers"
            type="number"
            min={0}
            defaultValue={params.max_followers ?? ""}
            className="h-10 w-28 rounded-lg border border-bf-border bg-bf-bg px-3 text-sm text-bf-text outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="sync_status" className="text-xs text-bf-steel">
            Senkron
          </label>
          <select
            id="sync_status"
            name="sync_status"
            defaultValue={syncStatus}
            className="h-10 rounded-lg border border-bf-border bg-bf-bg px-3 text-sm text-bf-text outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">Tümü</option>
            <option value="success">Başarılı</option>
            <option value="pending">Bekliyor</option>
            <option value="failed">Başarısız</option>
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="account_status" className="text-xs text-bf-steel">
            Hesap
          </label>
          <select
            id="account_status"
            name="account_status"
            defaultValue={accountStatus}
            className="h-10 rounded-lg border border-bf-border bg-bf-bg px-3 text-sm text-bf-text outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">Tümü</option>
            <option value="active">Aktif</option>
            <option value="unavailable">Pasif hesapları göster</option>
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="campaign" className="text-xs text-bf-steel">
            Kampanya
          </label>
          <select
            id="campaign"
            name="campaign"
            defaultValue={campaignAssignment}
            className="h-10 rounded-lg border border-bf-border bg-bf-bg px-3 text-sm text-bf-text outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">Tümü</option>
            <option value="assigned">Atanmış</option>
            <option value="unassigned">Atanmamış</option>
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="has_avatar" className="text-xs text-bf-steel">
            Avatar
          </label>
          <select
            id="has_avatar"
            name="has_avatar"
            defaultValue={hasAvatar}
            className="h-10 rounded-lg border border-bf-border bg-bf-bg px-3 text-sm text-bf-text outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">Tümü</option>
            <option value="yes">Var</option>
            <option value="no">Yok</option>
          </select>
        </div>
        <button
          type="submit"
          className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Filtrele
        </button>
        {hasFilters || initialSortState.sort ? (
          <Link
            href="/creators"
            className={cn(buttonVariants({ variant: "ghost" }), "h-10")}
          >
            Temizle
          </Link>
        ) : null}
        {accountStatus === "unavailable" && unavailableCount > 0 ? (
          <DeleteUnavailableCreatorsButton
            creatorIds={creators
              .filter(
                (creator) =>
                  (creator.account_status ?? "active") === "unavailable"
              )
              .map((creator) => creator.id)}
          />
        ) : null}
      </CreatorDirectoryFilterForm>

      {creators.length === 0 ? (
        <div className="rounded-lg border border-dashed border-bf-border px-6 py-12 text-center text-sm text-bf-steel">
          İçerik üreticisi bulunamadı.
        </div>
      ) : (
        <CreatorDirectorySelection
          creators={creators}
          growthByCreator={growthByCreator}
          syncConfigured={syncConfigured}
          lists={lists}
          initialSortState={initialSortState}
        />
      )}
    </div>
  );
}
