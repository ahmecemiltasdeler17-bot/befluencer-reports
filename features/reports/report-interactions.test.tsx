import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { FeaturedContentMedia } from "@/components/report/content/featured-content-media";
import { TikTokContentCard } from "@/components/report/content/tiktok-content-card";
import { ReportCreatorLink } from "@/components/report/links/report-creator-link";
import { ReportExternalLinkIcon } from "@/components/report/links/report-external-link-icon";
import { ReportVideoLink } from "@/components/report/links/report-video-link";
import { ReportVideoThumbnail } from "@/components/report/media/report-video-thumbnail";
import { decidePrintRequest } from "@/features/pdf/services/print-request-policy";
import { reportSnapshotSchema } from "@/features/report-generation/schemas";
import { serializeReportSnapshot } from "@/features/report-generation/services/serialize-report-snapshot";
import type { CampaignReportData } from "@/features/reports/types";
import {
  isValidImageSrc,
  shouldUseMediaFallback,
} from "@/lib/media-fallback-styles";
import {
  buildPlatformProfileUrl,
  resolveCreatorProfileUrl,
} from "@/lib/report-links/build-platform-profile-url";
import { isSafeExternalUrl } from "@/lib/report-links/is-safe-external-url";
import {
  normalizeSocialUrl,
  normalizeUsername,
} from "@/lib/report-links/normalize-social-url";
import {
  resolveCreatorLink,
  resolveVideoLink,
} from "@/lib/report-links/resolve-report-links";

const APP_ORIGIN = "https://reports.example.com";

/** Counts anchors and detects any anchor nested inside another. */
function inspectAnchors(html: string): {
  count: number;
  hasNestedAnchor: boolean;
} {
  const tokens = html.match(/<a\b|<\/a>/g) ?? [];
  let depth = 0;
  let count = 0;
  let hasNestedAnchor = false;

  for (const token of tokens) {
    if (token === "</a>") {
      depth -= 1;
      continue;
    }

    if (depth > 0) {
      hasNestedAnchor = true;
    }

    depth += 1;
    count += 1;
  }

  return { count, hasNestedAnchor };
}

describe("normalizeSocialUrl", () => {
  it("accepts a TikTok profile URL", () => {
    assert.equal(
      normalizeSocialUrl("https://www.tiktok.com/@ecemdans", "tiktok"),
      "https://www.tiktok.com/@ecemdans"
    );
  });

  it("accepts a TikTok video URL and drops share trackers", () => {
    assert.equal(
      normalizeSocialUrl(
        "https://www.tiktok.com/@ecemdans/video/7301234567890123456?is_from_webapp=1&sender_device=pc",
        "tiktok"
      ),
      "https://www.tiktok.com/@ecemdans/video/7301234567890123456"
    );
  });

  it("accepts TikTok short link hosts", () => {
    assert.equal(
      normalizeSocialUrl("https://vm.tiktok.com/ZMabcdef/", "tiktok"),
      "https://vm.tiktok.com/ZMabcdef"
    );
  });

  it("accepts an Instagram reel URL", () => {
    assert.equal(
      normalizeSocialUrl("https://www.instagram.com/reel/Cx1y2z3AbCd/", "instagram"),
      "https://www.instagram.com/reel/Cx1y2z3AbCd"
    );
  });

  it("accepts a YouTube watch URL and preserves the video id", () => {
    assert.equal(
      normalizeSocialUrl(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=share",
        "youtube"
      ),
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    );
  });

  it("accepts a youtu.be short link", () => {
    assert.equal(
      normalizeSocialUrl("https://youtu.be/dQw4w9WgXcQ", "youtube"),
      "https://youtu.be/dQw4w9WgXcQ"
    );
  });

  it("upgrades http to https", () => {
    assert.equal(
      normalizeSocialUrl("http://www.tiktok.com/@ecemdans", "tiktok"),
      "https://www.tiktok.com/@ecemdans"
    );
  });

  it("rejects dangerous schemes", () => {
    for (const candidate of [
      "javascript:alert(1)",
      "javascript:void(0)",
      "data:text/html;base64,PHNjcmlwdD4=",
      "file:///etc/passwd",
      "blob:https://www.tiktok.com/abc",
    ]) {
      assert.equal(normalizeSocialUrl(candidate), null, candidate);
      assert.equal(isSafeExternalUrl(candidate), false, candidate);
    }
  });

  it("rejects protocol-relative URLs", () => {
    assert.equal(normalizeSocialUrl("//www.tiktok.com/@ecemdans"), null);
  });

  it("rejects malformed and empty values", () => {
    for (const candidate of [
      "",
      "   ",
      "not a url",
      "www.tiktok.com/@ecemdans",
      "https://",
      null,
      undefined,
      42,
      {},
    ]) {
      assert.equal(normalizeSocialUrl(candidate), null, String(candidate));
    }
  });

  it("rejects hosts outside the social allowlist", () => {
    for (const candidate of [
      "https://tiktok.com.evil.example/@user",
      "https://evil.example/@user",
      "https://faketiktok.com/@user",
    ]) {
      assert.equal(normalizeSocialUrl(candidate), null, candidate);
    }
  });

  it("rejects a URL whose host contradicts the declared platform", () => {
    assert.equal(
      normalizeSocialUrl("https://www.instagram.com/someone", "tiktok"),
      null
    );
  });

  it("strips credentials and fragments", () => {
    assert.equal(
      normalizeSocialUrl("https://user:pass@www.tiktok.com/@ecemdans#bio", "tiktok"),
      "https://www.tiktok.com/@ecemdans"
    );
  });
});

