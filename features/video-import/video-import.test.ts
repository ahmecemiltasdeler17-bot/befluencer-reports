import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  VIDEO_IMPORT_MAX_URLS,
  VIDEO_IMPORT_MESSAGES,
  VIDEO_IMPORT_PROVIDER_CONCURRENCY,
} from "@/features/video-import/constants";
import {
  buildPreviewRow,
  matchCreatorByIdentity,
  normalizeHandle,
  resolveDuplicateVideoStatus,
} from "@/features/video-import/matching";
import { parseVideoImportUrls } from "@/features/video-import/parser";

describe("video import URL parsing", () => {
  it("accepts one valid TikTok video URL", () => {
    const result = parseVideoImportUrls(
      "https://www.tiktok.com/@ayar/video/7123456789012345678"
    );
    assert.equal(result.urls.length, 1);
    assert.equal(result.invalid.length, 0);
    assert.equal(
      result.urls[0].platformVideoId,
      "7123456789012345678"
    );
  });

  it("accepts multiple valid URLs", () => {
    const result = parseVideoImportUrls(
      [
        "https://www.tiktok.com/@a/video/1111111111111111111",
        "https://www.tiktok.com/@b/video/2222222222222222222",
      ].join("\n")
    );
    assert.equal(result.urls.length, 2);
  });

  it("deduplicates identical normalized URLs", () => {
    const result = parseVideoImportUrls(
      [
        "https://www.tiktok.com/@a/video/1111111111111111111?utm=1",
        "https://www.tiktok.com/@a/video/1111111111111111111",
      ].join("\n")
    );
    assert.equal(result.urls.length, 1);
    assert.equal(result.dedupedCount, 1);
  });

  it("rejects non-TikTok URLs", () => {
    const result = parseVideoImportUrls("https://youtube.com/watch?v=abc");
    assert.equal(result.urls.length, 0);
    assert.equal(result.invalid.length, 1);
    assert.equal(result.invalid[0].message, VIDEO_IMPORT_MESSAGES.invalid_url);
  });

  it("enforces max 100 URL limit", () => {
    const lines = Array.from(
      { length: 101 },
      (_, index) =>
        `https://www.tiktok.com/@u/video/${7000000000000000000 + index}`
    );
    const result = parseVideoImportUrls(lines.join("\n"));
    assert.equal(result.truncated, true);
    assert.equal(result.urls.length, 0);
  });

  it("ignores empty lines", () => {
    const result = parseVideoImportUrls(
      "\nhttps://www.tiktok.com/@a/video/1111111111111111111\n\n"
    );
    assert.equal(result.urls.length, 1);
    assert.ok(result.skippedEmptyLines >= 2);
  });
});

describe("video import creator matching", () => {
  const existing = [
    {
      id: "11111111-2222-4333-8444-555555555555",
      username: "ayar",
      profile_url: "https://www.tiktok.com/@ayar",
    },
    {
      id: "22222222-3333-4444-8555-666666666666",
      username: "other",
      profile_url: "https://www.tiktok.com/@other",
    },
  ];

  it("matches existing creator by normalized username", () => {
    const match = matchCreatorByIdentity("@Ayar", null, existing);
    assert.equal(match?.id, existing[0].id);
  });

  it("matches by exact canonical profile URL", () => {
    const byUrlOnly = matchCreatorByIdentity(
      null,
      "https://www.tiktok.com/@other",
      existing
    );
    assert.equal(byUrlOnly?.id, existing[1].id);

    const byUrlFallback = matchCreatorByIdentity(
      "unknownhandlezz",
      "https://www.tiktok.com/@other",
      existing
    );
    assert.equal(byUrlFallback?.id, existing[1].id);
  });

  it("never matches by display name alone", () => {
    const match = matchCreatorByIdentity("Ayşe Yıldız", null, [
      {
        id: "11111111-2222-4333-8444-555555555555",
        username: "ayar",
        profile_url: "https://www.tiktok.com/@ayar",
      },
    ]);
    assert.equal(match, null);
    assert.equal(normalizeHandle("Ayşe Yıldız"), null);
  });

  it("marks missing creator identity as unverified / manual", () => {
    const row = buildPreviewRow({
      rowKey: "1",
      originalUrl: "https://www.tiktok.com/@x/video/1",
      normalizedUrl: "https://www.tiktok.com/@x/video/1",
      platformVideoId: "1",
      thumbnailUrl: null,
      caption: "hi",
      publishedAt: null,
      creatorUsername: null,
      creatorDisplayName: "Someone",
      creatorAvatarUrl: null,
      creatorFollowerCount: 10,
      creatorProfileUrl: null,
      views: 1,
      likes: 1,
      comments: 0,
      shares: 0,
      saves: 0,
      matchedCreator: null,
    });
    assert.equal(row.videoStatus, "creator_unverified");
    assert.equal(row.creatorStatus, "manual_required");
    assert.equal(row.message, VIDEO_IMPORT_MESSAGES.creator_unverified);
    assert.equal(row.selectable, true);
  });

  it("flags will_create when username is valid and unmatched", () => {
    const row = buildPreviewRow({
      rowKey: "1",
      originalUrl: "https://www.tiktok.com/@newuser/video/1",
      normalizedUrl: "https://www.tiktok.com/@newuser/video/1",
      platformVideoId: "1",
      thumbnailUrl: null,
      caption: null,
      publishedAt: null,
      creatorUsername: "newuser",
      creatorDisplayName: "New",
      creatorAvatarUrl: null,
      creatorFollowerCount: 5000,
      creatorProfileUrl: "https://www.tiktok.com/@newuser",
      views: null,
      likes: null,
      comments: null,
      shares: null,
      saves: null,
      matchedCreator: null,
    });
    assert.equal(row.creatorStatus, "will_create");
    assert.equal(row.videoStatus, "importable");
  });
});

