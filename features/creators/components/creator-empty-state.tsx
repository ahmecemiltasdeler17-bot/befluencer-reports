import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CreatorEmptyState({
  campaignId,
}: {
  campaignId: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-800 px-6 py-10 text-center">
      <p className="text-sm text-zinc-400">
        Bu kampanyaya henüz içerik üreticisi eklenmedi.
      </p>
      <Link
        href={`/campaigns/${campaignId}/creators/add`}
        className={cn(
          buttonVariants({ variant: "default" }),
          "mt-4 bg-orange-500 text-white hover:bg-orange-500/90"
        )}
      >
        İlk İçerik Üreticisini Ekle
      </Link>
    </div>
  );
}