describe("normalizeUsername", () => {
  it("strips a leading @ and surrounding whitespace", () => {
    assert.equal(normalizeUsername("  @ecemdans "), "ecemdans");
    assert.equal(normalizeUsername("@@ecemdans"), "ecemdans");
    assert.equal(normalizeUsername("ecemdans"), "ecemdans");
  });

  it("trims path and query remnants from a pasted handle", () => {
    assert.equal(normalizeUsername("ecemdans/video/7301234"), "ecemdans");
    assert.equal(normalizeUsername("ecemdans?lang=tr"), "ecemdans");
  });

  it("rejects values that cannot form a deterministic URL", () => {
    for (const candidate of ["", "@", "   ", "kullanıcı", "ecem!dans", null, 7]) {
      assert.equal(normalizeUsername(candidate), null, String(candidate));
    }
  });
});

describe("buildPlatformProfileUrl", () => {
  it("builds deterministic profile URLs per platform", () => {
    assert.equal(
      buildPlatformProfileUrl("tiktok", "@ecemdans"),
      "https://www.tiktok.com/@ecemdans"
    );
    assert.equal(
      buildPlatformProfileUrl("instagram", "ecemdans"),
      "https://www.instagram.com/ecemdans"
    );
    assert.equal(
      buildPlatformProfileUrl("youtube", "ecemdans"),
      "https://www.youtube.com/@ecemdans"
    );
  });

  it("returns null when no safe username or platform is available", () => {
    assert.equal(buildPlatformProfileUrl("tiktok", ""), null);
    assert.equal(buildPlatformProfileUrl(null, "ecemdans"), null);
    assert.equal(buildPlatformProfileUrl("tiktok", "kullanıcı adı"), null);
  });
});

describe("resolveCreatorProfileUrl", () => {
  it("prefers the stored URL", () => {
    const resolved = resolveCreatorProfileUrl({
      profileUrl: "https://www.tiktok.com/@stored",
      platform: "tiktok",
      username: "derived",
    });

    assert.equal(resolved.href, "https://www.tiktok.com/@stored");
    assert.equal(resolved.source, "stored");
  });

  it("falls back to a derived URL when the stored one is missing or unsafe", () => {
    for (const profileUrl of [null, "", "javascript:alert(1)", "not a url"]) {
      const resolved = resolveCreatorProfileUrl({
        profileUrl,
        platform: "tiktok",
        username: "ecemdans",
      });

      assert.equal(resolved.href, "https://www.tiktok.com/@ecemdans");
      assert.equal(resolved.source, "derived");
    }
  });

  it("reports no link when nothing safe can be produced", () => {
    const resolved = resolveCreatorProfileUrl({
      profileUrl: null,
      platform: null,
      username: null,
    });

    assert.equal(resolved.href, null);
    assert.equal(resolved.source, "none");
  });
});