describe("video import duplicates", () => {
  const campaignId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
  const otherCampaign = "ffffffff-1111-4222-8333-444444444444";

  it("skips video already in campaign by URL", () => {
    const result = resolveDuplicateVideoStatus(
      campaignId,
      "https://www.tiktok.com/@a/video/1",
      "1",
      [
        {
          id: "v1",
          campaign_id: campaignId,
          video_url: "https://www.tiktok.com/@a/video/1",
          platform_video_id: "1",
        },
      ]
    );
    assert.equal(result.videoStatus, "already_in_campaign");
  });

  it("flags video existing in another campaign", () => {
    const result = resolveDuplicateVideoStatus(
      campaignId,
      "https://www.tiktok.com/@a/video/1",
      "1",
      [
        {
          id: "v1",
          campaign_id: otherCampaign,
          video_url: "https://www.tiktok.com/@a/video/1",
          platform_video_id: "1",
        },
      ]
    );
    assert.equal(result.videoStatus, "exists_elsewhere");
  });

  it("detects same platform video id in campaign", () => {
    const result = resolveDuplicateVideoStatus(
      campaignId,
      "https://vm.tiktok.com/short",
      "999",
      [
        {
          id: "v1",
          campaign_id: campaignId,
          video_url: "https://www.tiktok.com/@a/video/999",
          platform_video_id: "999",
        },
      ]
    );
    assert.equal(result.videoStatus, "already_in_campaign");
  });
});

describe("video import contracts", () => {
  it("uses provider concurrency bound of 2", () => {
    assert.equal(VIDEO_IMPORT_PROVIDER_CONCURRENCY, 2);
    assert.equal(VIDEO_IMPORT_MAX_URLS, 100);
  });

  it("does not call Apify from client dialog", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "features",
        "video-import",
        "components",
        "import-campaign-videos-dialog.tsx"
      ),
      "utf8"
    );
    assert.equal(source.includes("createApifyTikTokProvider"), false);
    assert.equal(source.includes("APIFY"), false);
    assert.equal(source.includes("fetchVideoMetrics"), false);
    assert.match(source, /previewCampaignVideoImportAction/);
    assert.match(source, /importCampaignVideosFromUrlsAction/);
  });

  it("keeps manual video form route available", () => {
    const list = readFileSync(
      path.join(
        process.cwd(),
        "features",
        "videos",
        "components",
        "campaign-video-list.tsx"
      ),
      "utf8"
    );
    assert.match(list, /Manuel Video Ekle/);
    assert.match(list, /importAction/);
  });

  it("preserves Turkish row messages", () => {
    assert.equal(
      VIDEO_IMPORT_MESSAGES.invalid_url,
      "Geçersiz TikTok video bağlantısı."
    );
    assert.equal(
      VIDEO_IMPORT_MESSAGES.already_in_campaign,
      "Video zaten bu kampanyada bulunuyor."
    );
    assert.equal(
      VIDEO_IMPORT_MESSAGES.creator_unverified,
      "Video bulundu ancak creator bilgisi doğrulanamadı."
    );
    assert.equal(
      VIDEO_IMPORT_MESSAGES.provider_empty,
      "TikTok sağlayıcısı bu bağlantı için sonuç döndürmedi."
    );
    assert.equal(
      VIDEO_IMPORT_MESSAGES.manual_required,
      "Creator eşleştirmesi gerekli."
    );
    assert.equal(
      VIDEO_IMPORT_MESSAGES.added,
      "Video başarıyla eklendi."
    );
  });

  it("campaign assignment helper never updates fee fields in source", () => {
    const source = readFileSync(
      path.join(process.cwd(), "features", "video-import", "queries.ts"),
      "utf8"
    );
    assert.match(source, /ensureCampaignCreatorAssignment/);
    assert.match(source, /agreed_content_count: 0/);
    assert.match(source, /fee: null/);
    assert.equal(source.includes(".update("), false);
  });

  it("new creators use category_source auto", () => {
    const source = readFileSync(
      path.join(process.cwd(), "features", "video-import", "queries.ts"),
      "utf8"
    );
    assert.match(source, /category_source: \"auto\"/);
    assert.match(source, /calculateCreatorCategory/);
  });

  it("batch commit continues per-row (loop, not Promise.all fail-fast)", () => {
    const source = readFileSync(
      path.join(process.cwd(), "features", "video-import", "actions.ts"),
      "utf8"
    );
    assert.match(source, /for \(const row of input\.rows\)/);
    assert.match(source, /commitOneRow/);
    assert.match(source, /summary\.failedRows/);
  });

  it("reports path is revalidated after import", () => {
    const source = readFileSync(
      path.join(process.cwd(), "features", "video-import", "actions.ts"),
      "utf8"
    );
    assert.match(source, /revalidatePath\(`\/campaigns\/\$\{input\.campaignId\}\/report`\)/);
  });
});
