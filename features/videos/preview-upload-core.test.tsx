import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { VideoPreviewUploadPanel } from "@/features/videos/components/video-preview-upload";
import {
  FEATURED_PREVIEW_BUCKET,
  NEXT_SERVER_ACTION_DEFAULT_BODY_LIMIT_BYTES,
  buildPreviewObjectPath,
  isOwnedPreviewObjectPath,
  isOwnedPreviewPublicUrl,
  validatePreviewUpload,
} from "@/features/videos/preview-media";
import {
  commitPreviewMetadataCore,
  removePreviewMediaCore,
} from "@/features/videos/preview-upload-core";

const OWNED_PATH = buildPreviewObjectPath({
  campaignId: "camp",
  videoId: "vid",
  uuid: "550e8400-e29b-41d4-a716-446655440000",
  extension: "mp4",
});

function createMockSupabase(options?: {
  updateError?: { message: string; name?: string; code?: string } | null;
}) {
  const removed: string[][] = [];
  const updated: Array<Record<string, unknown>> = [];

  const supabase = {
    storage: {
      from(bucket: string) {
        assert.equal(bucket, FEATURED_PREVIEW_BUCKET);
        return {
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
    from(table: string) {
      assert.equal(table, "videos");
      return {
        update(payload: Record<string, unknown>) {
          updated.push(payload);
          return {
            eq() {
              return {
                eq() {
                  if (options?.updateError) {
                    return Promise.resolve({ error: options.updateError });
                  }
                  return Promise.resolve({ error: null });
                },
              };
            },
          };
        },
      };
    },
  };

  return {
    supabase: supabase as never,
    removed,
    updated,
  };
}

describe("preview client validation (pre-upload)", () => {
  it("accepts valid MP4 / WebM and rejects invalid MIME / oversize", () => {
    const mp4 = validatePreviewUpload(
      new File([new Uint8Array([1, 2, 3])], "clip.mp4", { type: "video/mp4" })
    );
    assert.equal(mp4.ok, true);

    const webm = validatePreviewUpload(
      new File([new Uint8Array([1])], "clip.webm", { type: "video/webm" })
    );
    assert.equal(webm.ok, true);

    const bad = validatePreviewUpload(
      new File(["x"], "clip.exe", { type: "application/octet-stream" })
    );
    assert.equal(bad.ok, false);
    if (!bad.ok) assert.equal(bad.error, "Yalnızca MP4 veya WebM yükleyebilirsiniz.");

    const huge = new File([new Uint8Array(1)], "huge.mp4", { type: "video/mp4" });
    Object.defineProperty(huge, "size", { value: 30 * 1024 * 1024 + 1 });
    const oversize = validatePreviewUpload(huge);
    assert.equal(oversize.ok, false);
    if (!oversize.ok) assert.equal(oversize.error, "Video 30 MB sınırını aşıyor.");
  });

  it("builds UUID object paths and rejects foreign paths/URLs", () => {
    assert.equal(isOwnedPreviewObjectPath("camp", "vid", OWNED_PATH), true);
    assert.equal(
      isOwnedPreviewObjectPath("camp", "vid", "camp/vid/not-a-uuid.mp4"),
      false
    );
    assert.equal(
      isOwnedPreviewObjectPath("camp", "vid", "other/vid/" + OWNED_PATH.split("/").pop()),
      false
    );

    const ownedUrl = `https://example.supabase.co/storage/v1/object/public/${FEATURED_PREVIEW_BUCKET}/${OWNED_PATH}`;
    assert.equal(isOwnedPreviewPublicUrl("camp", "vid", ownedUrl), true);
    assert.equal(
      isOwnedPreviewPublicUrl("camp", "vid", "https://evil.example/clip.mp4"),
      false
    );
  });

  it("documents that Server Action default body limit is 1MB", () => {
    assert.equal(NEXT_SERVER_ACTION_DEFAULT_BODY_LIMIT_BYTES, 1 * 1024 * 1024);
    const config = readFileSync("next.config.ts", "utf8");
    assert.match(config, /bodySizeLimit/);
    assert.match(config, /browser → Supabase/);
    assert.equal(config.includes("bodySizeLimit:"), false);
  });
});

describe("commitPreviewMetadataCore", () => {
  it("commits owned path + MIME and derives public URL server-side", async () => {
    const mock = createMockSupabase();
    let revalidated = false;

    const result = await commitPreviewMetadataCore({
      supabase: mock.supabase,
      campaignId: "camp",
      videoId: "vid",
      objectPath: OWNED_PATH,
      mediaType: "video/mp4",
      previousPreviewUrl: null,
      onRevalidate: () => {
        revalidated = true;
      },
      log: () => {},
    });

    assert.equal(result.ok, true);
    assert.deepEqual(mock.updated[0], {
      preview_media_url: `https://example.supabase.co/storage/v1/object/public/${FEATURED_PREVIEW_BUCKET}/${OWNED_PATH}`,
      preview_media_type: "video/mp4",
    });
    assert.equal(revalidated, true);
    assert.equal(mock.removed.length, 0);
  });

  it("rejects arbitrary external paths without updating DB", async () => {
    const mock = createMockSupabase();
    const result = await commitPreviewMetadataCore({
      supabase: mock.supabase,
      campaignId: "camp",
      videoId: "vid",
      objectPath: "https://evil.example/clip.mp4",
      mediaType: "video/mp4",
      previousPreviewUrl: null,
      onRevalidate: () => {
        assert.fail("should not revalidate");
      },
      log: () => {},
    });

    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.stage, "validate");
    assert.equal(mock.updated.length, 0);
  });

  it("rejects invalid MIME on metadata commit", async () => {
    const mock = createMockSupabase();
    const result = await commitPreviewMetadataCore({
      supabase: mock.supabase,
      campaignId: "camp",
      videoId: "vid",
      objectPath: OWNED_PATH,
      mediaType: "video/avi",
      previousPreviewUrl: null,
      onRevalidate: () => {
        assert.fail("should not revalidate");
      },
      log: () => {},
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, "Yalnızca MP4 veya WebM yükleyebilirsiniz.");
    }
    assert.equal(mock.updated.length, 0);
  });

  it("does not remove old preview when DB update fails", async () => {
    const oldUrl = `https://example.supabase.co/storage/v1/object/public/${FEATURED_PREVIEW_BUCKET}/camp/vid/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.mp4`;
    const mock = createMockSupabase({
      updateError: { message: "rls", name: "PostgrestError", code: "42501" },
    });

    const result = await commitPreviewMetadataCore({
      supabase: mock.supabase,
      campaignId: "camp",
      videoId: "vid",
      objectPath: OWNED_PATH,
      mediaType: "video/mp4",
      previousPreviewUrl: oldUrl,
      onRevalidate: () => {
        assert.fail("should not revalidate");
      },
      log: () => {},
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.stage, "db-update");
      assert.match(result.error, /temizlendi/);
    }
    // Server does not delete the new object (client cleans up) nor the old one.
    assert.equal(mock.removed.length, 0);
  });

  it("removes the old object only after the new DB update succeeds", async () => {
    const oldPath = "camp/vid/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.mp4";
    const oldUrl = `https://example.supabase.co/storage/v1/object/public/${FEATURED_PREVIEW_BUCKET}/${oldPath}`;
    const mock = createMockSupabase();

    const result = await commitPreviewMetadataCore({
      supabase: mock.supabase,
      campaignId: "camp",
      videoId: "vid",
      objectPath: OWNED_PATH,
      mediaType: "video/mp4",
      previousPreviewUrl: oldUrl,
      onRevalidate: () => {},
      log: () => {},
    });

    assert.equal(result.ok, true);
    assert.equal(mock.removed.length, 1);
    assert.deepEqual(mock.removed[0], [oldPath]);
    assert.notEqual(mock.removed[0][0], OWNED_PATH);
  });
});

describe("removePreviewMediaCore", () => {
  it("clears DB fields then removes storage object", async () => {
    const oldPath = "camp/vid/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.mp4";
    const oldUrl = `https://example.supabase.co/storage/v1/object/public/${FEATURED_PREVIEW_BUCKET}/${oldPath}`;
    const mock = createMockSupabase();
    let revalidated = false;

    const result = await removePreviewMediaCore({
      supabase: mock.supabase,
      campaignId: "camp",
      videoId: "vid",
      previousPreviewUrl: oldUrl,
      onRevalidate: () => {
        revalidated = true;
      },
      log: () => {},
    });

    assert.equal(result.ok, true);
    assert.deepEqual(mock.updated[0], {
      preview_media_url: null,
      preview_media_type: null,
    });
    assert.deepEqual(mock.removed[0], [oldPath]);
    assert.equal(revalidated, true);
  });
});

describe("preview action contracts and UI safety", () => {
  it("metadata action never accepts FormData binary and never redirects", () => {
    const source = readFileSync("features/videos/actions.ts", "utf8");
    const commitFn = source.slice(
      source.indexOf("export async function commitVideoPreviewMetadata")
    );
    const commitBody = commitFn.slice(
      0,
      commitFn.indexOf("export async function removeVideoPreview")
    );
    assert.match(commitBody, /stage: "action-entered"/);
    assert.match(commitBody, /try \{/);
    assert.match(commitBody, /Önizleme videosu yüklenemedi/);
    assert.equal(commitBody.includes("redirect("), false);
    assert.equal(commitBody.includes("FormData"), false);
    assert.match(commitBody, /commitPreviewMetadataCore/);
    assert.match(commitBody, /objectPath/);
    assert.match(commitBody, /mediaType/);
    assert.match(source, /getVerifiedAuth/);
  });

  it("renders both null and present preview states on the panel", () => {
    const absent = renderToStaticMarkup(
      <VideoPreviewUploadPanel hasPreview={false} />
    );
    const present = renderToStaticMarkup(
      <VideoPreviewUploadPanel hasPreview previewMediaType="video/mp4" />
    );
    const uploading = renderToStaticMarkup(
      <VideoPreviewUploadPanel hasPreview={false} pending />
    );
    assert.match(absent, /MP4 \/ WebM Yükle/);
    assert.match(present, /Önizleme hazır/);
    assert.match(uploading, /Yükleniyor…/);
    assert.match(absent, /data-upload-transport="browser-storage"/);
  });

  it("client uploads via browser Storage then metadata-only action", () => {
    const source = readFileSync(
      "features/videos/components/video-preview-upload.tsx",
      "utf8"
    );
    assert.match(source, /uploadPreviewFileToStorage/);
    assert.match(source, /commitVideoPreviewMetadata/);
    assert.match(source, /removePreviewStorageObject/);
    assert.match(source, /Yükleniyor…/);
    assert.equal(source.includes("new FormData"), false);
    assert.equal(source.includes("formData.append"), false);
    assert.match(source, /try \{/);
    assert.match(source, /catch \(error\)/);
    assert.match(
      source,
      /Video yüklendi ancak önizleme kaydedilemedi\. Yüklenen dosya temizlendi\./
    );
  });
});
