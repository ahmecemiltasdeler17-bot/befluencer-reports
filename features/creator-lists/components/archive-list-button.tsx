"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { archiveCreatorListAction } from "@/features/creator-lists/actions";

export function ArchiveListButton({ listId }: { listId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          await archiveCreatorListAction(listId);
          router.refresh();
        });
      }}
    >
      Arşivle
    </Button>
  );
}
