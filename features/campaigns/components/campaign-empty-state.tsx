import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CampaignEmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 px-6 py-16 text-center">
      <h2 className="text-lg font-medium text-white">Henüz kampanya yok</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-zinc-400">
        İlk müzik kampanyanızı oluşturarak sanatçı, şarkı ve rapor bilgilerini
        kaydedin.
      </p>
      <Link
        href="/campaigns/new"
        className={cn(
          buttonVariants({ variant: "default" }),
          "mt-6 bg-orange-500 text-white hover:bg-orange-500/90"
        )}
      >
        Yeni Kampanya
      </Link>
    </div>
  );
}
