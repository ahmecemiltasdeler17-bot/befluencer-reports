import { ExternalLink } from "lucide-react";

import { CompactCountText } from "@/components/format/compact-count-text";
import { ReportCreatorLink } from "@/components/report/links/report-creator-link";
import { CREATOR_CATEGORY_SHORT_LABELS } from "@/lib/content-helpers";
import { formatTurkishPercent, formatTurkishReport } from "@/lib/format";
import { resolveCreatorLink } from "@/lib/report-links/resolve-report-links";
import type { Creator } from "@/lib/types";
import { cn } from "@/lib/utils";

import { SafeAvatar } from "./safe-media";

interface CreatorRankingCardProps {
  creator: Creator;
  totalReach: number;
  isLeader?: boolean;
  /** Highest contribution share in the list — scales the mini bar only. */
  maxContribution?: number;
}

/**
 * Compact ranking module used inside the two-column leaderboard grid.
 * Every figure comes from the snapshot; the bar length is a presentation
 * scaling of the real contribution share.
 */
export function CreatorRankingCard({
  creator,
  totalReach,
  isLeader = false,
  maxContribution = 100,
}: CreatorRankingCardProps) {
  const contribution = totalReach > 0 ? (creator.views / totalReach) * 100 : 0;
  const contributionLabel = `${contribution.toFixed(1).replace(".", ",")}%`;
  const barWidth =
    maxContribution > 0
      ? Math.max(3, Math.min(100, (contribution / maxContribution) * 100))
      : 0;
  const creatorLink = resolveCreatorLink({
    profileUrl: creator.profileUrl,
    platform: creator.platform,
    handle: creator.handle,
  });

  return (
    <li
      className={cn(
        "report-ranking-card report-interactive pdf-avoid-break px-3.5 py-3",
        isLeader && "report-ranking-card--leader"
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "w-6 shrink-0 text-sm font-semibold tabular-nums",
            isLeader
              ? "text-[var(--report-accent)]"
              : creator.rank <= 3
                ? "text-[var(--report-text)]"
                : "text-[var(--report-text-tertiary)]"
          )}
        >
          {creator.rank}
        </span>

        <ReportCreatorLink link={creatorLink} className="block shrink-0">
          <SafeAvatar
            src={creator.avatar}
            name={creator.displayName}
            seed={creator.id}
            size={38}
            className="report-ranking-card__avatar"
          />
        </ReportCreatorLink>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            {/* The profile affordance lives in the trailing action button, so
                the handle stays a clean, truncatable label. */}
            <ReportCreatorLink
              link={creatorLink}
              className="report-interactive min-w-0 truncate text-sm font-medium text-[var(--report-text)]"
            >
              {creator.handle}
            </ReportCreatorLink>
            {isLeader ? (
              <span className="shrink-0 rounded-full bg-[var(--report-accent)]/12 px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.1em] text-[var(--report-accent)] uppercase">
                Lider
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-[11px] text-[var(--report-text-tertiary)]">
            <CompactCountText value={creator.followers} showNoun /> ·{" "}
            {creator.videos} içerik ·{" "}
            {CREATOR_CATEGORY_SHORT_LABELS[creator.category]}
          </p>
        </div>

        <div className="hidden shrink-0 items-start gap-4 text-right min-[560px]:flex">
          <KpiCell
            label="izlenme"
            value={formatTurkishReport(creator.views)}
            valueClassName="text-[var(--report-text)]"
          />
          <KpiCell
            label="etkileşim"
            value={formatTurkishPercent(creator.engagementRate)}
            valueClassName="text-[var(--report-text-secondary)]"
          />
        </div>

        {creatorLink ? (
          <a
            href={creatorLink.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={creatorLink.label}
            className="report-ranking-card__action report-interactive report-focus-ring screen-only flex size-7 shrink-0 items-center justify-center rounded-full text-[var(--report-text-tertiary)] hover:text-[var(--report-accent)] print:hidden"
          >
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        ) : null}
      </div>

      <div className="mt-2.5 flex items-center gap-3">
        <div className="report-bar-track min-w-0 flex-1">
          <div className="report-bar-fill" style={{ width: `${barWidth}%` }} />
        </div>
        <span
          className="shrink-0 text-[11px] font-medium text-[var(--report-accent-soft)] tabular-nums"
          aria-label={`Kampanya erişimine katkı: ${contributionLabel}`}
        >
          {contributionLabel} katkı
        </span>
      </div>

      <div className="mt-2 flex items-center gap-4 text-[11px] text-[var(--report-text-secondary)] min-[560px]:hidden">
        <span className="tabular-nums">
          {formatTurkishReport(creator.views)} izlenme
        </span>
        <span className="tabular-nums">
          {formatTurkishPercent(creator.engagementRate)} etkileşim
        </span>
      </div>
    </li>
  );
}

function KpiCell({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div>
      <p
        className={cn(
          "text-sm font-semibold tabular-nums",
          valueClassName ?? "text-[var(--report-text)]"
        )}
      >
        {value}
      </p>
      <p className="text-[9px] tracking-[0.1em] text-[var(--report-text-tertiary)] uppercase">
        {label}
      </p>
    </div>
  );
}
