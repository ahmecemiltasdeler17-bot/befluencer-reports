"use client";

import { ReportCreatorLink } from "@/components/report/links/report-creator-link";
import { SafeAvatar } from "@/components/report/content/safe-media";
import { resolveCreatorLink } from "@/lib/report-links/resolve-report-links";
import type { Platform } from "@/lib/types";
import { cn } from "@/lib/utils";

export type ShowcaseCreator = {
  id: string;
  avatar: string;
  name: string;
  handle?: string;
  platform?: Platform;
  profileUrl?: string | null;
};

/**
 * Deduplicate by stable creator id while preserving first-seen order.
 */
export function dedupeShowcaseCreators(
  creators: ShowcaseCreator[]
): ShowcaseCreator[] {
  const seen = new Set<string>();
  const result: ShowcaseCreator[] = [];

  for (const creator of creators) {
    if (!creator.id || seen.has(creator.id)) {
      continue;
    }
    seen.add(creator.id);
    result.push(creator);
  }

  return result;
}

/**
 * Full campaign creator showcase — every unique creator is rendered.
 * No +N overflow badge. Screen: wrap or compact rail; PDF: wrapping rows.
 */
export function ReportCreatorShowcase({
  creators,
}: {
  creators: ShowcaseCreator[];
}) {
  const unique = dedupeShowcaseCreators(creators);

  if (unique.length === 0) {
    return (
      <p className="text-center text-sm text-zinc-500">
        Bu kampanyada henüz içerik üreticisi yok.
      </p>
    );
  }

  return (
    <div
      className="report-creator-showcase"
      data-report-creator-showcase=""
      data-creator-count={unique.length}
      aria-label={`${unique.length} içerik üreticisi`}
    >
      <ul className="report-creator-showcase__list">
        {unique.map((creator, index) => {
          const link = creator.handle
            ? resolveCreatorLink({
                profileUrl: creator.profileUrl,
                platform: creator.platform,
                handle: creator.handle,
              })
            : null;
          const label =
            creator.handle?.replace(/^@+/, "") ||
            creator.name ||
            "İçerik üreticisi";

          return (
            <li
              key={creator.id}
              className="report-creator-showcase__item pdf-avoid-break"
              style={{ zIndex: unique.length - index }}
            >
              <ReportCreatorLink
                link={link}
                title={`@${label}`}
                className={cn(
                  "report-creator-showcase__link block rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A00]/70"
                )}
              >
                <SafeAvatar
                  src={creator.avatar}
                  name={creator.name || label}
                  seed={creator.id}
                  size={52}
                  className="report-creator-showcase__avatar ring-2 ring-[#09090B]"
                />
                <span className="sr-only">@{label}</span>
              </ReportCreatorLink>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
