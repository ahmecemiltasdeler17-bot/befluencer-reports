"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { deleteCreatorsAction } from "@/features/creators/actions";
import { buildBulkCreatorDeleteConfirmMessage } from "@/features/creators/services/delete-creators-core";

/**
 * Bulk hard delete for directory selection. Shown only when selection is non-empty.
 */
export function BulkDeleteCreatorsButton({
  selectedIds,
  assignedCount,
  onDeleted,
}: {
  selectedIds: string[];
  /** How many selected creators are assigned to ≥1 campaign (for confirm copy). */
  assignedCount: number;
  onDeleted?: (deletedIds: string[]) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    tone: "ok" | "err";
    text: string;
  } | null>(null);

  if (selectedIds.length === 0) {
    return null;
  }

  function handleClick() {
    const confirmed = window.confirm(
      buildBulkCreatorDeleteConfirmMessage({
        count: selectedIds.length,
        assignedCount,
      })
    );

    if (!confirmed) {
      return;
    }

    startTransition(async () => {
      setFeedback(null);
      const result = await deleteCreatorsAction(selectedIds);

      if (result.deleted && result.deleted > 0) {
        onDeleted?.(result.deletedIds ?? []);
        const summary =
          result.success ??
          `${result.deleted} silindi${
            result.blocked ? ` · ${result.blocked} engellendi (bağlı video)` : ""
          }`;
        setFeedback({
          tone: result.blocked || result.failed ? "err" : "ok",
          text: result.error ? `${summary}. ${result.error}` : summary,
        });
        router.refresh();
        return;
      }

      setFeedback({
        tone: "err",
        text: result.error ?? "Silme işlemi tamamlanamadı.",
      });
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={isPending || selectedIds.length === 0}
        onClick={handleClick}
        className="border-red-500/40 text-red-300 hover:bg-red-500/10"
      >
        {isPending ? "Siliniyor…" : "Seçilenleri Sil"}
      </Button>
      {feedback ? (
        <p
          className={
            feedback.tone === "ok" ? "text-xs text-emerald-400" : "text-xs text-red-400"
          }
        >
          {feedback.text}
        </p>
      ) : null}
    </div>
  );
}
