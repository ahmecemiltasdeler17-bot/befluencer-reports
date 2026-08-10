"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { syncTikTokVideoAction } from "@/features/sync/actions";
import type { VideoPlatform } from "@/features/videos/types";

export function SyncVideoButton({
  campaignId,
  videoId,
  platform,
  syncConfigured,
}: {
  campaignId: string;
  videoId: string;
  platform: VideoPlatform;
  syncConfigured: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  if (platform !== "tiktok") {
    return (
      <p className="text-sm text-zinc-500">
        Otomatik senkronizasyon şu an yalnızca TikTok videoları için
        kullanılabilir. Instagram ve YouTube metrikleri manuel girilir.
      </p>
    );
  }

  function handleSync() {
    startTransition(async () => {
      setFeedback(null);

      if (!syncConfigured) {
        setFeedback({
          type: "error",
          message:
            "TikTok senkronizasyonu yapılandırılmamış. APIFY_API_TOKEN ve APIFY_TIKTOK_ACTOR_ID değerlerini .env.local dosyasına ekleyin.",
        });
        return;
      }

      const result = await syncTikTokVideoAction(campaignId, videoId);

      if (result.error) {
        setFeedback({ type: "error", message: result.error });
      } else if (result.success) {
        setFeedback({ type: "success", message: result.success });
      }

      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <Button
        type="button"
        disabled={isPending}
        onClick={handleSync}
        className="bg-primary text-primary-foreground hover:bg-primary/90"
      >
        {isPending ? "Güncelleniyor…" : "TikTok Verisini Güncelle"}
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
