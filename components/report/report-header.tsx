import { APP_NAME } from "@/lib/constants";
import { formatTurkishDate } from "@/lib/format";
import type { Campaign, SoundGrowth } from "@/lib/types";
import { isSafeExternalUrl } from "@/lib/report-links/is-safe-external-url";

import { ReportFreshnessIndicator } from "./report-freshness";
import type { ReportFreshness } from "@/features/reports/types";
import {
  formatReportPeriod,
  reportContextLabel,
  type ReportPresentationContext,
} from "./report-presentation";

interface ReportHeaderProps {
  campaign: Campaign;
  reportNumber?: string;
  reportDate?: string;
  freshness?: ReportFreshness;
  presentationContext?: ReportPresentationContext;
  versionLabel?: string;
  soundGrowth?: SoundGrowth;
}

/**
 * Compact report identity / metadata row for the impact hero.
 */
export function ReportHeader({
  campaign,
  reportNumber,
  reportDate,
  freshness,
  presentationContext,
  versionLabel,
  soundGrowth,
}: ReportHeaderProps) {
  const date = reportDate ?? formatTurkishDate(campaign.endDate);
  const contextLabel = reportContextLabel(presentationContext);
  const period = formatReportPeriod(campaign.startDate, campaign.endDate);
  const client = campaign.client?.trim() || null;
  const soundUrlCandidate =
    soundGrowth?.soundUrl?.trim() || campaign.soundUrl?.trim() || "";
  const soundUrl = isSafeExternalUrl(soundUrlCandidate)
    ? soundUrlCandidate
    : null;

  const metaBits = [
    reportNumber ? `Rapor ${reportNumber}` : null,
    date,
    period ? `Dönem ${period}` : null,
    versionLabel,
  ].filter(Boolean);

  return (
    <header className="report-cover__meta relative z-[1]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[11px] font-semibold tracking-[0.22em] text-zinc-200 uppercase">
            BeFluencer
          </p>
          {contextLabel ? (
            <span className="rounded-full border border-white/[0.1] bg-white/[0.04] px-2.5 py-1 text-[10px] font-medium tracking-[0.14em] text-zinc-300 uppercase">
              {contextLabel}
            </span>
          ) : null}
          <span className="rounded-full border border-white/[0.08] px-2.5 py-1 text-[10px] font-medium tracking-[0.14em] text-zinc-500 uppercase">
            TikTok
          </span>
          {client ? (
            <span className="text-xs text-zinc-400">{client}</span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
          {metaBits.map((bit) => (
            <span key={String(bit)}>{bit}</span>
          ))}
          {soundUrl ? (
            <a
              href={soundUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[#FF8A4C] underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-[#FF5A00]/70 focus-visible:outline-none"
            >
              Kampanya sesi
            </a>
          ) : null}
          {freshness && presentationContext === "live" ? (
            <ReportFreshnessIndicator freshness={freshness} />
          ) : null}
        </div>
      </div>
      <p className="sr-only">{APP_NAME}</p>
    </header>
  );
}
