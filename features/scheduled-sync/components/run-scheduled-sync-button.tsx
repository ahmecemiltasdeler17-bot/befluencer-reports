"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import type { ScheduledSyncSummary } from "@/features/scheduled-sync/types";

function formatSummary(summary: ScheduledSyncSummary): string {
  if (summary.status === "skipped") {
    return "Senkronizasyon atlandı (kilit veya uygun kampanya yok).";
  }

  return [
    `Durum: ${summary.status}`,
    `${summary.successfulCampaigns}/${summary.totalCampaigns} kampanya başarılı`,
    `Video ${summary.video.success}/${summary.video.failed}`,
    `Profil ${summary.creators.success}/${summary.creators.failed}`,
    `Ses ${summary.sound.success}/${summary.sound.failed}`,
  ].join(" · ");
}

export function RunScheduledSyncButton({
  syncConfigured,
}: {
  syncConfigured: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  function handleClick() {
    startTransition(async () => {
      setFeedback(null);

      if (!syncConfigured) {
        setFeedback({
          type: "error",
          message:
            "Zamanlanmış senkronizasyon yapılandırılmamış. APIFY_* ve SUPABASE_SERVICE_ROLE_KEY değerlerini .env.local dosyasına ekleyin.",
        });
        return;
      }

      try {
        const response = await fetch("/api/internal/tiktok-sync/run", {
          method: "POST",
          headers: { Accept: "application/json" },
        });

        const payload = (await response.json()) as
          | ScheduledSyncSummary
          | { error?: string };

        if (!response.ok) {
          setFeedback({
            type: "error",
            message:
              "error" in payload && payload.error
                ? payload.error
                : "Senkronizasyon başlatılamadı.",
          });
          return;
        }

        setFeedback({
          type: "success",
          message: formatSummary(payload as ScheduledSyncSummary),
        });
        router.refresh();
      } catch {
        setFeedback({
          type: "error",
          message: "Senkronizasyon başlatılamadı.",
        });
      }
    });
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        disabled={isPending || !syncConfigured}
        onClick={handleClick}
        className="bg-orange-500 text-white hover:bg-orange-500/90"
      >
        {isPending ? "Güncelleniyor…" : "Tüm TikTok Verilerini Güncelle"}
      </Button>
      {feedback ? (
        <p
          className={
            feedback.type === "success"
              ? "text-sm text-emerald-400"
              : "text-sm text-red-400"
          }
          role="status"
        >
          {feedback.message}
        </p>
      ) : null}
    </div>
  );
}
