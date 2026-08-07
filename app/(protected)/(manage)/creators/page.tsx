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
      campaignAssignment,
      hasAvatar,
    }),
    listCreatorLists().catch(() => []),
  ]);

  const growthByCreator = await listCreatorGrowthByIds(creators);
  const syncConfigured = isTikTokCreatorSyncConfigured();
  const hasFilters = Boolean(
    params.q ||
      platform !== "all" ||
      category !== "all" ||
      minFollowers !== null ||
      maxFollowers !== null ||
      syncStatus !== "all" ||
      campaignAssignment !== "all" ||
      hasAvatar !== "all"
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">
            İçerik Üreticileri
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
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
            className={cn(
              buttonVariants({ variant: "default" }),
              "bg-orange-500 text-white hover:bg-orange-500/90"
            )}
          >
            Yeni İçerik Üreticisi
          </Link>
        </div>
      </div>

      <CreatorDirectoryFilterForm className="flex flex-wrap items-end gap-3">
        <div className="min-w-[180px] flex-1 space-y-1">
          <label htmlFor="q" className="text-xs text-zinc-500">
            Ara
          </label>
          <input
            id="q"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Kullanıcı adı veya görünen ad"
            className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 text-sm text-white outline-none focus:border-orange-500/60 focus:ring-2 focus:ring-orange-500/20"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="platform" className="text-xs text-zinc-500">
            Platform
          </label>
          <select
            id="platform"
            name="platform"
            defaultValue={platform}
            className="h-10 rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 text-sm text-white outline-none focus:border-orange-500/60"
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
          <label htmlFor="category" className="text-xs text-zinc-500">
            Kategori
          </label>
          <select
            id="category"
            name="category"
            defaultValue={category}
            className="h-10 rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 text-sm text-white outline-none focus:border-orange-500/60"
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
          <label htmlFor="min_followers" className="text-xs text-zinc-500">
            Min takipçi
          </label>
          <input
            id="min_followers"
            name="min_followers"
            type="number"
            min={0}
            defaultValue={params.min_followers ?? ""}
            className="h-10 w-28 rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 text-sm text-white outline-none focus:border-orange-500/60"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="max_followers" className="text-xs text-zinc-500">
            Max takipçi
          </label>
          <input
            id="max_followers"
            name="max_followers"
            type="number"
            min={0}
            defaultValue={params.max_followers ?? ""}
            className="h-10 w-28 rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 text-sm text-white outline-none focus:border-orange-500/60"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="sync_status" className="text-xs text-zinc-500">
            Senkron
          </label>
          <select
            id="sync_status"
            name="sync_status"
            defaultValue={syncStatus}
            className="h-10 rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 text-sm text-white outline-none focus:border-orange-500/60"
          >
            <option value="all">Tümü</option>
            <option value="success">Başarılı</option>
            <option value="pending">Bekliyor</option>
            <option value="failed">Başarısız</option>
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="campaign" className="text-xs text-zinc-500">
            Kampanya
          </label>
          <select
            id="campaign"
            name="campaign"
            defaultValue={campaignAssignment}
            className="h-10 rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 text-sm text-white outline-none focus:border-orange-500/60"
          >
            <option value="all">Tümü</option>
            <option value="assigned">Atanmış</option>
            <option value="unassigned">Atanmamış</option>
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="has_avatar" className="text-xs text-zinc-500">
            Avatar
          </label>
          <select
            id="has_avatar"
            name="has_avatar"
            defaultValue={hasAvatar}
            className="h-10 rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 text-sm text-white outline-none focus:border-orange-500/60"
          >
            <option value="all">Tümü</option>
            <option value="yes">Var</option>
            <option value="no">Yok</option>
          </select>
        </div>
        <button
          type="submit"
          className="h-10 rounded-lg bg-zinc-800 px-4 text-sm font-medium text-white hover:bg-zinc-700"
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
      </CreatorDirectoryFilterForm>

      {creators.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-800 px-6 py-12 text-center text-sm text-zinc-400">
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
