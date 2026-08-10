import { cn } from "@/lib/utils";

/** Product brand strings for report surfaces (browser + PDF). */
export const REPORT_BRAND = {
  name: "BeFluencer",
  tagline: "Influencer Marketing Intelligence",
  productLine: "BeFluencer • Influencer Marketing Intelligence",
  reportLine: "TikTok Müzik Kampanya Raporu",
} as const;

type BeFluencerMarkProps = {
  className?: string;
  /** Show compact monogram tile beside the wordmark. */
  showMonogram?: boolean;
  size?: "sm" | "md";
};

/**
 * Discreet BeFluencer wordmark for report chrome.
 * Presentation only — never overlays content.
 */
export function BeFluencerMark({
  className,
  showMonogram = true,
  size = "sm",
}: BeFluencerMarkProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2.5",
        size === "md" && "gap-3",
        className
      )}
      data-report-brand=""
    >
      {showMonogram ? (
        <span
          className={cn(
            "flex shrink-0 items-center justify-center rounded-[5px] bg-[var(--report-accent)] font-semibold tracking-tight text-[var(--report-bg)]",
            size === "sm" && "size-6 text-[9px]",
            size === "md" && "size-7 text-[10px]"
          )}
          aria-hidden="true"
        >
          BF
        </span>
      ) : null}
      <span
        className={cn(
          "font-semibold tracking-[0.18em] text-[var(--report-text)] uppercase",
          size === "sm" && "text-[11px]",
          size === "md" && "text-xs"
        )}
      >
        {REPORT_BRAND.name}
      </span>
    </div>
  );
}
