"use client";

import { useState, useTransition } from "react";

import { CreatorAvatar } from "@/features/creators/components/creator-avatar";
import { CreatorCategoryBadge } from "@/features/creators/components/creator-category-badge";
import { CreatorPlatformBadge } from "@/features/creators/components/creator-platform-badge";
import { AssignCreatorForm } from "@/features/creators/components/assign-creator-form";
import { searchCreatorsAction } from "@/features/creators/actions";
import type { Creator } from "@/features/creators/types";
import { CompactCountText } from "@/components/format/compact-count-text";
import { cn } from "@/lib/utils";

type AssignAction = (
  campaignId: string,
  creatorId: string,
  prevState: import("@/features/creators/types").AssignCreatorFormState,
  formData: FormData
) => Promise<import("@/features/creators/types").AssignCreatorFormState>;

type CreatorSearchProps = {
  campaignId: string;
  assignAction: AssignAction;
  excludeCreatorIds?: string[];
  cancelHref: string;
};

export function CreatorSearch({
  campaignId,
  assignAction,
  excludeCreatorIds = [],
  cancelHref,
}: CreatorSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Creator[]>([]);
  const [selectedCreator, setSelectedCreator] = useState<Creator | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, startSearch] = useTransition();

  function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearchError(null);
    setSelectedCreator(null);

    startSearch(async () => {
      try {
        const creators = await searchCreatorsAction(query);
        const filtered = creators.filter(
          (creator) => !excludeCreatorIds.includes(creator.id)
        );
        setResults(filtered);
      } catch {
        setSearchError("Arama sırasında bir hata oluştu.");
        setResults([]);
      }
    });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSearch} className="flex flex-wrap gap-3">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Kullanıcı adı, görünen ad veya platform ara…"
          className="h-10 min-w-[240px] flex-1 rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 text-sm text-white outline-none focus:border-orange-500/60 focus:ring-2 focus:ring-orange-500/20"
        />
        <button
          type="submit"
          disabled={isSearching}
          className="h-10 rounded-lg bg-zinc-800 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60"
        >
          {isSearching ? "Aranıyor…" : "Ara"}
        </button>
      </form>

      {searchError ? (
        <p className="text-sm text-red-400">{searchError}</p>
      ) : null}

      {results.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm text-zinc-400">{results.length} sonuç</p>
          <ul className="divide-y divide-zinc-800 rounded-lg border border-zinc-800">
            {results.map((creator) => (
              <li key={creator.id}>
                <button
                  type="button"
                  onClick={() => setSelectedCreator(creator)}
                  className={cn(
                    "flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-zinc-900/60",
                    selectedCreator?.id === creator.id && "bg-zinc-900/80"
                  )}
                >
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
                  <div className="flex items-center gap-2">
                    <CreatorPlatformBadge platform={creator.platform} />
                    <CreatorCategoryBadge category={creator.category} />
                    <span className="text-xs text-zinc-400 tabular-nums">
                      <CompactCountText
                        value={creator.follower_count}
                        variant="management"
                      />
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : query && !isSearching ? (
        <p className="text-sm text-zinc-500">Sonuç bulunamadı.</p>
      ) : null}

      {selectedCreator ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
          <p className="mb-4 text-sm text-zinc-300">
            <span className="text-white">@{selectedCreator.username}</span>{" "}
            kampanyaya eklenecek.
          </p>
          <AssignCreatorForm
            action={(prevState, formData) =>
              assignAction(campaignId, selectedCreator.id, prevState, formData)
            }
            submitLabel="Kampanyaya Ekle"
            cancelHref={cancelHref}
          />
        </div>
      ) : null}
    </div>
  );
}
