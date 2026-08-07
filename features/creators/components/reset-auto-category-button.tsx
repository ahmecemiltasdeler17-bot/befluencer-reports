"use client";

import { useState, useTransition } from "react";

import { buttonVariants } from "@/components/ui/button";
import { resetCreatorCategoryToAutoAction } from "@/features/creators/actions";
import { cn } from "@/lib/utils";

export function ResetAutoCategoryButton({
  creatorId,
}: {
  creatorId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await resetCreatorCategoryToAutoAction(creatorId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage(result.success ?? "Kategori otomatik moda alındı.");
    });
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        disabled={isPending}
        onClick={handleClick}
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "text-zinc-400 hover:text-white disabled:opacity-50"
        )}
      >
        {isPending ? "Güncelleniyor…" : "Otomatik kategoriye dön"}
      </button>
      {message && <p className="text-xs text-emerald-400">{message}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
