"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { CompactCountText } from "@/components/format/compact-count-text";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { AddToListDialog } from "@/features/creator-lists/components/add-to-list-dialog";
import { CreateListDialog } from "@/features/creator-lists/components/create-list-dialog";
import {
  areAllVisibleSelected,
  clearCreatorSelection,
  createEmptySelection,
  selectVisibleCreators,
  toggleCreatorSelection,
} from "@/features/creator-lists/selection";
import { CREATOR_SELECTION_MAX } from "@/features/creator-lists/types";
import type { CreatorListSummary } from "@/features/creator-lists/types";
import {
  CreatorGrowthCell,
  CreatorSyncStateCell,
} from "@/features/creator-sync/components/creator-sync-state";
import { SyncCreatorButton } from "@/features/creator-sync/components/sync-creator-button";
import type { CreatorGrowth } from "@/features/creator-sync/queries";
import { CreatorAvatar } from "@/features/creators/components/creator-avatar";
import { CreatorCategoryBadge } from "@/features/creators/components/creator-category-badge";
import { CreatorDirectorySortHeader } from "@/features/creators/components/creator-directory-sort-header";
import { CreatorPlatformBadge } from "@/features/creators/components/creator-platform-badge";
import {
  cycleCreatorDirectorySort,
  parseCreatorDirectorySortState,
  sortCreatorDirectoryRows,
  type CreatorDirectorySortKey,
  type CreatorDirectorySortState,
} from "@/features/creators/directory-sort";
import type { CreatorWithCampaignCount } from "@/features/creators/types";
import { cn } from "@/lib/utils";

