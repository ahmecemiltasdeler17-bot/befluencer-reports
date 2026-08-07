"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { deleteSoundMetricSnapshotAction } from "@/features/sound-sync/actions";

export function DeleteSoundSnapshotButton({
  snapshotId,
}: {
  snapshotId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    const confirmed = window.confirm(
      "Bu ses kullanım kaydını silmek istediğinize emin misiniz?"
    );

    if (!confirmed) {
      return;
    }

    startTransition(async () => {
      setError(null);
      const result = await deleteSoundMetricSnapshotAction(snapshotId);

      if (result.error) {
        setError(result.error);
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
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
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
    </div>
  );
}
