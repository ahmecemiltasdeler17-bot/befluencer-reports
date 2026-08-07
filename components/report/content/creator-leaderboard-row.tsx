import { ExternalLink } from "lucide-react";

import { CompactCountText } from "@/components/format/compact-count-text";
import { ReportCreatorLink } from "@/components/report/links/report-creator-link";
import { ReportExternalLinkIcon } from "@/components/report/links/report-external-link-icon";
import {
  CREATOR_CATEGORY_LABELS,
} from "@/lib/content-helpers";
import { formatTurkishPercent, formatTurkishReport } from "@/lib/format";
import { resolveCreatorLink } from "@/lib/report-links/resolve-report-links";
import type { Creator } from "@/lib/types";
import { cn } from "@/lib/utils";

import { SafeAvatar } from "./safe-media";

interface CreatorLeaderboardRowProps {
  creator: Creator;
  totalReach: number;
  isLeader?: boolean;
}

export function CreatorLeaderboardRow({
  creator,
  totalReach,
  isLeader = false,
}: CreatorLeaderboardRowProps) {
  const contribution = (creator.views / totalReach) * 100;
  const creatorLink = resolveCreatorLink({
    profileUrl: creator.profileUrl,
    platform: creator.platform,
    handle: creator.handle,
  });

  return (
    <article
      className={cn(
        "pdf-avoid-break grid grid-cols-[auto_1fr_auto] items-center gap-4 border-b border-white/[0.05] px-4 py-4 last:border-b-0 min-[800px]:grid-cols-[auto_auto_minmax(0,1.4fr)_auto_auto_auto_auto]",
        isLeader && "bg-white/[0.015] py-5"
      )}
    >
      <span
        className={cn(
          "w-8 text-sm font-semibold tabular-nums",
          isLeader ? "text-white" : "text-zinc-500"
        )}
      >
        {creator.rank}
      </span>

      <ReportCreatorLink link={creatorLink} className="block">
        <SafeAvatar
          src={creator.avatar}
          name={creator.displayName}
          seed={creator.id}
          size={40}
        />
      </ReportCreatorLink>

      <div className="min-w-0 col-span-1 min-[800px]:col-span-1">
        <div className="flex flex-wrap items-center gap-2">
          <ReportCreatorLink
            link={creatorLink}
            className={cn(
              "flex min-w-0 items-center gap-1.5 text-sm font-medium",
              isLeader ? "text-white" : "text-zinc-200"
            )}
          >
            <span className="truncate">{creator.handle}</span>
            {creatorLink && <ReportExternalLinkIcon />}
          </ReportCreatorLink>
          {isLeader && (
            <span className="rounded-full bg-[#FF5A00]/15 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[#FF5A00] uppercase">
              Lider
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-zinc-500">
          <CompactCountText value={creator.followers} showNoun /> ·{" "}
          {creator.videos} içerik · {CREATOR_CATEGORY_LABELS[creator.category]}
        </p>
      </div>

      <div className="hidden text-right min-[800px]:block">
        <p className="text-sm font-semibold text-white tabular-nums">
          {formatTurkishReport(creator.views)}
        </p>
        <p className="text-[10px] tracking-wide text-zinc-500 uppercase">
          İzlenme
        </p>
      </div>

      <div className="hidden min-w-[88px] text-right min-[800px]:block">
        <p className="text-sm font-semibold text-zinc-200 tabular-nums">
          {Number.isFinite(contribution) && totalReach > 0
            ? `${contribution.toFixed(1).replace(".", ",")}%`
            : "—"}
        </p>
        <p className="text-[10px] tracking-wide text-zinc-500 uppercase">
          Katkı
        </p>
      </div>

      <div className="hidden text-right min-[800px]:block">
        <p className="text-sm font-semibold text-white tabular-nums">
          {formatTurkishPercent(creator.engagementRate)}
        </p>
        <p className="text-[10px] tracking-wide text-zinc-500 uppercase">
          Etkileşim
        </p>
      </div>

      <div className="col-start-3 row-start-1 flex items-center justify-end min-[800px]:col-start-auto min-[800px]:row-start-auto">
        {creatorLink && (
          <a
            href={creatorLink.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={creatorLink.label}
            className="screen-only flex size-8 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300 focus-visible:ring-2 focus-visible:ring-[#FF5A00]/70 focus-visible:outline-none print:hidden"
          >
            <ExternalLink className="size-4" aria-hidden />
          </a>
        )}
      </div>

      <div className="col-span-3 min-[800px]:hidden">
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400">
          <span>{formatTurkishReport(creator.views)} izlenme</span>
          <span>
            {Number.isFinite(contribution)
              ? `${contribution.toFixed(1).replace(".", ",")}% katkı`
              : "—"}
          </span>
          <span>{formatTurkishPercent(creator.engagementRate)} etkileşim</span>
        </div>
      </div>
    </article>
  );
}
