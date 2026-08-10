"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { deleteUnavailableCreatorsAction } from "@/features/creators/actions";

/**
 * Explicit hard-delete for soft-unavailable creators.
 * Never runs without a browser confirm() — no auto cleanup.
 */
export function DeleteUnavailableCreatorsButton({
  creatorIds,
}: {
  creatorIds: string[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  if (creatorIds.length === 0) {
    return null;
  }

  function handleClick() {
    const confirmed = window.confirm(
      `${creatorIds.length} pasif hesap kalıcı olarak silinecek. Bu işlem geri alınamaz. Devam edilsin mi?`
    );

    if (!confirmed) {
      return;
    }

    startTransition(async () => {
      setFeedback(null);
      const result = await deleteUnavailableCreatorsAction(creatorIds);
      if (result.error) {
        setFeedback(result.error);
        return;
      }
      setFeedback(result.success ?? null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={handleClick}
        className="border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
      >
        {isPending ? "Siliniyor…" : "Pasif hesapları sil"}
      </Button>
      {feedback ? (
        <p className="text-xs text-zinc-400">{feedback}</p>
      ) : null}
    </div>
  );
}
