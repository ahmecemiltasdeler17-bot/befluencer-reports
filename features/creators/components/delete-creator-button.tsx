"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { deleteCreatorsAction } from "@/features/creators/actions";
import { buildSingleCreatorDeleteConfirmMessage } from "@/features/creators/services/delete-creators-core";

/**
 * Row-level hard delete. Always requires browser confirm — never auto-deletes.
 */
export function DeleteCreatorButton({
  creatorId,
  username,
  campaignCount = 0,
  onDeleted,
}: {
  creatorId: string;
  username: string;
  campaignCount?: number;
  onDeleted?: (deletedIds: string[]) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    const confirmed = window.confirm(
      buildSingleCreatorDeleteConfirmMessage({ username, campaignCount })
    );

    if (!confirmed) {
      return;
    }

    startTransition(async () => {
      setError(null);
      const result = await deleteCreatorsAction([creatorId]);

      if (result.deleted && result.deleted > 0) {
        onDeleted?.(result.deletedIds ?? [creatorId]);
        router.refresh();
        return;
      }

      setError(result.error ?? "Silme işlemi tamamlanamadı.");
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={isPending}
        onClick={handleClick}
        className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
      >
        {isPending ? "Siliniyor…" : "Sil"}
      </Button>
      {error ? <p className="max-w-40 text-right text-xs text-red-400">{error}</p> : null}
    </div>
  );
}
