"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { deleteVideo } from "@/features/videos/actions";

export function DeleteVideoButton({
  campaignId,
  videoId,
}: {
  campaignId: string;
  videoId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    const confirmed = window.confirm(
      "Bu videoyu silmek istediğinize emin misiniz? Metrik geçmişi varsa video kaldırıldı olarak işaretlenecek."
    );

    if (!confirmed) {
      return;
    }

    startTransition(async () => {
      const result = await deleteVideo(campaignId, videoId);

      if (result.error) {
        window.alert(result.error);
        return;
      }

      if (result.softDeleted) {
        router.refresh();
        return;
      }

      router.push(`/campaigns/${campaignId}`);
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={isPending}
      onClick={handleDelete}
      className="text-red-400 hover:text-red-300"
    >
      {isPending ? "Siliniyor…" : "Sil"}
    </Button>
  );
}
