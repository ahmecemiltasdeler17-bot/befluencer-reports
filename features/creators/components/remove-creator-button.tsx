"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { removeCreatorFromCampaign } from "@/features/creators/actions";

export function RemoveCreatorButton({
  campaignId,
  creatorId,
  creatorName,
}: {
  campaignId: string;
  creatorId: string;
  creatorName: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleRemove() {
    const confirmed = window.confirm(
      `"${creatorName}" kampanyadan çıkarılsın mı? İçerik üreticisi global havuzda kalır.`
    );

    if (!confirmed) {
      return;
    }

    startTransition(async () => {
      const result = await removeCreatorFromCampaign(campaignId, creatorId);

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
      variant="ghost"
      size="sm"
      disabled={isPending}
      onClick={handleRemove}
      className="text-red-400 hover:text-red-300"
    >
      {isPending ? "Çıkarılıyor…" : "Kampanyadan Çıkar"}
    </Button>
  );
}