describe("resolveVideoLink", () => {
  it("never invents a video URL", () => {
    for (const videoUrl of [null, undefined, "", "javascript:alert(1)", "nope"]) {
      assert.equal(
        resolveVideoLink({ videoUrl, platform: "tiktok" }),
        null,
        String(videoUrl)
      );
    }
  });

  it("builds a platform-specific accessible label", () => {
    assert.equal(
      resolveVideoLink({
        videoUrl: "https://www.tiktok.com/@a/video/123",
        platform: "tiktok",
      })?.label,
      "TikTok videosunu aç"
    );
    assert.equal(
      resolveVideoLink({
        videoUrl: "https://www.instagram.com/reel/abc",
        platform: "instagram",
      })?.label,
      "Instagram videosunu aç"
    );
    assert.equal(
      resolveVideoLink({
        videoUrl: "https://www.youtube.com/watch?v=abc",
        platform: "youtube",
      })?.label,
      "YouTube videosunu aç"
    );
  });
});

describe("resolveCreatorLink", () => {
  it("builds an accessible label from the handle", () => {
    assert.equal(
      resolveCreatorLink({
        profileUrl: "https://www.tiktok.com/@ecemdans",
        platform: "tiktok",
        handle: "@ecemdans",
      })?.label,
      "@ecemdans profilini aç"
    );
  });

  it("returns null when the handle cannot form a URL and none is stored", () => {
    assert.equal(
      resolveCreatorLink({ profileUrl: null, platform: "tiktok", handle: "@" }),
      null
    );
  });
});

describe("ReportCreatorLink rendering", () => {
  it("renders an external anchor when a profile URL exists", () => {
    const html = renderToStaticMarkup(
      <ReportCreatorLink
        link={resolveCreatorLink({
          profileUrl: "https://www.tiktok.com/@ecemdans",
          platform: "tiktok",
          handle: "@ecemdans",
        })}
      >
        <span>@ecemdans</span>
      </ReportCreatorLink>
    );

    assert.match(html, /<a /);
    assert.match(html, /href="https:\/\/www\.tiktok\.com\/@ecemdans"/);
    assert.match(html, /target="_blank"/);
    assert.match(html, /rel="noopener noreferrer"/);
    assert.match(html, /aria-label="@ecemdans profilini aç"/);
    assert.match(html, /@ecemdans<\/span>/);
  });

  it("renders plain non-clickable content when no profile URL exists", () => {
    const html = renderToStaticMarkup(
      <ReportCreatorLink link={null} className="flex items-center gap-3">
        <span>@ecemdans</span>
      </ReportCreatorLink>
    );

    assert.doesNotMatch(html, /<a /);
    assert.doesNotMatch(html, /href=/);
    // The layout classes survive so the row does not shift.
    assert.match(html, /class="flex items-center gap-3"/);
    assert.match(html, /@ecemdans<\/span>/);
  });
});

describe("ReportVideoLink rendering", () => {
  it("renders a semantic anchor overlay when a video URL exists", () => {
    const html = renderToStaticMarkup(
      <ReportVideoLink
        link={resolveVideoLink({
          videoUrl: "https://www.tiktok.com/@ecemdans/video/7301234567890123456",
          platform: "tiktok",
        })}
      />
    );

    assert.match(html, /^<a /);
    assert.match(
      html,
      /href="https:\/\/www\.tiktok\.com\/@ecemdans\/video\/7301234567890123456"/
    );
    assert.match(html, /aria-label="TikTok videosunu aç"/);
    assert.match(html, /rel="noopener noreferrer"/);
    // Nothing renders inside the overlay, so no anchor can ever nest in it.
    assert.match(html, /><\/a>$/);
  });

  it("renders nothing when the video URL is missing, leaving media inert", () => {
    const html = renderToStaticMarkup(
      <ReportVideoLink link={resolveVideoLink({ videoUrl: null })} />
    );

    assert.equal(html, "");
  });
});

