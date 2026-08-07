import { resolveCreatorProfileUrl } from "@/lib/report-links/build-platform-profile-url";
import { normalizeSocialUrl } from "@/lib/report-links/normalize-social-url";
import type { Platform, ReportLinkOrNull } from "@/lib/report-links/types";
import { PLATFORM_LABELS } from "@/lib/content-helpers";

export function buildProfileLinkLabel(handle: string): string {
  const withAt = handle.startsWith("@") ? handle : `@${handle}`;
  return `${withAt} profilini aç`;
}

export function buildVideoLinkLabel(platform: Platform): string {
  return `${PLATFORM_LABELS[platform]} videosunu aç`;
}

/**
 * Resolves the profile link for a report creator. Falls back to a deterministic
 * platform URL when the snapshot has no stored profile URL.
 */
export function resolveCreatorLink(input: {
  profileUrl?: string | null;
  platform?: Platform | null;
  handle: string;
}): ReportLinkOrNull {
  const platform = input.platform ?? "tiktok";
  const { href } = resolveCreatorProfileUrl({
    profileUrl: input.profileUrl,
    platform,
    username: input.handle,
  });

  if (!href) {
    return null;
  }

  return {
    href,
    kind: "profile",
    platform,
    label: buildProfileLinkLabel(input.handle),
  };
}

/**
 * Resolves the link for a report video. A video URL is never invented: if the
 * snapshot has no safe URL the media stays non-clickable.
 */
export function resolveVideoLink(input: {
  videoUrl?: string | null;
  platform?: Platform | null;
}): ReportLinkOrNull {
  const platform = input.platform ?? "tiktok";
  const href = normalizeSocialUrl(input.videoUrl, platform);

  if (!href) {
    return null;
  }

  return {
    href,
    kind: "video",
    platform,
    label: buildVideoLinkLabel(platform),
  };
}
