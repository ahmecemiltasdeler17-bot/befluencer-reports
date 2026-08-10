import { createClient } from "@/lib/supabase/client";
import {
  buildPreviewObjectPath,
  FEATURED_PREVIEW_BUCKET,
  type PreviewMediaType,
  validatePreviewUpload,
} from "@/features/videos/preview-media";

export type BrowserPreviewUploadResult =
  | {
      ok: true;
      objectPath: string;
      publicUrl: string;
      mediaType: PreviewMediaType;
    }
  | { ok: false; error: string; stage: "validate" | "storage-upload" };

type PreviewBrowserLogger = (payload: {
  stage: string;
  errorName?: string;
  errorMessage?: string;
}) => void;

const defaultLog: PreviewBrowserLogger = (payload) => {
  console.info("[VideoPreviewUpload]", payload);
};

/**
 * Uploads the MP4/WebM directly from the authenticated browser to Supabase
 * Storage. The binary never touches a Next.js Server Action.
 */
type BrowserStorageClient = {
  storage: {
    from: (bucket: string) => {
      upload: (
        path: string,
        file: File,
        options: {
          contentType: string;
          upsert: boolean;
          cacheControl: string;
        }
      ) => Promise<{ error: { name?: string; message: string } | null }>;
      getPublicUrl: (path: string) => { data: { publicUrl: string } };
      remove: (
        paths: string[]
      ) => Promise<{ error: { message: string } | null }>;
    };
  };
};

export async function uploadPreviewFileToStorage(input: {
  campaignId: string;
  videoId: string;
  file: File;
  log?: PreviewBrowserLogger;
  /** Test seam — production always uses the authenticated browser client. */
  supabase?: BrowserStorageClient;
}): Promise<BrowserPreviewUploadResult> {
  const log = input.log ?? defaultLog;

  log({ stage: "validate" });
  const validated = validatePreviewUpload(input.file);
  if (!validated.ok) {
    return { ok: false, error: validated.error, stage: "validate" };
  }

  const objectPath = buildPreviewObjectPath({
    campaignId: input.campaignId,
    videoId: input.videoId,
    uuid: crypto.randomUUID(),
    extension: validated.extension,
  });

  const supabase = input.supabase ?? createClient();

  log({ stage: "storage-upload-start" });
  const { error: uploadError } = await supabase.storage
    .from(FEATURED_PREVIEW_BUCKET)
    .upload(objectPath, input.file, {
      contentType: validated.mime,
      upsert: false,
      cacheControl: "31536000",
    });

  if (uploadError) {
    log({
      stage: "failed",
      errorName: uploadError.name || "StorageError",
      errorMessage: uploadError.message,
    });
    return {
      ok: false,
      error: "Video depolama alanına yüklenemedi.",
      stage: "storage-upload",
    };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(FEATURED_PREVIEW_BUCKET).getPublicUrl(objectPath);

  log({ stage: "storage-upload-complete" });

  return {
    ok: true,
    objectPath,
    publicUrl,
    mediaType: validated.mime,
  };
}

/** Best-effort cleanup of an object the browser just uploaded. */
export async function removePreviewStorageObject(
  objectPath: string,
  log: PreviewBrowserLogger = defaultLog,
  supabaseClient?: BrowserStorageClient
): Promise<void> {
  try {
    const supabase = supabaseClient ?? createClient();
    await supabase.storage.from(FEATURED_PREVIEW_BUCKET).remove([objectPath]);
    log({ stage: "storage-cleanup-complete" });
  } catch (error) {
    log({
      stage: "storage-cleanup-failed",
      errorName: error instanceof Error ? error.name : "Error",
      errorMessage: error instanceof Error ? error.message : "unknown",
    });
  }
}
