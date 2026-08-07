"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { syncCampaignTikTokCreatorsAction } from "@/features/creator-sync/actions";

export function SyncCampaignCreatorsButton({
  campaignId,
  tiktokCreatorCount,
  syncConfigured,
}: {
  campaignId: string;
  tiktokCreatorCount: number;
  syncConfigured: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  if (tiktokCreatorCount === 0) {
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

      const result = await syncCampaignTikTokCreatorsAction(campaignId);

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
        {isPending ? "Güncelleniyor…" : "Tüm TikTok Profillerini Güncelle"}
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
