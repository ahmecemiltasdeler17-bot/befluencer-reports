import { ExternalLink } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Screen-only affordance that hints a link opens an external profile or post.
 * Rendered inside the anchor but hidden in print, where it has no meaning, and
 * reserved with opacity rather than mounting so hovering causes no layout shift.
 */
export function ReportExternalLinkIcon({ className }: { className?: string }) {
  return (
    <ExternalLink
      aria-hidden
      className={cn(
        "screen-only size-3 shrink-0 opacity-0 transition-opacity group-hover/report-link:opacity-60 group-focus-visible/report-link:opacity-60 print:hidden",
        className
      )}
    />
  );
}
