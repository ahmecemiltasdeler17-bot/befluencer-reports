import type { Metadata } from "next";

import { CompactCountText } from "@/components/format/compact-count-text";
import { PublicListAccessBeacon } from "@/features/creator-lists/components/public-list-access-beacon";
import { PublicListUnavailable } from "@/features/creator-lists/components/public-list-unavailable";
import { resolvePublicCreatorList } from "@/features/creator-lists/queries";
import {
  isRawShareToken,
  normalizeRouteShareToken,
} from "@/features/creator-lists/token";
import { CreatorAvatar } from "@/features/creators/components/creator-avatar";
import { CreatorCategoryBadge } from "@/features/creators/components/creator-category-badge";
import { CreatorPlatformBadge } from "@/features/creators/components/creator-platform-badge";
import type { CreatorCategory, CreatorPlatform } from "@/features/creators/types";
import { getPublicReportUrl } from "@/lib/origins";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token: routeToken } = await params;
  const token = normalizeRouteShareToken(routeToken);

  const metadata: Metadata = {
    title: "Paylaşılan Creator Listesi",
    robots: {
      index: false,
      follow: false,
      nocache: true,
      noarchive: true,
    },
  };

  if (isRawShareToken(token)) {
    try {
      metadata.alternates = {
        canonical: getPublicReportUrl(`/lists/${token}`),
      };
    } catch {
      // Origin misconfiguration — omit canonical.
    }
  }

  return metadata;
}

export default async function PublicCreatorListPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token: routeToken } = await params;
  const token = normalizeRouteShareToken(routeToken);

  if (!isRawShareToken(token)) {
    return <PublicListUnavailable />;
  }

  const payload = await resolvePublicCreatorList(token);

  if (!payload) {
    return <PublicListUnavailable />;
  }

  const categoryEntries = Object.entries(
    payload.stats.category_distribution ?? {}
  );

  return (
    <div className="min-h-screen bg-[#09090B] font-sans text-zinc-100">
      <PublicListAccessBeacon />
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <header className="space-y-3 border-b border-zinc-800 pb-8">
          <p className="text-sm font-semibold tracking-wide text-primary">
            BeFluencer
          </p>
          <h1 className="text-3xl font-semibold text-white">
            {payload.listName}
          </h1>
          {payload.description ? (
            <p className="max-w-2xl text-sm text-zinc-400">
              {payload.description}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-4 text-sm text-zinc-300">
            <span>{payload.stats.creator_count} creator</span>
            <span>
              Toplam takipçi:{" "}
              <CompactCountText
                value={payload.stats.total_followers}
                variant="management"
              />
            </span>
          </div>
          {categoryEntries.length > 0 ? (
            <div className="flex flex-wrap gap-2 pt-1 text-xs text-zinc-400">
              {categoryEntries.map(([key, count]) => (
                <span
                  key={key}
                  className="rounded-full border border-zinc-800 px-2.5 py-1"
                >
                  {key}: {count}
                </span>
              ))}
            </div>
          ) : null}
          {payload.allowCsvDownload ? (
            <a
              href={`/api/public/creator-lists/${token}/csv`}
              className="inline-flex rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-900"
            >
              CSV İndir
            </a>
          ) : null}
          <p className="text-[11px] text-zinc-600">
            Bu liste canlı creator verilerini gösterir. Üyelik sabittir; takipçi
            ve profil alanları güncellenebilir.
          </p>
        </header>

        <div className="mt-8 space-y-3">
          {payload.creators.map((creator, index) => {
            const profileHref =
              creator.profile_url &&
              /^https?:\/\//i.test(creator.profile_url)
                ? creator.profile_url
                : null;

            return (
              <article
                key={`${creator.username}-${index}`}
                className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 text-xs text-zinc-500">{index + 1}</span>
                  <CreatorAvatar
                    username={creator.username}
                    displayName={creator.display_name}
                    avatarUrl={creator.avatar_url}
                    size="sm"
                  />
                  <div>
                    {profileHref ? (
                      <a
                        href={profileHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-white hover:text-[var(--bf-accent-soft)]"
                      >
                        @{creator.username}
                      </a>
                    ) : (
                      <p className="font-medium text-white">
                        @{creator.username}
                      </p>
                    )}
                    <p className="text-xs text-zinc-500">
                      {creator.display_name ?? "—"}
                    </p>
                    {creator.public_note ? (
                      <p className="mt-1 text-xs text-zinc-400">
                        {creator.public_note}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <CreatorPlatformBadge
                    platform={creator.platform as CreatorPlatform}
                  />
                  <CreatorCategoryBadge
                    category={
                      (creator.category as CreatorCategory | null) ?? null
                    }
                  />
                  <CompactCountText
                    value={Number(creator.follower_count)}
                    variant="management"
                  />
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
