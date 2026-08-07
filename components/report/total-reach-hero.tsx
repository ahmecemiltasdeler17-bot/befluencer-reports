import { CompactCountText } from "@/components/format/compact-count-text";
import {
  ReportCreatorShowcase,
  type ShowcaseCreator,
} from "@/components/report/report-creator-showcase";
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
      className="report-impact relative z-[1] pt-10 pb-2 text-center min-[1100px]:pt-14"
    >
      {campaignTitle ? (
        <h1 className="mx-auto max-w-4xl text-[clamp(2rem,5vw,3.75rem)] leading-[1.05] font-semibold tracking-tight text-white">
          {campaignTitle}
        </h1>
      ) : null}

      {subtitle ? (
        <p className="mx-auto mt-4 max-w-2xl text-base text-zinc-400 min-[1100px]:text-lg">
          {subtitle}
        </p>
      ) : null}

      <p className="mt-10 text-[11px] font-medium tracking-[0.28em] text-zinc-500 uppercase">
        {metricLabel}
      </p>

      <p
        className="mt-4 text-[clamp(3.25rem,10vw,7.5rem)] leading-none font-semibold tracking-tighter text-white tabular-nums"
        title={exact}
        aria-label={`${metricLabel}: ${exact}`}
      >
        <span aria-hidden="true">
          <CompactCountText value={totalReach.value} noun="izlenme" />
        </span>
      </p>

      <div className="mt-4 text-sm text-zinc-500">
        {totalReach.growthSinceStart !== null ? (
          <p>
            Kampanya başlangıcından beri +
            {totalReach.growthSinceStart.toFixed(1).replace(".", ",")}%
          </p>
        ) : (
          <p>Henüz karşılaştırma yok</p>
        )}
      </div>

      <div className="mx-auto mt-10 max-w-5xl min-[1100px]:mt-12">
        <p className="mb-4 text-[11px] font-medium tracking-[0.2em] text-zinc-500 uppercase">
          İçerik Üreticileri
        </p>
        <ReportCreatorShowcase creators={creators} />
      </div>
    </section>
  );
}
