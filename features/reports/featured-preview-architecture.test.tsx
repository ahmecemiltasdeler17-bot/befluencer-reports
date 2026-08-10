import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const ROOT = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

describe("featured video preview architecture", () => {
  it("supports optional manual MP4/WebM preview without scraping TikTok media", () => {
    const media = read("components/report/content/featured-content-media.tsx");
    const migration = read(
      "supabase/migrations/20260809140000_video_preview_media.sql"
    );
    const actions = read("features/videos/actions.ts");

    assert.match(media, /previewMediaUrl/);
    assert.match(media, /muted/);
    assert.match(media, /playsInline/);
    assert.match(media, /data-featured-preview-toggle/);
    assert.match(media, /İçeriği aç/);
    assert.equal(media.includes("tiktokcdn"), false);
    assert.equal(media.includes("IntersectionObserver"), false);
    assert.match(migration, /preview_media_url/);
    assert.match(migration, /featured-video-previews/);
    assert.match(actions, /commitVideoPreviewMetadata/);
    assert.match(actions, /commitPreviewMetadataCore/);
    const core = read("features/videos/preview-upload-core.ts");
    assert.match(core, /isOwnedPreviewObjectPath/);
    const browser = read("features/videos/preview-browser-upload.ts");
    assert.match(browser, /uploadPreviewFileToStorage/);
  });

  it("keeps thumbnail_url and video_url semantics unchanged", () => {
    const schema = read(
      "supabase/migrations/20260805200000_initial_schema.sql"
    );
    assert.match(schema, /thumbnail_url text/);
    assert.match(schema, /video_url text not null/);
  });
});
