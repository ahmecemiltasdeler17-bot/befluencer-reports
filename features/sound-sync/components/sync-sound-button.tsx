"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { syncTikTokSoundAction } from "@/features/sound-sync/actions";
import { SoundSyncFeedback } from "@/features/sound-sync/components/sound-sync-feedback";

const NOT_CONFIGURED_MESSAGE =
  "TikTok ses senkronizasyonu yapılandırılmamış. APIFY_API_TOKEN ve APIFY_TIKTOK_ACTOR_ID değerlerini .env.local dosyasına ekleyin.";

const MISSING_URL_MESSAGE =
  "Senkronizasyon için TikTok ses bağlantısı ekleyin.";

export function SyncSoundButton({
  campaignId,
  hasSoundUrl,
  syncConfigured,
}: {
  campaignId: string;
  hasSoundUrl: boolean;
  syncConfigured: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  function handleSync() {
    startTransition(async () => {
      setFeedback(null);

      if (!hasSoundUrl) {
        setFeedback({ type: "error", message: MISSING_URL_MESSAGE });
        return;
      }

      if (!syncConfigured) {
        setFeedback({ type: "error", message: NOT_CONFIGURED_MESSAGE });
        return;
      }

      const result = await syncTikTokSoundAction(campaignId);

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
        disabled={isPending || !hasSoundUrl}
        onClick={handleSync}
        className="bg-orange-500 text-white hover:bg-orange-500/90"
      >
        {isPending ? "Güncelleniyor…" : "Sesi Güncelle"}
      </Button>
      <SoundSyncFeedback feedback={feedback} />
    </div>
  );
}
