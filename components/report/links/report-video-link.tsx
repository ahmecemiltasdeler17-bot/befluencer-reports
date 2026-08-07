import type { ReportLinkOrNull } from "@/lib/report-links/types";
import { cn } from "@/lib/utils";

interface ReportVideoLinkProps {
  /** Resolved video link, or null when the snapshot has no safe URL. */
  link: ReportLinkOrNull;
  className?: string;
}

/**
 * Full-bleed anchor overlay for a video poster.
 *
 * It is an overlay rather than a wrapper so the existing media markup — poster,
 * gradient, play button, platform badge — keeps its exact dimensions and none of
 * those elements end up nested inside another anchor. The overlay sits last in
 * the DOM so it captures clicks across the whole 9:16 area, including the play
 * button. When no URL exists nothing is rendered and the media stays inert.
 */
export function ReportVideoLink({ link, className }: ReportVideoLinkProps) {
  if (!link) {
    return null;
  }

  return (
    <a
      href={link.href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={link.label}
      className={cn(
        "absolute inset-0 z-20 cursor-pointer rounded-[inherit] outline-none",
        "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#FF5A00]",
        "print:cursor-auto",
        className
      )}
    />
  );
}
