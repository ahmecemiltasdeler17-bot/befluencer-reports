"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { CreatorPlatformBadge } from "@/features/creators/components/creator-platform-badge";
import {
  VIDEO_PLATFORMS,
  VIDEO_STATUSES,
  type VideoFormState,
  type VideoFormValues,
} from "@/features/videos/types";
import { getPlatformLabel } from "@/features/creators/components/creator-platform-badge";
import { getVideoStatusLabel } from "@/features/videos/components/video-status-badge";
import { cn } from "@/lib/utils";

const DEFAULT_VALUES: VideoFormValues = {
  creator_id: "",
  platform: "tiktok",
  video_url: "",
  platform_video_id: "",
  caption: "",
  published_at: "",
  status: "draft",
};

type CreatorOption = {
  id: string;
  username: string;
  display_name: string | null;
};

type VideoFormProps = {
  action: (
    prevState: VideoFormState,
    formData: FormData
  ) => Promise<VideoFormState>;
  creators: CreatorOption[];
  defaultValues?: Partial<VideoFormValues>;
  submitLabel: string;
  cancelHref: string;
};

function fieldClass(hasError: boolean) {
  return cn(
    "w-full rounded-lg border bg-zinc-950/80 px-3 text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:ring-2 disabled:opacity-60",
    hasError
      ? "border-red-500/50 focus:border-red-500/60 focus:ring-red-500/20"
      : "border-zinc-800 focus:border-orange-500/60 focus:ring-orange-500/20"
  );
}

export function VideoForm({
  action,
  creators,
  defaultValues,
  submitLabel,
  cancelHref,
}: VideoFormProps) {
  const mergedDefaults = { ...DEFAULT_VALUES, ...defaultValues };
  const initialState: VideoFormState = { values: mergedDefaults };

  const [state, formAction, isPending] = useActionState(action, initialState);
  const values = state.values ?? mergedDefaults;

  return (
    <form
      key={JSON.stringify(values)}
      action={formAction}
      className="space-y-6"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <label htmlFor="creator_id" className="text-sm font-medium text-zinc-300">
            İçerik üreticisi <span className="text-orange-400">*</span>
          </label>
          <select
            id="creator_id"
            name="creator_id"
            defaultValue={values.creator_id}
            required
            className={cn(fieldClass(Boolean(state.fieldErrors?.creator_id)), "h-10")}
          >
            <option value="" disabled>
              Seçin…
            </option>
            {creators.map((creator) => (
              <option key={creator.id} value={creator.id}>
                @{creator.username}
                {creator.display_name ? ` — ${creator.display_name}` : ""}
              </option>
            ))}
          </select>
          {state.fieldErrors?.creator_id ? (
            <p className="text-xs text-red-400">{state.fieldErrors.creator_id}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label htmlFor="platform" className="text-sm font-medium text-zinc-300">
            Platform <span className="text-orange-400">*</span>
          </label>
          <select
            id="platform"
            name="platform"
            defaultValue={values.platform}
            required
            className={cn(fieldClass(Boolean(state.fieldErrors?.platform)), "h-10")}
          >
            {VIDEO_PLATFORMS.map((platform) => (
              <option key={platform} value={platform}>
                {getPlatformLabel(platform)}
              </option>
            ))}
          </select>
          {state.fieldErrors?.platform ? (
            <p className="text-xs text-red-400">{state.fieldErrors.platform}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label htmlFor="status" className="text-sm font-medium text-zinc-300">
            Durum <span className="text-orange-400">*</span>
          </label>
          <select
            id="status"
            name="status"
            defaultValue={values.status}
            required
            className={cn(fieldClass(Boolean(state.fieldErrors?.status)), "h-10")}
          >
            {VIDEO_STATUSES.map((status) => (
              <option key={status} value={status}>
                {getVideoStatusLabel(status)}
              </option>
            ))}
          </select>
          {state.fieldErrors?.status ? (
            <p className="text-xs text-red-400">{state.fieldErrors.status}</p>
          ) : null}
        </div>

        <div className="space-y-2 md:col-span-2">
          <label htmlFor="video_url" className="text-sm font-medium text-zinc-300">
            Video URL <span className="text-orange-400">*</span>
          </label>
          <input
            id="video_url"
            name="video_url"
            type="url"
            defaultValue={values.video_url}
            required
            placeholder="https://..."
            className={cn(fieldClass(Boolean(state.fieldErrors?.video_url)), "h-10")}
          />
          {state.fieldErrors?.video_url ? (
            <p className="text-xs text-red-400">{state.fieldErrors.video_url}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label
            htmlFor="platform_video_id"
            className="text-sm font-medium text-zinc-300"
          >
            Video ID
          </label>
          <input
            id="platform_video_id"
            name="platform_video_id"
            defaultValue={values.platform_video_id}
            placeholder="Opsiyonel"
            className={cn(
              fieldClass(Boolean(state.fieldErrors?.platform_video_id)),
              "h-10"
            )}
          />
          {state.fieldErrors?.platform_video_id ? (
            <p className="text-xs text-red-400">
              {state.fieldErrors.platform_video_id}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label
            htmlFor="published_at"
            className="text-sm font-medium text-zinc-300"
          >
            Yayın tarihi <span className="text-orange-400">*</span>
          </label>
          <input
            id="published_at"
            name="published_at"
            type="datetime-local"
            defaultValue={values.published_at}
            required
            className={cn(
              fieldClass(Boolean(state.fieldErrors?.published_at)),
              "h-10"
            )}
          />
          {state.fieldErrors?.published_at ? (
            <p className="text-xs text-red-400">{state.fieldErrors.published_at}</p>
          ) : null}
        </div>

        <div className="space-y-2 md:col-span-2">
          <label htmlFor="caption" className="text-sm font-medium text-zinc-300">
            Açıklama
          </label>
          <textarea
            id="caption"
            name="caption"
            defaultValue={values.caption}
            rows={4}
            placeholder="Opsiyonel"
            className={cn(fieldClass(Boolean(state.fieldErrors?.caption)), "py-2")}
          />
          {state.fieldErrors?.caption ? (
            <p className="text-xs text-red-400">{state.fieldErrors.caption}</p>
          ) : null}
        </div>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-950/30 px-3 py-2">
        <p className="text-xs text-zinc-500">
          Seçilen platform:{" "}
          <CreatorPlatformBadge platform={values.platform} className="ml-1" />
        </p>
      </div>

      {state.error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
        >
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 border-t border-zinc-800 pt-6">
        <Button
          type="submit"
          disabled={isPending}
          className="bg-orange-500 text-white hover:bg-orange-500/90"
        >
          {isPending ? "Kaydediliyor…" : submitLabel}
        </Button>
        <Link
          href={cancelHref}
          className={cn(
            buttonVariants({ variant: "outline" }),
            isPending && "pointer-events-none opacity-50"
          )}
          aria-disabled={isPending}
          tabIndex={isPending ? -1 : undefined}
        >
          İptal
        </Link>
      </div>
    </form>
  );
}
