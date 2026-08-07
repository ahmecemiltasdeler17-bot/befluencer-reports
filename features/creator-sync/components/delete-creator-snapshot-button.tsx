"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { deleteCreatorMetricSnapshotAction } from "@/features/creator-sync/actions";

export function DeleteCreatorSnapshotButton({
  snapshotId,
  isBaseline,
}: {
  snapshotId: string;
  /** The earliest snapshot defines the growth baseline; deleting it shifts it. */
  isBaseline: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    const confirmed = window.confirm(
      isBaseline
        ? "Bu ilk takipçi kaydıdır. Silinirse büyüme başlangıç noktası değişir. Devam etmek istiyor musunuz?"
        : "Bu takipçi kaydını silmek istediğinize emin misiniz?"
    );

    if (!confirmed) {
      return;
    }

    startTransition(async () => {
      const result = await deleteCreatorMetricSnapshotAction(snapshotId);

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
