"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { syncTikTokCreatorAction } from "@/features/creator-sync/actions";
import type { CreatorAccountStatus, CreatorPlatform } from "@/features/creators/types";

const NOT_CONFIGURED_MESSAGE =
  "TikTok senkronizasyonu yapılandırılmamış. APIFY_API_TOKEN ve APIFY_TIKTOK_ACTOR_ID değerlerini .env.local dosyasına ekleyin.";

const MANUAL_ONLY_MESSAGE =
  "Otomatik profil güncelleme şu anda yalnızca TikTok için kullanılabilir.";

/**
 * Refreshes one creator profile.
 *
 * For unavailable accounts, the compact label becomes "Tekrar kontrol et" and
 * force=true so the soft skip is bypassed once.
 */
export function SyncCreatorButton({
  creatorId,
  platform,
  syncConfigured,
  compact = false,
  accountStatus = "active",
}: {
  creatorId: string;
  platform: CreatorPlatform;
  syncConfigured: boolean;
  compact?: boolean;
  accountStatus?: CreatorAccountStatus | string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const unavailable = (accountStatus ?? "active") === "unavailable";

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

      const result = await syncTikTokCreatorAction(creatorId, {
        force: unavailable,
      });

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
        className={
          unavailable
            ? "text-amber-400 hover:text-amber-300"
            : "text-primary hover:text-[var(--bf-accent-soft)]"
        }
      >
        {isPending
          ? "Güncelleniyor…"
          : unavailable
            ? "Tekrar kontrol et"
            : "Güncelle"}
      </Button>
    );
  }

  return (
    <div className="space-y-3">
      <Button
        type="button"
        disabled={isPending}
        onClick={handleSync}
        className="bg-primary text-primary-foreground hover:bg-primary/90"
      >
        {isPending
          ? "Güncelleniyor…"
          : unavailable
            ? "Tekrar Kontrol Et"
            : "TikTok Profilini Güncelle"}
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