function writeSortParamsToUrl(state: CreatorDirectorySortState) {
  if (typeof window === "undefined") {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  if (state.sort && state.direction) {
    params.set("sort", state.sort);
    params.set("direction", state.direction);
  } else {
    params.delete("sort");
    params.delete("direction");
  }

  const query = params.toString();
  const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  window.history.replaceState(window.history.state, "", nextUrl);
}

function readSortStateFromLocation(): CreatorDirectorySortState {
  if (typeof window === "undefined") {
    return { sort: null, direction: null };
  }
  const params = new URLSearchParams(window.location.search);
  return parseCreatorDirectorySortState({
    sort: params.get("sort"),
    direction: params.get("direction"),
  });
}

export function CreatorDirectorySelection({
  creators,
  growthByCreator,
  syncConfigured,
  lists,
  initialSortState,
}: {
  creators: CreatorWithCampaignCount[];
  growthByCreator: Map<string, CreatorGrowth>;
  syncConfigured: boolean;
  lists: Array<Pick<CreatorListSummary, "id" | "name" | "status" | "creator_count">>;
  initialSortState: CreatorDirectorySortState;
}) {
  const [selection, setSelection] = useState(createEmptySelection);
  const [sortState, setSortState] = useState<CreatorDirectorySortState>(
    initialSortState
  );

  useEffect(() => {
    function onPopState() {
      setSortState(readSortStateFromLocation());
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const sortedCreators = useMemo(
    () => sortCreatorDirectoryRows(creators, growthByCreator, sortState),
    [creators, growthByCreator, sortState]
  );

  const visibleIds = useMemo(
    () => sortedCreators.map((creator) => creator.id),
    [sortedCreators]
  );
  const allVisibleSelected = areAllVisibleSelected(
    selection.selectedIds,
    visibleIds
  );

  const handleSort = useCallback((column: CreatorDirectorySortKey) => {
    setSortState((current) => {
      const next = cycleCreatorDirectorySort(current, column);
      writeSortParamsToUrl(next);
      return next;
    });
  }, []);

  return (
    <div className="space-y-4">
      {selection.selectedIds.length > 0 ? (
        <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-orange-500/30 bg-zinc-950/95 px-4 py-3 backdrop-blur">
          <p className="text-sm text-zinc-200">
            {selection.selectedIds.length} creator seçildi
            {selection.limited
              ? ` · en fazla ${CREATOR_SELECTION_MAX}`
              : ""}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <CreateListDialog
              selectedIds={selection.selectedIds}
              onCreated={() => setSelection(clearCreatorSelection())}
            />
            <AddToListDialog
              selectedIds={selection.selectedIds}
              lists={lists}
              onAdded={() => setSelection(clearCreatorSelection())}
            />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setSelection(clearCreatorSelection())}
            >
              Seçimi Temizle
            </Button>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-zinc-800">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-800 text-sm">
            <thead className="bg-zinc-950/80">
              <tr className="text-left text-zinc-400">
                <th className="px-4 py-3 font-medium">
                  <input
                    type="checkbox"
                    aria-label="Görünen sonuçların tümünü seç"
                    checked={allVisibleSelected}
                    onChange={(event) =>
                      setSelection((current) =>
                        selectVisibleCreators(
                          current,
                          visibleIds,
                          event.target.checked
                        )
                      )
                    }
                    className="h-4 w-4 rounded border-zinc-600"
                  />
                </th>
                <CreatorDirectorySortHeader
                  column="name"
                  label="İçerik Üreticisi"
                  state={sortState}
                  onSort={handleSort}
                />
                <th className="px-4 py-3 font-medium">Platform</th>
                <CreatorDirectorySortHeader
                  column="category"
                  label="Kategori"
                  state={sortState}
                  onSort={handleSort}
                />
                <CreatorDirectorySortHeader
                  column="followers"
                  label="Takipçi"
                  state={sortState}
                  onSort={handleSort}
                />
                <CreatorDirectorySortHeader
                  column="growth"
                  label="Büyüme"
                  state={sortState}
                  onSort={handleSort}
                />
                <CreatorDirectorySortHeader
                  column="sync"
                  label="Senkronizasyon"
                  state={sortState}
                  onSort={handleSort}
                />
                <CreatorDirectorySortHeader
                  column="campaigns"
                  label="Kampanya"
                  state={sortState}
                  onSort={handleSort}
                />
                <th className="px-4 py-3 font-medium text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80 bg-zinc-950/40">
              {sortedCreators.map((creator) => {
                const checked = selection.selectedIds.includes(creator.id);
                return (
                  <tr key={creator.id} className="text-zinc-200">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label={`@${creator.username} seç`}
                        checked={checked}
                        onChange={(event) =>
                          setSelection((current) =>
                            toggleCreatorSelection(
                              current,
                              creator.id,
                              event.target.checked
                            )
                          )
                        }
                        className="h-4 w-4 rounded border-zinc-600"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <CreatorAvatar
                          username={creator.username}
                          displayName={creator.display_name}
                          avatarUrl={creator.avatar_url}
                          size="sm"
                        />
                        <div>
                          <p className="font-medium text-white">
                            @{creator.username}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {creator.display_name ?? "—"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <CreatorPlatformBadge platform={creator.platform} />
                    </td>
                    <td className="px-4 py-3">
                      <CreatorCategoryBadge category={creator.category} />
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      <CompactCountText
                        value={
                          growthByCreator.get(creator.id)?.currentFollowers ??
                          creator.follower_count
                        }
                        variant="management"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <CreatorGrowthCell
                        absoluteGrowth={
                          growthByCreator.get(creator.id)?.absoluteGrowth ?? null
                        }
                        growthPercentage={
                          growthByCreator.get(creator.id)?.growthPercentage ??
                          null
                        }
                      />
                    </td>
                    <td className="px-4 py-3">
                      <CreatorSyncStateCell
                        status={creator.sync_status ?? "pending"}
                        lastSyncedAt={creator.last_synced_at}
                      />
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {creator.campaign_count}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <SyncCreatorButton
                          creatorId={creator.id}
                          platform={creator.platform}
                          syncConfigured={syncConfigured}
                          compact
                        />
                        <Link
                          href={`/creators/${creator.id}`}
                          className={cn(
                            buttonVariants({ variant: "ghost", size: "sm" })
                          )}
                        >
                          Aç
                        </Link>
                        <Link
                          href={`/creators/${creator.id}/edit`}
                          className={cn(
                            buttonVariants({ variant: "outline", size: "sm" })
                          )}
                        >
                          Düzenle
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