describe("content card link composition", () => {
  const creatorLink = resolveCreatorLink({
    profileUrl: "https://www.tiktok.com/@ecemdans",
    platform: "tiktok",
    handle: "@ecemdans",
  });
  const videoLink = resolveVideoLink({
    videoUrl: "https://www.tiktok.com/@ecemdans/video/7301234567890123456",
    platform: "tiktok",
  });

  /** Mirrors how the gallery card composes its creator header and media area. */
  function renderCard() {
    return renderToStaticMarkup(
      <article>
        <ReportCreatorLink link={creatorLink} className="flex items-center gap-3">
          <span>@ecemdans</span>
          {creatorLink && <ReportExternalLinkIcon />}
        </ReportCreatorLink>
        <div className="relative aspect-[9/16]">
          <div className="absolute top-3 left-3">TikTok</div>
          <ReportVideoLink link={videoLink} />
        </div>
      </article>
    );
  }

  it("produces exactly one profile anchor and one video anchor", () => {
    const { count } = inspectAnchors(renderCard());
    assert.equal(count, 2);
  });

  it("never nests one anchor inside another", () => {
    const { hasNestedAnchor } = inspectAnchors(renderCard());
    assert.equal(hasNestedAnchor, false);
  });

  it("hides the interactive-only icon in print without touching the anchor", () => {
    const html = renderCard();
    assert.match(html, /print:hidden/);
    assert.match(html, /screen-only/);
    assert.doesNotMatch(html, /<a[^>]*print:hidden/);
  });
});

describe("print request policy", () => {
  it("allows the same-origin print document", () => {
    assert.equal(
      decidePrintRequest({
        url: `${APP_ORIGIN}/campaigns/abc/reports/def/print?token=x`,
        resourceType: "document",
        isNavigationRequest: true,
        appOrigin: APP_ORIGIN,
      }),
      "continue"
    );
  });

  it("never navigates to an external social link during generation", () => {
    for (const url of [
      "https://www.tiktok.com/@ecemdans",
      "https://www.tiktok.com/@ecemdans/video/7301234567890123456",
      "https://www.instagram.com/ecemdans",
      "https://www.youtube.com/@ecemdans",
    ]) {
      assert.equal(
        decidePrintRequest({
          url,
          resourceType: "document",
          isNavigationRequest: true,
          appOrigin: APP_ORIGIN,
        }),
        "abort",
        url
      );
    }
  });

  it("allows thumbnails and avatars from provider CDN hosts", () => {
    for (const url of [
      "https://p16-sign-va.tiktokcdn.com/obj/tos-maliva-p-0068/abc~tplv-photomode.jpeg",
      "https://p77-sign-va-lite.tiktokcdn-us.com/obj/def",
      "https://scontent.cdninstagram.com/v/t51/ghi.jpg",
    ]) {
      assert.equal(
        decidePrintRequest({
          url,
          resourceType: "image",
          isNavigationRequest: false,
          appOrigin: APP_ORIGIN,
        }),
        "continue",
        url
      );
    }
  });

  it("allows same-origin fonts, scripts and styles", () => {
    for (const resourceType of ["font", "script", "stylesheet"]) {
      assert.equal(
        decidePrintRequest({
          url: `${APP_ORIGIN}/_next/static/asset`,
          resourceType,
          isNavigationRequest: false,
          appOrigin: APP_ORIGIN,
        }),
        "continue",
        resourceType
      );
    }
  });

  it("blocks third-party scripts and stylesheets", () => {
    for (const resourceType of ["script", "stylesheet", "xhr", "websocket"]) {
      assert.equal(
        decidePrintRequest({
          url: "https://evil.example/payload",
          resourceType,
          isNavigationRequest: false,
          appOrigin: APP_ORIGIN,
        }),
        "abort",
        resourceType
      );
    }
  });
});

