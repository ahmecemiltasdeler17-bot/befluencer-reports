import { ReportCreatorLink } from "@/components/report/links/report-creator-link";
import { ReportExternalLinkIcon } from "@/components/report/links/report-external-link-icon";
import { formatTurkishReport } from "@/lib/format";
import { resolveCreatorLink } from "@/lib/report-links/resolve-report-links";
import type { ReportLinkOrNull } from "@/lib/report-links/types";
import type { Creator } from "@/lib/types";
import { cn } from "@/lib/utils";

import { SafeAvatar } from "./content/safe-media";

interface CreatorContributionListProps {
  creators: Creator[];
  totalReach: number;
}

interface ContributionRow {
  id: string;
  handle: string;
  avatar: string;
  views: number;
  percentage: number;
  link: ReportLinkOrNull;
}

function buildContributions(
  creators: Creator[],
  totalReach: number
): ContributionRow[] {
  const sorted = [...creators].sort((a, b) => b.views - a.views);
  const top = sorted.slice(0, 4);
  const topViews = top.reduce((sum, creator) => sum + creator.views, 0);
  const otherViews = Math.max(totalReach - topViews, 0);

  const rows: ContributionRow[] = top.map((creator) => ({
    id: creator.id,
    handle: creator.handle,
    avatar: creator.avatar,
    views: creator.views,
    percentage: (creator.views / totalReach) * 100,
    link: resolveCreatorLink({
      profileUrl: creator.profileUrl,
      platform: creator.platform,
      handle: creator.handle,
    }),
  }));

  if (otherViews > 0) {
    rows.push({
      id: "others",
      handle: "Diğerleri",
      avatar: "",
      views: otherViews,
      percentage: (otherViews / totalReach) * 100,
      // The aggregate row represents many creators, so it is never a link.
      link: null,
    });
  }

  return rows;
}

export function CreatorContributionList({
  creators,
  totalReach,
}: CreatorContributionListProps) {
  const rows = buildContributions(creators, totalReach);
  const maxPercentage = Math.max(...rows.map((row) => row.percentage), 1);

  return (
    <section aria-label="Erişim katkısı" className="w-full">
      <h3 className="text-[11px] font-medium tracking-[0.16em] text-[var(--report-text-tertiary)] uppercase">
        Erişim Katkısı
      </h3>

      <div className="mt-7 space-y-3.5">
        {rows.map((row) => {
          const isOthers = row.id === "others";

          return (
            <div
              key={row.id}
              className="report-contribution-row report-interactive space-y-2.5"
            >
              <div className="flex items-center gap-3">
                {row.avatar ? (
                  <ReportCreatorLink link={row.link} className="block shrink-0">
                    <SafeAvatar
                      src={row.avatar}
                      name={row.handle.replace("@", "")}
                      seed={row.id}
                      size={36}
                      className="report-contribution-row__avatar"
                    />
                  </ReportCreatorLink>
                ) : (
                  <div className="report-contribution-row__avatar flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--report-surface-elevated)] text-xs font-medium text-[var(--report-text-tertiary)] ring-1 ring-[var(--report-border)]">
                    +
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <ReportCreatorLink
                      link={row.link}
                      className={cn(
                        "report-interactive flex min-w-0 items-center gap-1.5 text-sm font-medium",
                        isOthers
                          ? "text-[var(--report-text-tertiary)]"
                          : "text-[var(--report-text-secondary)] hover:text-[var(--report-text)]"
                      )}
                    >
                      <span className="truncate">{row.handle}</span>
                      {row.link && <ReportExternalLinkIcon />}
                    </ReportCreatorLink>
                    <div className="flex shrink-0 items-baseline gap-3 text-sm tabular-nums">
                      <span
                        className={cn(
                          "font-semibold",
                          isOthers
                            ? "text-[var(--report-text-secondary)]"
                            : "text-[var(--report-accent)]"
                        )}
                      >
                        {row.percentage.toFixed(1).replace(".", ",")}%
                      </span>
                      <span className="text-[var(--report-text-secondary)]">
                        {formatTurkishReport(row.views)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="report-bar-track">
                <div
                  className={cn(
                    "report-bar-fill",
                    isOthers && "report-bar-fill--muted"
                  )}
                  style={{
                    width: `${(row.percentage / maxPercentage) * 100}%`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
