"use client";

import { ReportCreatorLink } from "@/components/report/links/report-creator-link";
import { SafeAvatar } from "@/components/report/content/safe-media";
import { normalizeShowcaseCreators } from "@/features/reports/normalize-creators";
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
 * Rejects strings / primitives so "SIMON" never becomes S,I,M,O,N avatars.
 */
export function dedupeShowcaseCreators(
  creators: ShowcaseCreator[] | unknown
): ShowcaseCreator[] {
  const normalized = normalizeShowcaseCreators(creators);
  const seen = new Set<string>();
  const result: ShowcaseCreator[] = [];

  for (const creator of normalized) {
    if (!creator.id || seen.has(creator.id)) {
      continue;
    }
    seen.add(creator.id);
    result.push(creator);
  }

  return result;
}

/**
 * Split into two visual rows for marquee composition.
 * Presentation-only — does not change creator identity or counts.
 */
export function splitShowcaseRows(
  creators: ShowcaseCreator[]
): [ShowcaseCreator[], ShowcaseCreator[]] {
  if (creators.length <= 8) {
    return [creators, []];
  }
  const mid = Math.ceil(creators.length / 2);
  return [creators.slice(0, mid), creators.slice(mid)];
}

function CreatorAvatarItem({
  creator,
  zIndex,
  enterDelayMs,
  decorative = false,
}: {
  creator: ShowcaseCreator;
  zIndex: number;
  enterDelayMs: number;
  /** Visual marquee clone — hidden from assistive tech. */
  decorative?: boolean;
}) {
  const link = decorative
    ? null
    : creator.handle
      ? resolveCreatorLink({
          profileUrl: creator.profileUrl,
          platform: creator.platform,
          handle: creator.handle,
        })
      : null;
  const label =
    creator.handle?.replace(/^@+/, "") || creator.name || "İçerik üreticisi";

  return (
    <li
      className={cn(
        "report-creator-showcase__item pdf-avoid-break",
        decorative && "report-creator-showcase__clone"
      )}
      style={{
        zIndex,
        animationDelay: decorative ? undefined : `${Math.min(enterDelayMs, 480)}ms`,
      }}
      aria-hidden={decorative || undefined}
    >
      <ReportCreatorLink
        link={link}
        title={decorative ? undefined : `@${label}`}
        className={cn(
          "report-creator-showcase__link block rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--report-accent)]/70",
          decorative && "pointer-events-none"
        )}
      >
        <SafeAvatar
          src={creator.avatar}
          name={creator.name || label}
          seed={creator.id}
          size={52}
          className="report-creator-showcase__avatar ring-2 ring-[var(--report-bg)]"
        />
        {decorative ? null : <span className="sr-only">@{label}</span>}
      </ReportCreatorLink>
    </li>
  );
}

function AvatarRow({
  creators,
  reverse = false,
  enableClone,
  startIndex,
}: {
  creators: ShowcaseCreator[];
  reverse?: boolean;
  enableClone: boolean;
  startIndex: number;
}) {
  if (creators.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "report-creator-showcase__track",
        reverse && "report-creator-showcase__row--reverse"
      )}
    >
      <ul className="report-creator-showcase__list">
        {creators.map((creator, index) => (
          <CreatorAvatarItem
            key={creator.id}
            creator={creator}
            zIndex={creators.length - index}
            enterDelayMs={(startIndex + index) * 28}
          />
        ))}
        {enableClone
          ? creators.map((creator, index) => (
              <CreatorAvatarItem
                key={`clone-${creator.id}`}
                creator={creator}
                zIndex={creators.length - index}
                enterDelayMs={0}
                decorative
              />
            ))
          : null}
      </ul>
    </div>
  );
}

/**
 * Full campaign creator showcase — every unique creator is rendered once for AT.
 * Browser: optional slow marquee with visual clones (aria-hidden via CSS/PDF rules).
 * PDF / reduced-motion: static wrapping layout, no clones.
 */
export function ReportCreatorShowcase({
  creators,
}: {
  creators: ShowcaseCreator[];
}) {
  const unique = dedupeShowcaseCreators(creators);

  if (unique.length === 0) {
    return (
      <p className="text-center text-sm text-[var(--report-text-tertiary)]">
        Bu kampanyada henüz içerik üreticisi yok.
      </p>
    );
  }

  const [rowA, rowB] = splitShowcaseRows(unique);
  const enableMotion = unique.length >= 6;

  return (
    <div
      className={cn(
        "report-creator-showcase",
        enableMotion && "report-creator-showcase--motion"
      )}
      data-report-creator-showcase=""
      data-creator-count={unique.length}
      aria-label={`${unique.length} içerik üreticisi`}
    >
      <div className="report-creator-showcase__rows">
        <AvatarRow
          creators={rowA}
          enableClone={enableMotion}
          startIndex={0}
        />
        <AvatarRow
          creators={rowB}
          reverse
          enableClone={enableMotion}
          startIndex={rowA.length}
        />
      </div>
    </div>
  );
}
