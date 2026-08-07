"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { ensureCampaignReport } from "@/features/reports/actions";

export function EnsureReportButton({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  function handleCreate() {
    startTransition(async () => {
      setFeedback(null);
      const result = await ensureCampaignReport(campaignId);

      if (result.error) {
        setFeedback({ type: "error", message: result.error });
        return;
      }

      if (result.success) {
        setFeedback({ type: "success", message: result.success });
      }

      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        disabled={isPending}
        onClick={handleCreate}
      >
        {isPending ? "Oluşturuluyor…" : "Rapor Kaydı Oluştur"}
      </Button>
      {feedback?.type === "success" ? (
        <p className="text-sm text-emerald-400">{feedback.message}</p>
      ) : null}
      {feedback?.type === "error" ? (
        <p className="text-sm text-red-400">{feedback.message}</p>
      ) : null}
    </div>
  );
}
