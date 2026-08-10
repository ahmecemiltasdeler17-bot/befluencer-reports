import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus } from "lucide-react";

import { formatTurkishReport } from "@/lib/format";
import type { TotalReach } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Absolute gain since the earliest stored observation.
 * `null` when a start comparison is not available (same rules as growth %).
 */
export function deriveAbsoluteGrowth(totalReach: TotalReach): number | null {
  if (totalReach.growthSinceStart === null) return null;
  return totalReach.value - totalReach.previousValue;
}

/**
 * Premium, truthful framing of campaign-start → current growth.
 * Every figure is taken from `totalReach` — nothing is invented or scaled.
 */
export function ReportGrowthStory({ totalReach }: { totalReach: TotalReach }) {
  const growth = totalReach.growthSinceStart;
  const absolute = deriveAbsoluteGrowth(totalReach);

  if (growth === null) {
    return (
      <div className="report-growth-story report-growth-story--neutral mx-auto mt-5 max-w-xl">
        <p className="text-sm text-[var(--report-text-tertiary)]">
          Henüz karşılaştırma yok
        </p>
      </div>
    );
  }

  const tone = growth > 0 ? "positive" : growth < 0 ? "negative" : "neutral";
  const Icon =
    growth > 0 ? ArrowUpRight : growth < 0 ? ArrowDownRight : Minus;
  const signedPercent = `${growth > 0 ? "+" : ""}${growth
    .toFixed(1)
    .replace(".", ",")}%`;

  return (
    <div
      className={cn(
        "report-growth-story mx-auto mt-6 max-w-2xl",
        tone === "positive" && "report-growth-story--positive",
        tone === "negative" && "report-growth-story--negative",
        tone === "neutral" && "report-growth-story--neutral"
      )}
      data-growth-tone={tone}
    >
      <div className="flex flex-col items-center gap-4 min-[700px]:flex-row min-[700px]:items-stretch min-[700px]:justify-center min-[700px]:gap-0">
        <div className="flex flex-col items-center px-5 min-[700px]:min-w-[10.5rem]">
          <p
            className={cn(
              "flex items-center gap-1.5 text-[clamp(1.65rem,3.5vw,2.15rem)] font-semibold tracking-tight tabular-nums",
              tone === "positive" && "text-[var(--report-accent)]",
              tone === "negative" && "text-[var(--report-destructive)]",
              tone === "neutral" && "text-[var(--report-text-secondary)]"
            )}
            aria-label={`Kampanya büyümesi: ${signedPercent}`}
          >
            <Icon className="size-5 shrink-0" aria-hidden />
            {signedPercent}
          </p>
          <p className="mt-1 text-[11px] tracking-[0.12em] text-[var(--report-text-tertiary)] uppercase">
            Kampanya büyümesi
          </p>
        </div>

        {absolute !== null ? (
          <>
            <div
              className="hidden w-px self-stretch bg-[var(--report-border)] min-[700px]:block"
              aria-hidden
            />
            <div className="flex flex-col items-center px-5 min-[700px]:min-w-[10.5rem]">
              <p
                className={cn(
                  "text-[clamp(1.35rem,2.8vw,1.75rem)] font-semibold tracking-tight tabular-nums",
                  absolute > 0
                    ? "text-[var(--report-text)]"
                    : "text-[var(--report-text-secondary)]"
                )}
                aria-label={`Net izlenme değişimi: ${formatTurkishReport(absolute)}`}
              >
                {absolute > 0 ? "+" : ""}
                {formatTurkishReport(absolute)}
              </p>
              <p className="mt-1 text-[11px] tracking-[0.12em] text-[var(--report-text-tertiary)] uppercase">
                Net izlenme
              </p>
            </div>
          </>
        ) : null}

        <div
          className="hidden w-px self-stretch bg-[var(--report-border)] min-[700px]:block"
          aria-hidden
        />

        <div className="flex items-center gap-2.5 px-5 text-sm tabular-nums">
          <div className="text-center">
            <p className="text-[10px] tracking-[0.12em] text-[var(--report-text-tertiary)] uppercase">
              Başlangıç
            </p>
            <p className="mt-1 font-medium text-[var(--report-text-secondary)]">
              {formatTurkishReport(totalReach.previousValue)}
            </p>
          </div>
          <ArrowRight
            className="size-3.5 shrink-0 text-[var(--report-steel)]"
            aria-hidden
          />
          <div className="text-center">
            <p className="text-[10px] tracking-[0.12em] text-[var(--report-text-tertiary)] uppercase">
              Güncel
            </p>
            <p className="mt-1 font-semibold text-[var(--report-text)]">
              {formatTurkishReport(totalReach.value)}
            </p>
          </div>
        </div>
      </div>

      <p className="mt-3 text-center text-[11px] text-[var(--report-text-tertiary)]">
        İlk ölçümden bugüne kampanya büyümesi
      </p>
    </div>
  );
}
