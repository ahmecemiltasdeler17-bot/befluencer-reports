import { CompactCountText } from "@/components/format/compact-count-text";
import {
  ReportCreatorShowcase,
  type ShowcaseCreator,
} from "@/components/report/report-creator-showcase";
import { ReportGrowthStory } from "@/components/report/report-growth-story";
import { formatExactTurkishCount } from "@/lib/format";
import type { TotalReach } from "@/lib/types";

interface TotalReachHeroProps {
  totalReach: TotalReach;
  creators: ShowcaseCreator[];
  /** Optional subtitle under the campaign title (artist · track). */
  subtitle?: string | null;
  campaignTitle?: string;
}

/**
 * Normalize legacy English mapper labels to the Turkish presentation term for
 * the views aggregate (`totalReach.value` === total views).
 */
export function resolvePrimaryMetricLabel(label?: string | null): string {
  const trimmed = label?.trim();
  if (!trimmed || /^total reach$/i.test(trimmed)) {
    return "Toplam İzlenme";
  }
  return trimmed;
}

/**
 * Impact block: campaign title, primary izlenme metric, full creator showcase.
 * Uses totalReach.value (views aggregate) — label stays aligned with product data.
 */
export function TotalReachHero({
  totalReach,
  creators,
  subtitle,
  campaignTitle,
}: TotalReachHeroProps) {
  const exact = formatExactTurkishCount(totalReach.value);
  const metricLabel = resolvePrimaryMetricLabel(totalReach.label);

  return (
    <section
      aria-label="Kampanya özeti"
      className="report-impact relative z-[1] pt-9 pb-2 text-center min-[1100px]:pt-12"
    >
      {campaignTitle ? (
        <h1 className="mx-auto max-w-4xl text-[clamp(2.1rem,5.2vw,3.85rem)] leading-[1.04] font-semibold tracking-tight text-balance text-[var(--report-text)]">
          {campaignTitle}
        </h1>
      ) : null}

      {subtitle ? (
        <p className="mx-auto mt-3.5 max-w-2xl text-base leading-relaxed text-[var(--report-text-secondary)] min-[1100px]:text-lg">
          {subtitle}
        </p>
      ) : null}

      <p className="mt-9 text-[11px] font-medium tracking-[0.16em] text-[var(--report-text-tertiary)] uppercase min-[1100px]:mt-10">
        {metricLabel}
      </p>

      <p
        className="mt-3 text-[clamp(3.35rem,10vw,7.6rem)] leading-none font-semibold tracking-tighter text-[var(--report-text)] tabular-nums"
        title={exact}
        aria-label={`${metricLabel}: ${exact}`}
      >
        <span aria-hidden="true">
          <CompactCountText value={totalReach.value} noun="izlenme" />
        </span>
      </p>

      <ReportGrowthStory totalReach={totalReach} />

      <div className="mx-auto mt-10 max-w-5xl min-[1100px]:mt-11">
        <p className="mb-4 text-[11px] font-medium tracking-[0.14em] text-[var(--report-text-tertiary)] uppercase">
          İçerik Üreticileri
        </p>
        <ReportCreatorShowcase creators={creators} />
      </div>
    </section>
  );
}
