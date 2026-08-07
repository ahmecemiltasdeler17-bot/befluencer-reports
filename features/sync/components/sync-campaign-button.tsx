"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { syncCampaignTikTokVideosAction } from "@/features/sync/actions";

export function SyncCampaignButton({
  campaignId,
  tiktokVideoCount,
  syncConfigured,
}: {
  campaignId: string;
  tiktokVideoCount: number;
  syncConfigured: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  if (tiktokVideoCount === 0) {
    return null;
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

      const result = await syncCampaignTikTokVideosAction(campaignId);

      if (result.error) {
        setFeedback({ type: "error", message: result.error });
      } else if (result.success) {
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
        onClick={handleSync}
      >
        {isPending ? "Güncelleniyor…" : "Tüm TikTok Videolarını Güncelle"}
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
