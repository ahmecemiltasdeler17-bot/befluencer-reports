"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { buttonVariants } from "@/components/ui/button";
import {
  commitVideoPreviewMetadata,
  removeVideoPreview,
} from "@/features/videos/actions";
import {
  removePreviewStorageObject,
  uploadPreviewFileToStorage,
} from "@/features/videos/preview-browser-upload";
import { PREVIEW_MAX_BYTES } from "@/features/videos/preview-media";
import { cn } from "@/lib/utils";

interface VideoPreviewUploadProps {
  campaignId: string;
  videoId: string;
  previewMediaUrl: string | null;
  previewMediaType?: string | null;
  thumbnailUrl?: string | null;
}

function previewTypeLabel(mime: string | null | undefined): string | null {
  if (!mime) return null;
  if (mime === "video/mp4") return "MP4";
  if (mime === "video/webm") return "WebM";
  return mime;
}

/** Presentational panel — safe to render in unit tests without the App Router. */
export function VideoPreviewUploadPanel({
  hasPreview,
  previewMediaType,
  thumbnailUrl,
  pending,
  error,
  success,
  onPickFile,
  onRemove,
}: {
  hasPreview: boolean;
  previewMediaType?: string | null;
  thumbnailUrl?: string | null;
  pending?: boolean;
  error?: string | null;
  success?: string | null;
  onPickFile?: () => void;
  onRemove?: () => void;
}) {
  const typeLabel = previewTypeLabel(previewMediaType);

  return (
    <section
      className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-6"
      data-video-preview-panel=""
      data-has-preview={hasPreview ? "true" : "false"}
      data-upload-transport="browser-storage"
      aria-labelledby="video-preview-panel-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-2xl">
          <h2
            id="video-preview-panel-title"
            className="text-base font-medium text-white"
          >
            Rapor Önizleme Videosu
          </h2>

          {hasPreview ? (
            <>
              <p className="mt-1 text-sm text-emerald-400">Önizleme hazır</p>
              <p className="mt-2 text-sm text-zinc-400">
                Öne çıkan içerikte kullanılmak üzere yüklenen önizleme
                {typeLabel ? ` · ${typeLabel}` : ""}.
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-zinc-400">
              Öne çıkan içerikte kullanılmak üzere isteğe bağlı MP4/WebM
              önizlemesi yükleyebilirsiniz.
            </p>
          )}

          <p className="mt-2 text-xs text-zinc-500">
            Maks. {Math.round(PREVIEW_MAX_BYTES / (1024 * 1024))} MB · MP4 veya
            WebM
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hasPreview && thumbnailUrl ? (
            <div className="relative mr-1 aspect-[9/16] w-14 overflow-hidden rounded-md border border-zinc-800 bg-zinc-900">
              {/* eslint-disable-next-line @next/next/no-img-element -- admin thumb of stored poster */}
              <img
                src={thumbnailUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
          ) : null}

          <button
            type="button"
            disabled={pending}
            data-preview-upload-trigger=""
            className={cn(
              buttonVariants({ variant: hasPreview ? "outline" : "default" })
            )}
            onClick={onPickFile}
          >
            {pending
              ? "Yükleniyor…"
              : hasPreview
                ? "Önizlemeyi Değiştir"
                : "MP4 / WebM Yükle"}
          </button>

          {hasPreview ? (
            <button
              type="button"
              disabled={pending}
              data-preview-remove-trigger=""
              className={cn(buttonVariants({ variant: "ghost" }))}
              onClick={onRemove}
            >
              Önizlemeyi Kaldır
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="mt-3 text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      {success && !error ? (
        <p className="mt-3 text-sm text-emerald-400" role="status">
          {success}
        </p>
      ) : null}
    </section>
  );
}

export function VideoPreviewUpload({
  campaignId,
  videoId,
  previewMediaUrl,
  previewMediaType,
  thumbnailUrl,
}: VideoPreviewUploadProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const hasPreview = Boolean(previewMediaUrl);

  function handleUpload(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;

    setError(null);
    setSuccess(null);

    startTransition(async () => {
      try {
        // 1) Browser → Supabase Storage (multi-MB binary never hits Vercel).
        const uploaded = await uploadPreviewFileToStorage({
          campaignId,
          videoId,
          file,
        });

        if (!uploaded.ok) {
          setError(uploaded.error);
          return;
        }

        // 2) Tiny metadata commit only (path + MIME).
        console.info("[VideoPreviewUpload]", {
          stage: "metadata-commit-start",
        });
        const result = await commitVideoPreviewMetadata({
          campaignId,
          videoId,
          objectPath: uploaded.objectPath,
          mediaType: uploaded.mediaType,
        });

        if (result?.error) {
          await removePreviewStorageObject(uploaded.objectPath);
          setError(
            "Video yüklendi ancak önizleme kaydedilemedi. Yüklenen dosya temizlendi."
          );
          return;
        }

        console.info("[VideoPreviewUpload]", {
          stage: "metadata-commit-complete",
        });
        setSuccess("Önizleme hazır");
        router.refresh();
      } catch (error) {
        console.info("[VideoPreviewUpload]", {
          stage: "failed",
          errorName: error instanceof Error ? error.name : "Error",
          errorMessage: error instanceof Error ? error.message : "unknown",
        });
        setError("Önizleme videosu yüklenemedi.");
      }
    });
  }

  function handleRemove() {
    const confirmed = window.confirm(
      "Rapor önizleme videosunu kaldırmak istediğinize emin misiniz?"
    );
    if (!confirmed) return;

    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        const result = await removeVideoPreview(campaignId, videoId);
        if (result?.error) {
          setError(result.error);
          return;
        }
        setSuccess("Önizleme kaldırıldı");
        router.refresh();
      } catch (error) {
        console.info("[VideoPreviewUpload]", {
          stage: "failed",
          errorName: error instanceof Error ? error.name : "Error",
          errorMessage: error instanceof Error ? error.message : "unknown",
        });
        setError("Önizleme videosu kaldırılamadı.");
      }
    });
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/webm,.mp4,.webm"
        className="sr-only"
        disabled={pending}
        onChange={(event) => {
          handleUpload(event.target.files);
          event.target.value = "";
        }}
      />
      <VideoPreviewUploadPanel
        hasPreview={hasPreview}
        previewMediaType={previewMediaType}
        thumbnailUrl={thumbnailUrl}
        pending={pending}
        error={error}
        success={success}
        onPickFile={() => inputRef.current?.click()}
        onRemove={handleRemove}
      />
    </>
  );
}
