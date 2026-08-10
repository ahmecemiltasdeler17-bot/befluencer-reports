import { BeFluencerMark } from "@/components/report/brand/befluencer-mark";
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
 * Professional report identity / metadata for the impact cover.
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

  const metaItems = [
    reportNumber ? { label: "Rapor", value: reportNumber } : null,
    versionLabel ? { label: "Sürüm", value: versionLabel } : null,
    date ? { label: "Oluşturulma", value: date } : null,
    period ? { label: "Dönem", value: period } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return (
    <header className="report-cover__meta relative z-[1]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <BeFluencerMark />
            {contextLabel ? (
              <span className="rounded-full border border-[var(--report-border)] bg-[var(--report-surface-hover)] px-2.5 py-1 text-[10px] font-medium tracking-[0.12em] text-[var(--report-text-secondary)] uppercase">
                {contextLabel}
              </span>
            ) : null}
            <span className="rounded-full border border-[var(--report-border)] px-2.5 py-1 text-[10px] font-medium tracking-[0.12em] text-[var(--report-text-tertiary)] uppercase">
              TikTok
            </span>
          </div>

          {client ? (
            <p className="text-sm text-[var(--report-text-secondary)]">
              <span className="text-[var(--report-text-tertiary)]">Marka</span>
              <span className="mx-2 text-[var(--report-text-tertiary)]">·</span>
              <span className="font-medium text-[var(--report-text)]">{client}</span>
            </p>
          ) : null}
        </div>

        <div className="flex flex-col items-start gap-2 min-[800px]:items-end">
          <dl className="report-cover__meta-grid flex flex-wrap gap-x-5 gap-y-2 text-left min-[800px]:justify-end min-[800px]:text-right">
            {metaItems.map((item) => (
              <div key={`${item.label}-${item.value}`} className="min-w-0">
                <dt className="text-[10px] font-medium tracking-[0.12em] text-[var(--report-text-tertiary)] uppercase">
                  {item.label}
                </dt>
                <dd className="mt-0.5 text-xs font-medium text-[var(--report-text-secondary)] tabular-nums">
                  {item.label === "Dönem" ? (
                    <>
                      <span className="sr-only">Dönem </span>
                      {item.value}
                    </>
                  ) : (
                    item.value
                  )}
                </dd>
              </div>
            ))}
          </dl>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--report-text-tertiary)] min-[800px]:justify-end">
            {soundUrl ? (
              <a
                href={soundUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-[var(--report-accent)] underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-[var(--report-accent)]/70 focus-visible:outline-none"
              >
                Kampanya sesi
              </a>
            ) : null}
            {freshness && presentationContext === "live" ? (
              <ReportFreshnessIndicator freshness={freshness} />
            ) : null}
          </div>
        </div>
      </div>
      <p className="sr-only">{APP_NAME}</p>
    </header>
  );
}
