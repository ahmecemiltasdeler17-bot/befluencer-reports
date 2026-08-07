"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { syncTikTokCreatorAction } from "@/features/creator-sync/actions";
import type { CreatorPlatform } from "@/features/creators/types";

const NOT_CONFIGURED_MESSAGE =
  "TikTok senkronizasyonu yapılandırılmamış. APIFY_API_TOKEN ve APIFY_TIKTOK_ACTOR_ID değerlerini .env.local dosyasına ekleyin.";

const MANUAL_ONLY_MESSAGE =
  "Otomatik profil güncelleme şu anda yalnızca TikTok için kullanılabilir.";

/**
 * Refreshes one creator profile.
 *
 * `compact` renders the table-row variant. Both variants disable the button
 * while pending so a double click cannot start two provider runs, and neither
 * triggers anything on mount — a sync only ever happens on an explicit click.
 */
export function SyncCreatorButton({
  creatorId,
  platform,
  syncConfigured,
  compact = false,
}: {
  creatorId: string;
  platform: CreatorPlatform;
  syncConfigured: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  if (platform !== "tiktok") {
    if (compact) {
      return null;
    }

    return <p className="text-sm text-zinc-500">{MANUAL_ONLY_MESSAGE}</p>;
  }

  function handleSync() {
    startTransition(async () => {
      setFeedback(null);

      if (!syncConfigured) {
        setFeedback({ type: "error", message: NOT_CONFIGURED_MESSAGE });
        return;
      }

      const result = await syncTikTokCreatorAction(creatorId);

      if (result.error) {
        setFeedback({ type: "error", message: result.error });
      } else if (result.success) {
        setFeedback({ type: "success", message: result.success });
      }

      router.refresh();
    });
  }

  if (compact) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={isPending}
        onClick={handleSync}
        title={feedback?.message}
        className="text-orange-400 hover:text-orange-300"
      >
        {isPending ? "Güncelleniyor…" : "Güncelle"}
      </Button>
    );
  }

  return (
    <div className="space-y-3">
      <Button
        type="button"
        disabled={isPending}
        onClick={handleSync}
        className="bg-orange-500 text-white hover:bg-orange-500/90"
      >
        {isPending ? "Güncelleniyor…" : "TikTok Profilini Güncelle"}
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
