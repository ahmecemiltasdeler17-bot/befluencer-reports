import {
  formatExactFollowerLabel,
  formatExactTurkishCount,
  formatManagementCompactCount,
  formatReportCompactCount,
} from "@/lib/formatters/format-compact-count";
import { cn } from "@/lib/utils";

type CompactCountTextProps = {
  value: number;
  /**
   * `report` keeps trailing zeros (`773,0 B`).
   * `management` strips a trailing `,0` (`773 B`).
   */
  variant?: "report" | "management";
  /** Noun used in the exact accessible label. Defaults to "takipçi". */
  noun?: string;
  /**
   * When true, appends the noun visually after the compact value so the
   * accessible label and visible text stay aligned (no double "takipçi").
   */
  showNoun?: boolean;
  className?: string;
};

/**
 * Compact Turkish count with a native title / aria-label for the exact value.
 * Layout-neutral: no tooltip chrome, no extra wrappers beyond a span.
 */
export function CompactCountText({
  value,
  variant = "report",
  noun = "takipçi",
  showNoun = false,
  className,
}: CompactCountTextProps) {
  const compact =
    variant === "management"
      ? formatManagementCompactCount(value)
      : formatReportCompactCount(value);
  const exact =
    noun === "takipçi"
      ? formatExactFollowerLabel(value)
      : `${formatExactTurkishCount(value)} ${noun}`;

  return (
    <span title={exact} aria-label={exact} className={cn(className)}>
      {compact}
      {showNoun ? ` ${noun}` : null}
    </span>
  );
}
