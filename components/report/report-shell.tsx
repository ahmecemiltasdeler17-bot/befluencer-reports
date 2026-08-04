import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/constants";

interface ReportShellProps {
  children: React.ReactNode;
}

export function ReportShell({ children }: ReportShellProps) {
  return (
    <div className="min-h-screen bg-[#09090B] text-white">
      <header className="sticky top-0 z-50 border-b border-white/6 bg-[#09090B]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 sm:px-10">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-md bg-white text-[11px] font-bold tracking-tight text-zinc-950">
              BF
            </div>
            <span className="text-sm font-medium tracking-tight text-zinc-400">
              {APP_NAME}
            </span>
          </div>
          <Button variant="outline" size="sm" className="border-white/10 bg-transparent">
            <Download className="size-4" />
            Export PDF
          </Button>
        </div>
      </header>

      <article className="mx-auto max-w-6xl px-6 pb-32 sm:px-10">
        {children}
      </article>
    </div>
  );
}
