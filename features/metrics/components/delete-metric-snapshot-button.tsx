"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { deleteVideoMetricSnapshot, deleteSoundMetricSnapshot } from "@/features/metrics/actions";

export function DeleteMetricSnapshotButton({
  snapshotId,
  type,
}: {
  snapshotId: string;
  type: "video" | "sound";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    const confirmed = window.confirm(
      "Bu metrik kaydını silmek istediğinize emin misiniz?"
    );

    if (!confirmed) {
      return;
    }

    startTransition(async () => {
      const result =
        type === "video"
          ? await deleteVideoMetricSnapshot(snapshotId)
          : await deleteSoundMetricSnapshot(snapshotId);

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
      onClick={handleDelete}
      className="text-red-400 hover:text-red-300"
    >
      {isPending ? "Siliniyor…" : "Sil"}
    </Button>
  );
}
