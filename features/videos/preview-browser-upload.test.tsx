import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  removePreviewStorageObject,
  uploadPreviewFileToStorage,
} from "@/features/videos/preview-browser-upload";
import {
  FEATURED_PREVIEW_BUCKET,
  isOwnedPreviewObjectPath,
} from "@/features/videos/preview-media";

function createBrowserStorageMock(options?: {
  uploadError?: { message: string; name?: string } | null;
}) {
  const uploaded: Array<{ path: string; body: File; options: unknown }> = [];
  const removed: string[][] = [];

  const supabase = {
    storage: {
      from(bucket: string) {
        assert.equal(bucket, FEATURED_PREVIEW_BUCKET);
        return {
          async upload(path: string, body: File, uploadOptions: unknown) {
            uploaded.push({ path, body, options: uploadOptions });
            if (options?.uploadError) {
              return { error: options.uploadError };
            }
            return { error: null };
          },
          getPublicUrl(path: string) {
            return {
              data: {
                publicUrl: `https://example.supabase.co/storage/v1/object/public/${FEATURED_PREVIEW_BUCKET}/${path}`,
              },
            };
          },
          async remove(paths: string[]) {
            removed.push(paths);
            return { error: null };
          },
        };
      },
    },
  };

  return { supabase, uploaded, removed };
}

describe("uploadPreviewFileToStorage (browser → Storage)", () => {
  it("uploads File bytes directly and returns a UUID object path", async () => {
    const mock = createBrowserStorageMock();
    const file = new File([new Uint8Array(2 * 1024 * 1024)], "original name.mp4", {
      type: "video/mp4",
    });
    const stages: string[] = [];

    const result = await uploadPreviewFileToStorage({
      campaignId: "camp",
      videoId: "vid",
      file,
      supabase: mock.supabase,
      log: (payload) => stages.push(payload.stage),
    });

    assert.equal(result.ok, true);
    assert.equal(mock.uploaded.length, 1);
    assert.equal(mock.uploaded[0].body, file);
    assert.equal(mock.uploaded[0].body.name, "original name.mp4");
    if (result.ok) {
      assert.equal(isOwnedPreviewObjectPath("camp", "vid", result.objectPath), true);
      assert.notEqual(result.objectPath.includes("original"), true);
      assert.match(result.objectPath, /\.mp4$/);
      assert.equal(result.mediaType, "video/mp4");
    }
    assert.deepEqual(stages, [
      "validate",
      "storage-upload-start",
      "storage-upload-complete",
    ]);
  });

  it("rejects invalid MIME before calling Storage", async () => {
    const mock = createBrowserStorageMock();
    const result = await uploadPreviewFileToStorage({
      campaignId: "camp",
      videoId: "vid",
      file: new File(["x"], "a.gif", { type: "image/gif" }),
      supabase: mock.supabase,
      log: () => {},
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.stage, "validate");
      assert.equal(result.error, "Yalnızca MP4 veya WebM yükleyebilirsiniz.");
    }
    assert.equal(mock.uploaded.length, 0);
  });

  it("rejects >30MB before calling Storage", async () => {
    const mock = createBrowserStorageMock();
    const file = new File([new Uint8Array(1)], "huge.mp4", { type: "video/mp4" });
    Object.defineProperty(file, "size", { value: 30 * 1024 * 1024 + 1 });

    const result = await uploadPreviewFileToStorage({
      campaignId: "camp",
      videoId: "vid",
      file,
      supabase: mock.supabase,
      log: () => {},
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, "Video 30 MB sınırını aşıyor.");
    }
    assert.equal(mock.uploaded.length, 0);
  });

  it("maps Storage errors to Turkish message without throwing", async () => {
    const mock = createBrowserStorageMock({
      uploadError: { message: "policy", name: "StorageError" },
    });

    const result = await uploadPreviewFileToStorage({
      campaignId: "camp",
      videoId: "vid",
      file: new File([new Uint8Array([1])], "a.mp4", { type: "video/mp4" }),
      supabase: mock.supabase,
      log: () => {},
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, "Video depolama alanına yüklenemedi.");
    }
  });

  it("removePreviewStorageObject deletes the orphan path", async () => {
    const mock = createBrowserStorageMock();
    await removePreviewStorageObject(
      "camp/vid/550e8400-e29b-41d4-a716-446655440000.mp4",
      () => {},
      mock.supabase
    );
    assert.deepEqual(mock.removed[0], [
      "camp/vid/550e8400-e29b-41d4-a716-446655440000.mp4",
    ]);
  });
});
