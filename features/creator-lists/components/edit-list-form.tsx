"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { updateCreatorListAction } from "@/features/creator-lists/actions";
import type { CreatorListStatus } from "@/features/creator-lists/types";
import { cn } from "@/lib/utils";

export function EditListForm({
  listId,
  initial,
}: {
  listId: string;
  initial: {
    name: string;
    description: string | null;
    internal_notes: string | null;
    status: CreatorListStatus;
  };
}) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description ?? "");
  const [internalNotes, setInternalNotes] = useState(
    initial.internal_notes ?? ""
  );
  const [status, setStatus] = useState<CreatorListStatus>(initial.status);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <label className="block space-y-1 text-xs text-zinc-400">
        Liste adı
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={120}
          className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-white"
        />
      </label>
      <label className="block space-y-1 text-xs text-zinc-400">
        Açıklama (public)
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={1000}
          rows={3}
          className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white"
        />
      </label>
      <label className="block space-y-1 text-xs text-zinc-400">
        İç notlar
        <textarea
          value={internalNotes}
          onChange={(event) => setInternalNotes(event.target.value)}
          maxLength={5000}
          rows={3}
          className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white"
        />
      </label>
      <label className="block space-y-1 text-xs text-zinc-400">
        Durum
        <select
          value={status}
          onChange={(event) =>
            setStatus(event.target.value as CreatorListStatus)
          }
          className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-white"
        >
          <option value="draft">Taslak</option>
          <option value="ready">Hazır</option>
          <option value="archived">Arşiv</option>
        </select>
      </label>

      {error ? <p className="text-xs text-red-400">{error}</p> : null}

      <div className="flex gap-2">
        <Button
          type="button"
          disabled={isPending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await updateCreatorListAction({
                listId,
                name,
                description,
                internalNotes,
                status,
              });
              if (result.error) {
                setError(result.error);
                return;
              }
              router.push(`/creator-lists/${listId}`);
              router.refresh();
            });
          }}
        >
          Kaydet
        </Button>
        <Link
          href={`/creator-lists/${listId}`}
          className={cn(buttonVariants({ variant: "ghost" }))}
        >
          Vazgeç
        </Link>
      </div>
    </div>
  );
}
