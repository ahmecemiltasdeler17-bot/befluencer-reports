"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { archiveReportVersionAction } from "@/features/report-generation/actions";

export function ArchiveReportVersionButton({
  versionId,
  disabled,
}: {
  versionId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleArchive() {
    const confirmed = window.confirm(
      "Bu rapor sürümünü arşivlemek istediğinize emin misiniz?"
    );

    if (!confirmed) {
      return;
    }

    startTransition(async () => {
      const result = await archiveReportVersionAction(versionId);

      if (result.error) {
        window.alert(result.error);
        return;
      }

      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={disabled || isPending}
      onClick={handleArchive}
      className="text-zinc-400 hover:text-zinc-200"
    >
      {isPending ? "Arşivleniyor…" : "Arşivle"}
    </Button>
  );
}
