import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Shared report page frame for live / historical / public / print surfaces.
 * Keeps background, width and padding consistent without touching report data.
 */
export function ReportCanvas({
  children,
  className,
  innerClassName,
  pdf = false,
  topSlot,
}: {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  /** Print/PDF capture route — adds pdf-document helpers. */
  pdf?: boolean;
  /** Optional chrome above the shared report body (nav, public header, etc.). */
  topSlot?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "report-canvas min-h-screen font-sans text-[var(--report-text)]",
        pdf && "pdf-document",
        className
      )}
    >
      <div
        className={cn(
          "report-canvas__inner relative mx-auto max-w-[1360px]",
          pdf ? "pdf-canvas px-10 pt-8 pb-6" : "px-6 pt-10 pb-8 min-[1100px]:px-12",
          innerClassName
        )}
      >
        {topSlot}
        {children}
      </div>
    </div>
  );
}
