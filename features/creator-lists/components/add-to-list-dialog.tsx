"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { addCreatorsToListAction } from "@/features/creator-lists/actions";
import type { CreatorListSummary } from "@/features/creator-lists/types";

export function AddToListDialog({
  selectedIds,
  lists,
  disabled,
  onAdded,
}: {
  selectedIds: string[];
  lists: Array<Pick<CreatorListSummary, "id" | "name" | "status" | "creator_count">>;
  disabled?: boolean;
  onAdded?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [listId, setListId] = useState(lists[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const activeLists = lists.filter((list) => list.status !== "archived");

  function handleAdd() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await addCreatorsToListAction({
        listId,
        creatorIds: selectedIds,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      setSuccess(result.success ?? "Eklendi.");
      onAdded?.();
      router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled || selectedIds.length === 0 || activeLists.length === 0}
        onClick={() => {
          setError(null);
          setSuccess(null);
          setListId(activeLists[0]?.id ?? "");
          setOpen(true);
        }}
      >
        Mevcut Listeye Ekle
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-to-list-title"
        >
          <div className="w-full max-w-md space-y-4 rounded-lg border border-bf-border bg-bf-elevated p-5 shadow-xl shadow-black/40">
            <div>
              <h2
                id="add-to-list-title"
                className="text-sm font-semibold text-bf-text"
              >
                Mevcut listeye ekle
              </h2>
              <p className="mt-1 text-xs text-bf-steel">
                {selectedIds.length} creator · yinelenenler yok sayılır
              </p>
            </div>

            <label className="block space-y-1 text-xs text-bf-steel">
              Liste
              <select
                value={listId}
                onChange={(event) => setListId(event.target.value)}
                className="h-10 w-full rounded-lg border border-bf-border bg-bf-bg px-3 text-sm text-bf-text outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              >
                {activeLists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.name} ({list.creator_count})
                  </option>
                ))}
              </select>
            </label>

            {error ? <p className="text-xs text-red-400">{error}</p> : null}
            {success ? <p className="text-xs text-emerald-400">{success}</p> : null}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
              >
                Kapat
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isPending || !listId}
                onClick={handleAdd}
              >
                {isPending ? "Ekleniyor…" : "Ekle"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
