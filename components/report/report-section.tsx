import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function ReportSection({
  id,
  eyebrow,
  title,
  description,
  aside,
  children,
  className,
  contentClassName,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={id ? `${id}-title` : undefined}
      className={cn(
        "pdf-section report-section mt-14 min-[1100px]:mt-16",
        className
      )}
    >
      <div className="report-section__heading flex flex-col gap-4 min-[800px]:flex-row min-[800px]:items-end min-[800px]:justify-between">
        <div className="min-w-0 max-w-2xl">
          {eyebrow ? (
            <p className="text-[11px] font-medium tracking-[0.14em] text-[var(--report-text-tertiary)] uppercase">
              {eyebrow}
            </p>
          ) : null}
          <h2
            id={id ? `${id}-title` : undefined}
            className="mt-2 text-[24px] font-semibold tracking-tight text-[var(--report-text)] min-[1100px]:text-[28px]"
          >
            {title}
          </h2>
          {description ? (
            <p className="mt-2 text-sm leading-relaxed text-[var(--report-text-secondary)] min-[1100px]:text-[15px]">
              {description}
            </p>
          ) : null}
        </div>
        {aside ? (
          <div className="shrink-0 text-sm text-[var(--report-text-tertiary)]">
            {aside}
          </div>
        ) : null}
      </div>
      <div className={cn("mt-7", contentClassName)}>{children}</div>
    </section>
  );
}
