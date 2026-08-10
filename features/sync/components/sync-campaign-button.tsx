"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { syncCampaignTikTokVideosAction } from "@/features/sync/actions";
import { SYNC_UX_MESSAGES } from "@/lib/providers/tiktok/sync-policy";

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
  const [phase, setPhase] = useState<"idle" | "planning" | "updating">("idle");
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
      setPhase("planning");

      if (!syncConfigured) {
        setFeedback({
          type: "error",
          message:
            "TikTok senkronizasyonu yapılandırılmamış. APIFY_API_TOKEN ve APIFY_TIKTOK_ACTOR_ID değerlerini .env.local dosyasına ekleyin.",
        });
        setPhase("idle");
        return;
      }

      setPhase("updating");
      const result = await syncCampaignTikTokVideosAction(campaignId);

      if (result.error) {
        setFeedback({ type: "error", message: result.error });
      } else if (result.success) {
        setFeedback({ type: "success", message: result.success });
      }

      setPhase("idle");
      router.refresh();
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
        variant="outline"
        disabled={isPending}
        onClick={handleSync}
      >
        {isPending ? pendingLabel : "Tüm TikTok Videolarını Güncelle"}
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
