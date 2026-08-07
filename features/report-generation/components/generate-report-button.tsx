"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  ensureReportSeriesAction,
  generateReportVersionAction,
  retryFailedReportVersionAction,
} from "@/features/report-generation/actions";
import { ReportGenerationFeedback } from "@/features/report-generation/components/report-generation-feedback";

export function GenerateReportButton({
  campaignId,
  hasSeries,
  disabled,
  label,
}: {
  campaignId: string;
  hasSeries: boolean;
  disabled?: boolean;
  label?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    success?: string;
    error?: string;
  }>({});

  function handleClick() {
    startTransition(async () => {
      setFeedback({});

      if (!hasSeries) {
        const ensureResult = await ensureReportSeriesAction(campaignId);
        if (ensureResult.error) {
          setFeedback({ error: ensureResult.error });
          return;
        }
      }

      const result = await generateReportVersionAction(campaignId);

      if (result.error) {
        setFeedback({ error: result.error });
      } else if (result.success) {
        setFeedback({ success: result.success });
      }

      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        disabled={disabled || isPending}
        onClick={handleClick}
        className="bg-orange-500 text-white hover:bg-orange-500/90"
      >
        {isPending
          ? "Oluşturuluyor…"
          : label ?? (hasSeries ? "Yeni Rapor Sürümü Oluştur" : "Rapor Oluştur")}
      </Button>
      <ReportGenerationFeedback {...feedback} />
    </div>
  );
}

export function RetryReportButton({
  campaignId,
  disabled,
}: {
  campaignId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    success?: string;
    error?: string;
  }>({});

  function handleClick() {
    startTransition(async () => {
      setFeedback({});
      const result = await retryFailedReportVersionAction(campaignId);

      if (result.error) {
        setFeedback({ error: result.error });
      } else if (result.success) {
        setFeedback({ success: result.success });
      }

      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        disabled={disabled || isPending}
        onClick={handleClick}
      >
        {isPending ? "Deneniyor…" : "Tekrar Dene"}
      </Button>
      <ReportGenerationFeedback {...feedback} />
    </div>
  );
}
