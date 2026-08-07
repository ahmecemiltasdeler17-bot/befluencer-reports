"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  removeCreatorFromListAction,
  reorderCreatorListItemsAction,
  updateCreatorListItemNotesAction,
} from "@/features/creator-lists/actions";

export function ListItemActions({
  listId,
  itemId,
  orderedItemIds,
  publicNote,
  internalNote,
}: {
  listId: string;
  itemId: string;
  orderedItemIds: string[];
  publicNote: string | null;
  internalNote: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [publicValue, setPublicValue] = useState(publicNote ?? "");
  const [internalValue, setInternalValue] = useState(internalNote ?? "");

  const index = orderedItemIds.indexOf(itemId);

  function move(delta: number) {
    if (index < 0) {
      return;
    }
    const next = [...orderedItemIds];
    const target = index + delta;
    if (target < 0 || target >= next.length) {
      return;
    }
    const [removed] = next.splice(index, 1);
    next.splice(target, 0, removed!);
    startTransition(async () => {
      await reorderCreatorListItemsAction({
        listId,
        orderedItemIds: next,
      });
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap justify-end gap-1">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={isPending || index <= 0}
          onClick={() => move(-1)}
        >
          ↑
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={isPending || index < 0 || index >= orderedItemIds.length - 1}
          onClick={() => move(1)}
        >
          ↓
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => setEditing((value) => !value)}
        >
          Not
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              await removeCreatorFromListAction(listId, itemId);
              router.refresh();
            });
          }}
        >
          Çıkar
        </Button>
      </div>

      {editing ? (
        <div className="space-y-2 rounded-md border border-zinc-800 bg-zinc-950 p-2">
          <label className="block space-y-1 text-[11px] text-zinc-500">
            Public not
            <textarea
              value={publicValue}
              onChange={(event) => setPublicValue(event.target.value)}
              maxLength={500}
              rows={2}
              className="w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-white"
            />
          </label>
          <label className="block space-y-1 text-[11px] text-zinc-500">
            İç not
            <textarea
              value={internalValue}
              onChange={(event) => setInternalValue(event.target.value)}
              maxLength={2000}
              rows={2}
              className="w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-white"
            />
          </label>
          <Button
            type="button"
            size="sm"
            disabled={isPending}
            onClick={() => {
              startTransition(async () => {
                await updateCreatorListItemNotesAction({
                  itemId,
                  publicNote: publicValue,
                  internalNote: internalValue,
                });
                setEditing(false);
                router.refresh();
              });
            }}
          >
            Kaydet
          </Button>
        </div>
      ) : null}
    </div>
  );
}
