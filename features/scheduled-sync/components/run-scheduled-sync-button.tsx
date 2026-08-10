"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import type { ScheduledSyncSummary } from "@/features/scheduled-sync/types";
import { SYNC_UX_MESSAGES } from "@/lib/providers/tiktok/sync-policy";

function formatSummary(summary: ScheduledSyncSummary): string {
  if (summary.status === "skipped") {
    return "Senkronizasyon atlandı (kilit veya uygun kampanya yok).";
  }

  if (summary.message) {
    return summary.message;
  }

  const parts = [
    `${summary.video.success} güncellendi`,
    `${summary.video.skipped} zaten günceldi`,
    summary.video.failed > 0 ? `${summary.video.failed} başarısız` : null,
  ];

  if (typeof summary.providerRunsStarted === "number") {
    parts.push(
      `${summary.providerRunsStarted} sağlayıcı çalıştırması kullanıldı`
    );
  }

  return parts.filter(Boolean).join(" · ");
}

export function RunScheduledSyncButton({
  syncConfigured,
}: {
  syncConfigured: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [phase, setPhase] = useState<"idle" | "planning" | "updating">("idle");
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  function handleClick() {
    startTransition(async () => {
      setFeedback(null);
      setPhase("planning");

      if (!syncConfigured) {
        setFeedback({
          type: "error",
          message:
            "Zamanlanmış senkronizasyon yapılandırılmamış. APIFY_* ve SUPABASE_SERVICE_ROLE_KEY değerlerini .env.local dosyasına ekleyin.",
        });
        setPhase("idle");
        return;
      }

      try {
        setPhase("updating");
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
          setPhase("idle");
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
      } finally {
        setPhase("idle");
      }
    });
  }

  const pendingLabel =
    phase === "planning"
      ? SYNC_UX_MESSAGES.planning
      : SYNC_UX_MESSAGES.updating;

  return (
    <div className="space-y-2">
      <Button
        type="button"
        disabled={isPending || !syncConfigured}
        onClick={handleClick}
        className="bg-primary text-primary-foreground hover:bg-primary/90"
      >
        {isPending ? pendingLabel : "Tüm TikTok Verilerini Güncelle"}
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