describe("thumbnail fallback", () => {
  it("uses the real thumbnail when the URL is valid and has not failed", () => {
    assert.equal(
      shouldUseMediaFallback("https://p16-sign-va.tiktokcdn.com/a.jpeg", null),
      false
    );
  });

  it("falls back as soon as a thumbnail fails to load", () => {
    const src = "https://p16-sign-va.tiktokcdn.com/expired.jpeg";
    assert.equal(shouldUseMediaFallback(src, src), true);
  });

  it("does not retry a URL that already failed", () => {
    const expired = "https://p16-sign-va.tiktokcdn.com/expired.jpeg";
    // Repeated evaluations during one render keep returning the fallback.
    assert.equal(shouldUseMediaFallback(expired, expired), true);
    assert.equal(shouldUseMediaFallback(expired, expired), true);
  });

  it("retries when a genuinely different URL arrives after a sync", () => {
    assert.equal(
      shouldUseMediaFallback(
        "https://p16-sign-va.tiktokcdn.com/refreshed.jpeg",
        "https://p16-sign-va.tiktokcdn.com/expired.jpeg"
      ),
      false
    );
  });

  it("falls back for missing or placeholder sources", () => {
    for (const src of ["", "   ", "#", "undefined", "null", null, undefined]) {
      assert.equal(shouldUseMediaFallback(src, null), true, String(src));
    }
  });

  it("rejects unsafe image schemes for report media", () => {
    assert.equal(isValidImageSrc("javascript:alert(1)"), false);
    assert.equal(isValidImageSrc("data:image/png;base64,aaa"), false);
  });
});

