import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CampaignEmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-bf-border bg-bf-surface/40 px-6 py-16 text-center">
      <h2 className="text-lg font-medium text-bf-text">Henüz kampanya yok</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-bf-steel">
        İlk müzik kampanyanızı oluşturarak sanatçı, şarkı ve rapor bilgilerini
        kaydedin.
      </p>
      <Link
        href="/campaigns/new"
        className={cn(buttonVariants({ variant: "default" }), "mt-6")}
      >
        Yeni Kampanya
      </Link>
    </div>
  );
}
