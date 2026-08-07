"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { archiveCampaign } from "@/features/campaigns/actions";

export function ArchiveCampaignButton({
  campaignId,
  campaignName,
  variant = "outline",
  size = "sm",
}: {
  campaignId: string;
  campaignName: string;
  variant?: "outline" | "ghost" | "destructive";
  size?: "default" | "sm" | "xs";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleArchive() {
    const confirmed = window.confirm(
      `"${campaignName}" kampanyasını arşivlemek istediğinize emin misiniz?`
    );

    if (!confirmed) {
      return;
    }

    startTransition(async () => {
      const result = await archiveCampaign(campaignId);

      if (result.error) {
        window.alert(result.error);
        return;
      }

      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={isPending}
      onClick={handleArchive}
      className="text-zinc-300"
    >
      {isPending ? "Arşivleniyor…" : "Arşivle"}
    </Button>
  );
}
