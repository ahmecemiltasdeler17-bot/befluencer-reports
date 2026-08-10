import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { z } from "zod";

import { renderToStaticMarkup } from "react-dom/server";

import { FeaturedContentMedia } from "@/components/report/content/featured-content-media";
import {
  buildPreviewObjectPath,
  extractPreviewObjectPath,
  FEATURED_PREVIEW_BUCKET,
  PREVIEW_MAX_BYTES,
  validatePreviewUpload,
} from "@/features/videos/preview-media";
import type { Video } from "@/lib/types";

const ROOT = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

/** Mirrors the optional preview fields on report videoSchema. */
const videoCompatSchema = z.object({
  id: z.string(),
  title: z.string(),
  creatorHandle: z.string(),
  creatorName: z.string(),
  creatorAvatar: z.string(),
  thumbnail: z.string(),
  platform: z.enum(["tiktok", "instagram", "youtube"]),
  views: z.number(),
  likes: z.number(),
  comments: z.number(),
  shares: z.number(),
  saves: z.number(),
  engagementRate: z.number(),
  publishedAt: z.string(),
  url: z.string(),
  category: z.string(),
  hasMetrics: z.boolean().optional(),
  creatorProfileUrl: z.string().nullable().optional(),
  previewMediaUrl: z.string().nullable().optional(),
  previewMediaType: z.string().nullable().optional(),
});

function makeVideo(partial: Partial<Video> = {}): Video {
  return {
    id: "vid-1",
    title: "Featured",
    creatorHandle: "@creator",
    creatorName: "Creator",
    creatorAvatar: "",
    thumbnail: "https://cdn.example.com/thumb.jpg",
    platform: "tiktok",
    views: 10000,
    likes: 100,
    comments: 10,
    shares: 5,
    saves: 3,
    engagementRate: 4.2,
    publishedAt: "2026-06-01",
    url: "https://www.tiktok.com/@creator/video/1",
    category: "micro",
    hasMetrics: true,
    ...partial,
  };
}

describe("featured preview validation", () => {
  it("rejects unauthorized empty uploads", () => {
    const result = validatePreviewUpload(null);
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /seçin/i);
  });

  it("rejects invalid MIME types", () => {
    const file = new File(["x"], "clip.exe", {
      type: "application/octet-stream",
    });
    const result = validatePreviewUpload(file);
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /MP4|WebM/i);
  });

  it("rejects oversize files", () => {
    const huge = { size: PREVIEW_MAX_BYTES + 1, type: "video/mp4" } as File;
    const result = validatePreviewUpload(huge);
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /30 MB/i);
  });

  it("accepts MP4 within the size bound", () => {
    const file = new File(["data"], "clip.mp4", { type: "video/mp4" });
    const result = validatePreviewUpload(file);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.mime, "video/mp4");
      assert.equal(result.extension, "mp4");
    }
  });

  it("builds UUID object paths and never trusts filenames", () => {
    const objectPath = buildPreviewObjectPath({
      campaignId: "camp",
      videoId: "vid",
      uuid: "11111111-1111-1111-1111-111111111111",
      extension: "mp4",
    });
    assert.equal(
      objectPath,
      "camp/vid/11111111-1111-1111-1111-111111111111.mp4"
    );
    assert.equal(objectPath.includes("original-name.mp4"), false);
    assert.equal(FEATURED_PREVIEW_BUCKET, "featured-video-previews");
  });

  it("extracts storage object paths from public URLs", () => {
    const url = `https://xyz.supabase.co/storage/v1/object/public/${FEATURED_PREVIEW_BUCKET}/a/b/c.mp4`;
    assert.equal(extractPreviewObjectPath(url), "a/b/c.mp4");
  });
});