describe("ReportVideoThumbnail rendering", () => {
  const thumb = "https://p16-sign-va.tiktokcdn.com/thumb.jpeg";

  it("renders the real thumbnail image when the URL is valid", () => {
    const html = renderToStaticMarkup(
      <ReportVideoThumbnail
        src={thumb}
        seed="video-1"
        name="Ecem Dans"
        username="@ecemdans"
      />
    );

    assert.match(html, /data-report-video-thumbnail="image"/);
    assert.match(html, /p16-sign-va\.tiktokcdn\.com/);
    assert.doesNotMatch(html, /unsplash/i);
  });

  it("renders the branded fallback when the source is missing", () => {
    const html = renderToStaticMarkup(
      <ReportVideoThumbnail
        src=""
        seed="video-1"
        name="Ecem Dans"
        username="@ecemdans"
        platform="tiktok"
      />
    );

    assert.match(html, /data-report-video-thumbnail="fallback"/);
    assert.match(html, /BF/);
    assert.doesNotMatch(html, /unsplash/i);
  });

  it("keeps the video anchor clickable when the gallery card uses a fallback", () => {
    const video = buildReportFixture().videos[0];
    const html = renderToStaticMarkup(
      <TikTokContentCard
        video={{ ...video, thumbnail: "" }}
        campaignAverageEngagement={5}
      />
    );

    assert.match(html, /aspect-\[9\/16\]/);
    assert.match(html, /href="https:\/\/www\.tiktok\.com\/@ecemdans\/video\//);
    assert.match(html, /TikTok videosunu aç/);
    assert.doesNotMatch(html, /unsplash/i);
  });

  it("keeps featured media on the snapshot thumbnail URL only", () => {
    const video = buildReportFixture().featuredVideo!;
    const html = renderToStaticMarkup(
      <FeaturedContentMedia video={video} />
    );

    assert.match(html, /p16-sign-va\.tiktokcdn\.com\/thumb\.jpeg/);
    assert.doesNotMatch(html, /unsplash/i);
  });
});

const SNAPSHOT_CONTEXT = {
  reportId: "report-1",
  reportNumber: "RPT-2026-0047",
  sourceLastSyncedAt: "2026-08-05T10:00:00.000Z",
  versionNumber: 2,
  reportVersionId: "66666666-7777-4888-8999-aaaaaaaaaaaa",
  generatedAt: "2026-08-05T12:00:00.000Z",
  generatedBy: "user-1",
};

function buildReportFixture(): CampaignReportData {
  const video = {
    id: "video-1",
    title: "Dans videosu",
    creatorHandle: "@ecemdans",
    creatorName: "Ecem Dans",
    creatorAvatar: "https://p16-sign-va.tiktokcdn.com/avatar.jpeg",
    thumbnail: "https://p16-sign-va.tiktokcdn.com/thumb.jpeg",
    platform: "tiktok" as const,
    views: 120_000,
    likes: 9_000,
    comments: 400,
    shares: 250,
    saves: 600,
    engagementRate: 8.5,
    publishedAt: "2026-07-20T09:00:00.000Z",
    url: "https://www.tiktok.com/@ecemdans/video/7301234567890123456",
    category: "micro" as const,
    hasMetrics: true,
    creatorProfileUrl: "https://www.tiktok.com/@ecemdans",
  };

  const creator = {
    id: "creator-1",
    rank: 1,
    handle: "@ecemdans",
    displayName: "Ecem Dans",
    avatar: "https://p16-sign-va.tiktokcdn.com/avatar.jpeg",
    followers: 84_000,
    videos: 1,
    views: 120_000,
    engagement: 10_250,
    engagementRate: 8.5,
    category: "micro" as const,
    platform: "tiktok" as const,
    profileUrl: "https://www.tiktok.com/@ecemdans",
  };

  return {
    campaign: {
      id: "campaign-1",
      name: "Midnight Drive",
      artist: "Artist",
      track: "Midnight Drive",
      client: "Label",
      status: "active",
      startDate: "2026-07-01",
      endDate: "2026-08-01",
      soundUrl: "https://www.tiktok.com/music/midnight-drive-123",
      coverColor: "#1e1b4b",
    },
    totalReach: {
      value: 120_000,
      previousValue: 0,
      label: "Toplam Erişim",
      growthSinceStart: null,
    },
    summary: { headline: "Özet", paragraphs: ["Paragraf"] },
    kpis: [
      {
        id: "engagement-rate",
        label: "Avg. Engagement Rate",
        value: 8.5,
        previousValue: 0,
        format: "percent",
      },
    ],
    trend: [],
    growth: [],
    platforms: [],
    topVideo: video,
    creators: [creator],
    videos: [video],
    soundGrowth: {
      soundName: "Midnight Drive",
      initialUses: 0,
      currentUses: 0,
      multiplier: 0,
      timeline: [],
    },
    metadata: {
      reportNumber: "RPT-2026-0047",
      reportDate: "5 Ağustos 2026",
      hasReportRecord: true,
      freshness: {
        lastSuccessfulSyncAt: "2026-08-05T10:00:00.000Z",
        videosWithoutMetrics: 0,
        staleVideoCount: 0,
      },
    },
    featuredVideo: video,
    hasTimeline: false,
    hasSoundTimeline: false,
  };
}

describe("snapshot compatibility", () => {
  it("preserves creator and video link fields in a new snapshot", () => {
    const snapshot = serializeReportSnapshot(
      buildReportFixture(),
      SNAPSHOT_CONTEXT
    );

    assert.equal(
      snapshot.data.creators[0].profileUrl,
      "https://www.tiktok.com/@ecemdans"
    );
    assert.equal(snapshot.data.creators[0].platform, "tiktok");
    assert.equal(
      snapshot.data.videos[0].creatorProfileUrl,
      "https://www.tiktok.com/@ecemdans"
    );
    assert.equal(
      snapshot.data.videos[0].url,
      "https://www.tiktok.com/@ecemdans/video/7301234567890123456"
    );
  });

  it("freezes the thumbnail URL available at generation time", () => {
    const snapshot = serializeReportSnapshot(
      buildReportFixture(),
      SNAPSHOT_CONTEXT
    );

    assert.equal(
      snapshot.data.videos[0].thumbnail,
      "https://p16-sign-va.tiktokcdn.com/thumb.jpeg"
    );
    assert.equal(
      snapshot.data.featuredVideo?.thumbnail,
      "https://p16-sign-va.tiktokcdn.com/thumb.jpeg"
    );
  });

  it("still validates an old snapshot without a thumbnail URL", () => {
    const snapshot = serializeReportSnapshot(
      buildReportFixture(),
      SNAPSHOT_CONTEXT
    );
    const legacy = JSON.parse(JSON.stringify(snapshot)) as {
      data: {
        videos: Array<{ thumbnail?: string }>;
        featuredVideo?: { thumbnail?: string } | null;
        topVideo?: { thumbnail?: string } | null;
      };
    };

    legacy.data.videos[0].thumbnail = "";
    if (legacy.data.featuredVideo) {
      legacy.data.featuredVideo.thumbnail = "";
    }
    if (legacy.data.topVideo) {
      legacy.data.topVideo.thumbnail = "";
    }

    const parsed = reportSnapshotSchema.safeParse(legacy);
    assert.equal(parsed.success, true);
  });

  it("still validates a historical snapshot created before link fields existed", () => {
    const snapshot = serializeReportSnapshot(
      buildReportFixture(),
      SNAPSHOT_CONTEXT
    );

    // Reproduce a pre-Phase-9 snapshot by removing the fields entirely.
    const legacy = JSON.parse(JSON.stringify(snapshot)) as Record<
      string,
      unknown
    > & { data: { creators: Record<string, unknown>[]; videos: Record<string, unknown>[] } };

    for (const creator of legacy.data.creators) {
      delete creator.platform;
      delete creator.profileUrl;
    }

    for (const video of legacy.data.videos) {
      delete video.creatorProfileUrl;
    }

    delete (legacy.data as { topVideo?: Record<string, unknown> }).topVideo
      ?.creatorProfileUrl;
    delete (legacy.data as { featuredVideo?: Record<string, unknown> })
      .featuredVideo?.creatorProfileUrl;

    const parsed = reportSnapshotSchema.safeParse(legacy);

    assert.equal(parsed.success, true);
  });

  it("renders a legacy creator without a link rather than guessing from an id", () => {
    // A legacy snapshot has no platform or profileUrl, but it does have a
    // handle, so the deterministic fallback still applies.
    const link = resolveCreatorLink({
      profileUrl: undefined,
      platform: undefined,
      handle: "@ecemdans",
    });

    assert.equal(link?.href, "https://www.tiktok.com/@ecemdans");
  });

  it("keeps the snapshot schema version unchanged", () => {
    const snapshot = serializeReportSnapshot(
      buildReportFixture(),
      SNAPSHOT_CONTEXT
    );

    assert.equal(snapshot.snapshotSchemaVersion, 1);
  });
});

describe("print stylesheet", () => {
  const css = readFileSync("app/globals.css", "utf8");

  it("keeps anchors rendered in the PDF document", () => {
    const anchorRule = css.match(/\.pdf-document a \{[^}]*\}/)?.[0] ?? "";

    assert.notEqual(anchorRule, "");
    assert.doesNotMatch(anchorRule, /display:\s*none/);
  });

  it("does not disable pointer events globally when printing", () => {
    // PDF must not globally kill pointer events on anchors. Touch preview may
    // disable the featured bleed overlay on screen without !important.
    assert.doesNotMatch(
      css,
      /\.pdf-document[^{;]*a[^{]*\{[^}]*pointer-events:\s*none/
    );
    assert.doesNotMatch(
      css,
      /\.pdf-document\s+\*\s*\{[^}]*pointer-events:\s*none\s*!important/
    );
  });
});
