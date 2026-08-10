import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { VideoPreviewUploadPanel } from "@/features/videos/components/video-preview-upload";

const ROOT = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

describe("video detail preview panel wiring", () => {
  it("is rendered on the manage video detail route below links/info", () => {
    const page = read(
      "app/(protected)/(manage)/campaigns/[id]/videos/[videoId]/page.tsx"
    );

    assert.match(page, /VideoPreviewUpload/);
    assert.match(page, /preview_media_url/);
    assert.match(page, /preview_media_type/);

    const linksIndex = page.indexOf('title="Bağlantılar ve Tarihler"');
    const panelIndex = page.indexOf("<VideoPreviewUpload");
    const descriptionIndex = page.indexOf(">Açıklama<");

    assert.notEqual(linksIndex, -1);
    assert.notEqual(panelIndex, -1);
    assert.notEqual(descriptionIndex, -1);
    assert.equal(panelIndex > linksIndex, true);
    assert.equal(panelIndex < descriptionIndex, true);
  });

  it("is not mounted on report or public routes", () => {
    const reportLive = read(
      "app/(protected)/(report)/campaigns/[id]/report/page.tsx"
    );
    assert.equal(reportLive.includes("VideoPreviewUpload"), false);

    const publicReport = read("app/(public-report)/r/[token]/page.tsx");
    assert.equal(publicReport.includes("VideoPreviewUpload"), false);
  });

  it("video detail query explicitly selects preview fields", () => {
    const queries = read("features/videos/queries.ts");
    assert.match(queries, /preview_media_url/);
    assert.match(queries, /preview_media_type/);
  });
});

describe("video preview upload UI states", () => {
  it("renders upload control when preview is absent", () => {
    const html = renderToStaticMarkup(
      <VideoPreviewUploadPanel hasPreview={false} />
    );

    assert.match(html, /Rapor Önizleme Videosu/);
    assert.match(html, /MP4 \/ WebM Yükle/);
    assert.match(html, /data-has-preview="false"/);
    assert.match(html, /data-preview-upload-trigger/);
    assert.match(html, /data-upload-transport="browser-storage"/);
    assert.equal(html.includes("Önizlemeyi Kaldır"), false);
    assert.equal(html.includes("Önizlemeyi Değiştir"), false);
  });

  it("renders change/remove and uploading states", () => {
    const html = renderToStaticMarkup(
      <VideoPreviewUploadPanel
        hasPreview
        previewMediaType="video/mp4"
        thumbnailUrl="https://cdn.example.com/thumb.jpg"
      />
    );

    assert.match(html, /Önizleme hazır/);
    assert.match(html, /Önizlemeyi Değiştir/);
    assert.match(html, /Önizlemeyi Kaldır/);
    assert.match(html, /data-has-preview="true"/);
    assert.match(html, /data-preview-remove-trigger/);

    const pending = renderToStaticMarkup(
      <VideoPreviewUploadPanel hasPreview={false} pending />
    );
    assert.match(pending, /Yükleniyor…/);
  });
});

describe("video preview actions contracts", () => {
  it("metadata-only server action; binary upload stays in the browser", () => {
    const actions = read("features/videos/actions.ts");
    assert.match(actions, /export async function commitVideoPreviewMetadata/);
    assert.match(actions, /export async function removeVideoPreview/);
    assert.match(actions, /getVerifiedAuth/);
    assert.match(actions, /Oturum açmanız gerekiyor/);
    assert.match(actions, /commitPreviewMetadataCore/);
    assert.equal(actions.includes("uploadVideoPreview"), false);
    assert.equal(actions.includes("uploadPreviewMediaCore"), false);

    const client = read("features/videos/components/video-preview-upload.tsx");
    assert.match(client, /uploadPreviewFileToStorage/);
    assert.match(client, /commitVideoPreviewMetadata\(\{/);
    assert.match(client, /objectPath:/);
    assert.match(client, /mediaType:/);
    assert.equal(client.includes("new FormData"), false);

    const browser = read("features/videos/preview-browser-upload.ts");
    assert.match(browser, /createClient/);
    assert.match(browser, /\.upload\(objectPath, input\.file/);
  });

  it("success path updates DB from owned path and revalidates", () => {
    const core = read("features/videos/preview-upload-core.ts");
    assert.match(core, /preview_media_url: publicUrl/);
    assert.match(core, /preview_media_type: input\.mediaType/);
    assert.match(core, /isOwnedPreviewObjectPath/);
    assert.match(core, /onRevalidate/);
    assert.match(core, /\.remove\(\[previousPath\]\)/);

    const actions = read("features/videos/actions.ts");
    assert.match(
      actions,
      /revalidateVideoPaths\(input\.campaignId, input\.videoId\)/
    );
  });
});
