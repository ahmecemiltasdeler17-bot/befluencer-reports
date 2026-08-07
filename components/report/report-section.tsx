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
      className={cn("pdf-section report-section mt-16 min-[1100px]:mt-20", className)}
    >
      <div className="flex flex-col gap-4 min-[800px]:flex-row min-[800px]:items-end min-[800px]:justify-between">
        <div className="min-w-0 max-w-2xl">
          {eyebrow ? (
            <p className="text-[11px] font-medium tracking-[0.2em] text-zinc-500 uppercase">
              {eyebrow}
            </p>
          ) : null}
          <h2
            id={id ? `${id}-title` : undefined}
            className="mt-2 text-[24px] font-semibold tracking-tight text-white min-[1100px]:text-[28px]"
          >
            {title}
          </h2>
          {description ? (
            <p className="mt-2 text-sm leading-relaxed text-zinc-400 min-[1100px]:text-base">
              {description}
            </p>
          ) : null}
        </div>
        {aside ? (
          <div className="shrink-0 text-sm text-zinc-500">{aside}</div>
        ) : null}
      </div>
      <div className={cn("mt-8", contentClassName)}>{children}</div>
    </section>
  );
}
