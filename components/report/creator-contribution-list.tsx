import { formatTurkishReport } from "@/lib/format";
import type { Creator } from "@/lib/types";

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
  }));

  if (otherViews > 0) {
    rows.push({
      id: "others",
      handle: "Diğerleri",
      avatar: "",
      views: otherViews,
      percentage: (otherViews / totalReach) * 100,
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
      <h3 className="text-[11px] font-medium tracking-[0.24em] text-zinc-500 uppercase">
        Erişim Katkısı
      </h3>

      <div className="mt-8 space-y-7">
        {rows.map((row) => (
          <div key={row.id} className="space-y-3">
            <div className="flex items-center gap-3">
              {row.avatar ? (
                <SafeAvatar
                  src={row.avatar}
                  name={row.handle.replace("@", "")}
                  seed={row.id}
                  size={36}
                />
              ) : (
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-medium text-zinc-400 ring-1 ring-white/10">
                  +
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-sm font-medium text-white">
                    {row.handle}
                  </p>
                  <div className="flex shrink-0 items-baseline gap-3 text-sm tabular-nums">
                    <span className="font-semibold text-[#FF5A00]">
                      {row.percentage.toFixed(1).replace(".", ",")}%
                    </span>
                    <span className="text-zinc-400">
                      {formatTurkishReport(row.views)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-[#FF5A00] transition-all"
                style={{
                  width: `${(row.percentage / maxPercentage) * 100}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
