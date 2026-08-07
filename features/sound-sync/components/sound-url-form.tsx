"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  updateCampaignSoundUrlAction,
  type UpdateSoundUrlState,
} from "@/features/sound-sync/actions";
import { SoundSyncFeedback } from "@/features/sound-sync/components/sound-sync-feedback";

const initialState: UpdateSoundUrlState = {};

export function SoundUrlForm({
  campaignId,
  initialSoundUrl,
}: {
  campaignId: string;
  initialSoundUrl: string | null;
}) {
  const boundAction = updateCampaignSoundUrlAction.bind(null, campaignId);
  const [state, formAction, isPending] = useActionState(
    boundAction,
    initialState
  );

  const value = state.values?.soundUrl ?? initialSoundUrl ?? "";

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label
          htmlFor="soundUrl"
          className="block text-xs font-medium text-zinc-400"
        >
          TikTok ses bağlantısı
        </label>
        <input
          id="soundUrl"
          name="soundUrl"
          type="url"
          defaultValue={value}
          placeholder="https://www.tiktok.com/music/..."
          className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-orange-500 focus:outline-none"
        />
        <p className="mt-1 text-xs text-zinc-500">
          Yalnızca TikTok /music/ ses sayfası bağlantıları kabul edilir.
        </p>
      </div>

      <Button type="submit" variant="outline" disabled={isPending}>
        {isPending ? "Kaydediliyor…" : "Ses Bağlantısını Kaydet"}
      </Button>

      <SoundSyncFeedback
        feedback={
          state.error
            ? { type: "error", message: state.error }
            : state.success
              ? { type: "success", message: state.success }
              : null
        }
      />
    </form>
  );
}
