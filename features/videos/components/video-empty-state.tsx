import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function VideoEmptyState({
  campaignId,
  importAction,
}: {
  campaignId: string;
  importAction?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-800 px-6 py-10 text-center">
      <p className="text-sm text-zinc-400">
        Bu kampanyaya henüz video eklenmedi.
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {importAction}
        <Link
          href={`/campaigns/${campaignId}/videos/new`}
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Manuel Video Ekle
        </Link>
      </div>
    </div>
  );
}
