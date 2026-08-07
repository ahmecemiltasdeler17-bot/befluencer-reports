"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { createCreatorListAction } from "@/features/creator-lists/actions";

export function CreateListDialog({
  selectedIds,
  disabled,
  onCreated,
}: {
  selectedIds: string[];
  disabled?: boolean;
  onCreated?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setName("");
    setDescription("");
    setInternalNotes("");
    setError(null);
  }

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      const result = await createCreatorListAction({
        name,
        description,
        internalNotes,
        creatorIds: selectedIds,
      });

      if (result?.error) {
        setError(result.error);
        return;
      }

      onCreated?.();
      setOpen(false);
      reset();
    });
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        disabled={disabled || selectedIds.length === 0}
        className="bg-orange-500 text-white hover:bg-orange-500/90"
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        Liste Oluştur
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-list-title"
        >
          <div className="w-full max-w-md space-y-4 rounded-lg border border-zinc-800 bg-zinc-950 p-5 shadow-xl">
            <div>
              <h2
                id="create-list-title"
                className="text-sm font-semibold text-white"
              >
                Creator listesi oluştur
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                {selectedIds.length} creator seçildi
              </p>
            </div>

            <label className="block space-y-1 text-xs text-zinc-400">
              Liste adı
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={120}
                className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-white"
              />
            </label>

            <label className="block space-y-1 text-xs text-zinc-400">
              Açıklama (public)
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={1000}
                rows={2}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white"
              />
            </label>

            <label className="block space-y-1 text-xs text-zinc-400">
              İç notlar (gizli)
              <textarea
                value={internalNotes}
                onChange={(event) => setInternalNotes(event.target.value)}
                maxLength={5000}
                rows={2}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white"
              />
            </label>

            {error ? <p className="text-xs text-red-400">{error}</p> : null}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
              >
                Vazgeç
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isPending || !name.trim()}
                onClick={handleCreate}
              >
                {isPending ? "Kaydediliyor…" : "Kaydet"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