describe("featured preview rendering", () => {
  it("renders poster-only when preview metadata is absent", () => {
    const html = renderToStaticMarkup(
      <FeaturedContentMedia video={makeVideo({ previewMediaUrl: null })} />
    );
    assert.match(html, /data-featured-preview="poster"/);
    assert.equal(html.includes("<video"), false);
    assert.equal(html.includes("Önizleme"), false);
  });

  it("exposes video preview when preview metadata is present", () => {
    const html = renderToStaticMarkup(
      <FeaturedContentMedia
        video={makeVideo({
          previewMediaUrl:
            "https://cdn.example.com/storage/v1/object/public/featured-video-previews/a/b.mp4",
          previewMediaType: "video/mp4",
        })}
      />
    );
    assert.match(html, /data-featured-preview="ready"/);
    assert.match(html, /<video/);
    assert.match(html, /muted=""/);
    assert.match(html, /playsinline/i);
    assert.match(html, /preload="metadata"/);
    assert.match(html, /Önizleme/);
    assert.match(html, /loop=""/);
    assert.match(html, /data-featured-preview-toggle/);
    assert.match(html, /Video önizlemesini oynat/);
    assert.match(html, /Önizle/);
    assert.match(html, /İçeriği aç/);
    assert.match(html, /data-featured-open-content/);
  });

  it("keeps TikTok navigation available separately from the preview control", () => {
    const html = renderToStaticMarkup(
      <FeaturedContentMedia
        video={makeVideo({
          previewMediaUrl: "https://cdn.example.com/preview.mp4",
        })}
      />
    );
    assert.match(html, /href="https:\/\/www\.tiktok\.com\/@creator\/video\/1"/);
    assert.match(html, /data-featured-open-content/);
    assert.match(html, /featured-preview-bleed-link/);
    // Preview toggle is a real button, not nested inside the TikTok anchor.
    assert.match(html, /<button[^>]*data-featured-preview-toggle/);
  });

  it("uses hover-intent + explicit touch toggle in the client source", () => {
    const source = read("components/report/content/featured-content-media.tsx");
    assert.match(source, /HOVER_INTENT_MS = 250/);
    assert.match(source, /shouldArmHoverPreview/);
    assert.match(source, /startPreview/);
    assert.match(source, /stopPreview/);
    assert.match(source, /currentTime = 0/);
    assert.match(source, /onError/);
    assert.match(source, /pdf-document/);
    assert.match(source, /Video önizlemesini oynat/);
    assert.match(source, /Video önizlemesini durdur/);
    assert.match(source, /Duraklat/);
    assert.match(source, /defaultMuted/);
    assert.match(source, /playsInline = true/);
    // play() rejection must not permanently mark the preview failed.
    const startFn = source.slice(source.indexOf("const startPreview"));
    const startBody = startFn.slice(0, startFn.indexOf("useEffect"));
    assert.match(startBody, /catch \{/);
    assert.equal(startBody.includes("setFailedUrl"), false);
    // No intersection / visibility autoplay on mobile.
    assert.equal(source.includes("IntersectionObserver"), false);
    assert.equal(source.includes("scrollIntoView"), false);
  });

  it("hides featured video elements in PDF CSS and disables bleed on touch", () => {
    const css = read("app/globals.css");
    assert.match(
      css,
      /\.pdf-document \.featured-preview-video[\s\S]*?display:\s*none/
    );
    assert.match(css, /\.pdf-document \.featured-preview-touch-ui/);
    assert.match(
      css,
      /@media \(hover: none\), \(pointer: coarse\)[\s\S]*?\.featured-preview-bleed-link[\s\S]*?pointer-events:\s*none;/
    );
    assert.doesNotMatch(
      css,
      /\.pdf-document[^{]*\{[^}]*pointer-events:\s*none\s*!important/
    );
  });
});

describe("featured preview snapshot compatibility", () => {
  it("accepts historical snapshots without preview metadata", () => {
    const legacy = {
      id: "v1",
      title: "Video",
      creatorHandle: "@a",
      creatorName: "A",
      creatorAvatar: "",
      thumbnail: "https://cdn.example.com/t.jpg",
      platform: "tiktok" as const,
      views: 1,
      likes: 1,
      comments: 0,
      shares: 0,
      saves: 0,
      engagementRate: 1,
      publishedAt: "2026-01-01",
      url: "https://www.tiktok.com/@a/video/1",
      category: "micro",
    };

    const parsed = videoCompatSchema.safeParse(legacy);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.previewMediaUrl, undefined);
    }
  });

  it("freezes preview metadata into new snapshot videos when present", () => {
    const parsed = videoCompatSchema.safeParse(
      makeVideo({
        previewMediaUrl:
          "https://cdn.example.com/storage/v1/object/public/featured-video-previews/x.mp4",
        previewMediaType: "video/mp4",
      })
    );
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.match(parsed.data.previewMediaUrl ?? "", /featured-video-previews/);
      assert.equal(parsed.data.previewMediaType, "video/mp4");
    }

    const source = read("features/report-generation/schemas.ts");
    assert.match(
      source,
      /previewMediaUrl: z\.string\(\)\.nullable\(\)\.optional/
    );
    const mapper = read("features/reports/mapper.ts");
    assert.match(mapper, /previewMediaUrl: row\.preview_media_url/);
  });
});

describe("featured preview upload action contracts", () => {
  it("requires authenticated metadata commit/remove; binary stays in browser", () => {
    const source = read("features/videos/actions.ts");
    assert.match(source, /export async function commitVideoPreviewMetadata/);
    assert.match(source, /export async function removeVideoPreview/);
    assert.match(source, /getVerifiedAuth/);
    assert.match(source, /commitPreviewMetadataCore/);
    assert.match(source, /removePreviewMediaCore/);
    assert.match(source, /Oturum açmanız gerekiyor/);
    assert.match(source, /Önizleme videosu yüklenemedi/);
    const commitFn = source.slice(
      source.indexOf("export async function commitVideoPreviewMetadata")
    );
    const commitBody = commitFn.slice(
      0,
      commitFn.indexOf("export async function removeVideoPreview")
    );
    assert.equal(commitBody.includes("FormData"), false);

    const core = read("features/videos/preview-upload-core.ts");
    assert.match(core, /FEATURED_PREVIEW_BUCKET/);
    assert.match(core, /isOwnedPreviewObjectPath/);
    assert.equal(core.includes("Uint8Array"), false);

    const browser = read("features/videos/preview-browser-upload.ts");
    assert.match(browser, /uploadPreviewFileToStorage/);
    assert.match(browser, /\.upload\(objectPath, input\.file/);
  });
});
