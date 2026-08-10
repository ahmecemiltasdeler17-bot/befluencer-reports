import type { ReactNode } from "react";

import type { ReportLinkOrNull } from "@/lib/report-links/types";
import { cn } from "@/lib/utils";

interface ReportCreatorLinkProps {
  /** Resolved profile link, or null when no safe URL exists. */
  link: ReportLinkOrNull;
  children: ReactNode;
  /** Applied to both the anchor and the plain fallback so layout is identical. */
  className?: string;
  /** Optional native tooltip (creator identity). */
  title?: string;
}

/**
 * Wraps creator avatars and handles with a real external anchor when a profile
 * URL is available. Without a URL it renders a plain span carrying the same
 * classes, so the report never shows a dead click target.
 *
 * A native anchor is used deliberately: these are external destinations, so the
 * client router must not be involved, and the href survives into the PDF where
 * Chrome turns it into a clickable annotation.
 */
export function ReportCreatorLink({
  link,
  children,
  className,
  title,
}: ReportCreatorLinkProps) {
  if (!link) {
    return (
      <span className={className} title={title}>
        {children}
      </span>
    );
  }

  return (
    <a
      href={link.href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={link.label}
      title={title}
      className={cn(
        "group/report-link rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--report-accent)]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--report-bg)]",
        "transition-opacity hover:opacity-90 print:transition-none print:hover:opacity-100",
        className
      )}
    >
      {children}
    </a>
  );
}
