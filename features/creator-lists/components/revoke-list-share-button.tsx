"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { revokeCreatorListShareAction } from "@/features/creator-lists/actions";

export function RevokeListShareButton({ shareId }: { shareId: string }) {
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
          await revokeCreatorListShareAction(shareId);
          router.refresh();
        });
      }}
    >
      İptal et
    </Button>
  );
}
