import type { SupabaseClient } from "@supabase/supabase-js";

import {
  extractPreviewObjectPath,
  FEATURED_PREVIEW_BUCKET,
  isOwnedPreviewObjectPath,
  isPreviewMediaType,
  type PreviewMediaType,
} from "@/features/videos/preview-media";

export type PreviewUploadStage =
  | "action-entered"
  | "validate"
  | "db-update"
  | "db-updated"
  | "cleanup-old"
  | "revalidate"
  | "complete"
  | "failed";

export type PreviewCommitResult =
  | { ok: true; publicUrl: string; objectPath: string; mime: PreviewMediaType }
  | { ok: false; error: string; stage: PreviewUploadStage };

export type PreviewRemoveResult =
  | { ok: true }
  | { ok: false; error: string; stage: PreviewUploadStage };

type PreviewLogger = (payload: {
  stage: PreviewUploadStage;
  errorName?: string;
  errorMessage?: string;
  supabaseCode?: string;
}) => void;

const defaultLogger: PreviewLogger = (payload) => {
  console.info("[VideoPreviewUpload]", payload);
};

/**
 * Commits preview metadata only. The MP4/WebM bytes must already live in
 * Storage (uploaded by the authenticated browser client).
 */
export async function commitPreviewMetadataCore(input: {
  supabase: SupabaseClient;
  campaignId: string;
  videoId: string;
  objectPath: string;
  mediaType: string;
  previousPreviewUrl: string | null;
  onRevalidate: () => void;
  log?: PreviewLogger;
}): Promise<PreviewCommitResult> {
  const log = input.log ?? defaultLogger;

  try {
    log({ stage: "validate" });

    if (
      !isOwnedPreviewObjectPath(
        input.campaignId,
        input.videoId,
        input.objectPath
      )
    ) {
      return {
        ok: false,
        error: "Önizleme videosu yüklenemedi.",
        stage: "validate",
      };
    }

    if (!isPreviewMediaType(input.mediaType)) {
      return {
        ok: false,
        error: "Yalnızca MP4 veya WebM yükleyebilirsiniz.",
        stage: "validate",
      };
    }

    const {
      data: { publicUrl },
    } = input.supabase.storage
      .from(FEATURED_PREVIEW_BUCKET)
      .getPublicUrl(input.objectPath);

    if (!publicUrl) {
      return {
        ok: false,
        error: "Önizleme videosu yüklenemedi.",
        stage: "validate",
      };
    }

    log({ stage: "db-update" });
    const { error: updateError } = await input.supabase
      .from("videos")
      .update({
        preview_media_url: publicUrl,
        preview_media_type: input.mediaType,
      })
      .eq("id", input.videoId)
      .eq("campaign_id", input.campaignId);

    if (updateError) {
      log({
        stage: "failed",
        errorName: updateError.name || "PostgrestError",
        errorMessage: updateError.message,
        supabaseCode: updateError.code,
      });
      return {
        ok: false,
        error:
          "Video yüklendi ancak önizleme kaydedilemedi. Yüklenen dosya temizlendi.",
        stage: "db-update",
      };
    }

    log({ stage: "db-updated" });

    const previousPath = extractPreviewObjectPath(input.previousPreviewUrl);
    if (previousPath && previousPath !== input.objectPath) {
      log({ stage: "cleanup-old" });
      await input.supabase.storage
        .from(FEATURED_PREVIEW_BUCKET)
        .remove([previousPath]);
    }

    log({ stage: "revalidate" });
    input.onRevalidate();
    log({ stage: "complete" });

    return {
      ok: true,
      publicUrl,
      objectPath: input.objectPath,
      mime: input.mediaType,
    };
  } catch (error) {
    const err = error as { name?: string; message?: string; code?: string };
    log({
      stage: "failed",
      errorName: err?.name || "Error",
      errorMessage: typeof err?.message === "string" ? err.message : "unknown",
      supabaseCode: typeof err?.code === "string" ? err.code : undefined,
    });
    return {
      ok: false,
      error: "Önizleme videosu yüklenemedi.",
      stage: "failed",
    };
  }
}

export async function removePreviewMediaCore(input: {
  supabase: SupabaseClient;
  campaignId: string;
  videoId: string;
  previousPreviewUrl: string | null;
  onRevalidate: () => void;
  log?: PreviewLogger;
}): Promise<PreviewRemoveResult> {
  const log = input.log ?? defaultLogger;

  try {
    log({ stage: "db-update" });
    const objectPath = extractPreviewObjectPath(input.previousPreviewUrl);

    const { error: updateError } = await input.supabase
      .from("videos")
      .update({
        preview_media_url: null,
        preview_media_type: null,
      })
      .eq("id", input.videoId)
      .eq("campaign_id", input.campaignId);

    if (updateError) {
      log({
        stage: "failed",
        errorName: updateError.name || "PostgrestError",
        errorMessage: updateError.message,
        supabaseCode: updateError.code,
      });
      return {
        ok: false,
        error: "Önizleme videosu kaldırılamadı.",
        stage: "db-update",
      };
    }

    log({ stage: "db-updated" });

    if (objectPath) {
      log({ stage: "cleanup-old" });
      await input.supabase.storage
        .from(FEATURED_PREVIEW_BUCKET)
        .remove([objectPath]);
    }

    log({ stage: "revalidate" });
    input.onRevalidate();
    log({ stage: "complete" });
    return { ok: true };
  } catch (error) {
    const err = error as { name?: string; message?: string; code?: string };
    log({
      stage: "failed",
      errorName: err?.name || "Error",
      errorMessage: typeof err?.message === "string" ? err.message : "unknown",
      supabaseCode: typeof err?.code === "string" ? err.code : undefined,
    });
    return {
      ok: false,
      error: "Önizleme videosu kaldırılamadı.",
      stage: "failed",
    };
  }
}
