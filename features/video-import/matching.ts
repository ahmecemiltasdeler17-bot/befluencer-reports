import { VIDEO_IMPORT_MESSAGES } from "@/features/video-import/constants";
import type {
  VideoImportCreatorStatus,
  VideoImportPreviewRow,
  VideoImportVideoStatus,
} from "@/features/video-import/types";
import { buildTikTokProfileUrl } from "@/lib/providers/tiktok/profile-url";

export type ExistingCreatorIdentity = {
  id: string;
  username: string;
  profile_url: string | null;
};

export type ExistingVideoIdentity = {
  id: string;
  campaign_id: string;
  video_url: string;
  platform_video_id: string | null;
};

/**
 * Strict identity match — never by display name.
 * Priority: normalized username → exact canonical profile URL.
 * (No platform user id is stored in schema.)
 */
export function matchCreatorByIdentity(
  username: string | null | undefined,
  profileUrl: string | null | undefined,
  existing: ExistingCreatorIdentity[]
): ExistingCreatorIdentity | null {
  const normalizedUsername = normalizeHandle(username);

  if (normalizedUsername) {
    const byUsername = existing.find(
      (row) => normalizeHandle(row.username) === normalizedUsername
    );
    if (byUsername) {
      return byUsername;
    }
  }

  const candidates = [
    profileUrl?.trim() || null,
    normalizedUsername ? buildTikTokProfileUrl(normalizedUsername) : null,
  ].filter((value): value is string => Boolean(value));

  for (const canonical of candidates) {
    const byUrl = existing.find((row) => {
      const stored = row.profile_url?.trim();
      if (!stored) {
        return false;
      }
      return (
        stored === canonical ||
        stored.toLowerCase() === canonical.toLowerCase()
      );
    });
    if (byUrl) {
      return byUrl;
    }
  }

  return null;
}

export function normalizeHandle(
  value: string | null | undefined
): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim().replace(/^@+/, "").toLowerCase();
  if (!trimmed || !/^[a-z0-9._]{1,24}$/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

export function resolveDuplicateVideoStatus(
  campaignId: string,
  normalizedUrl: string,
  platformVideoId: string | null,
  existingVideos: ExistingVideoIdentity[]
): {
  videoStatus: Extract<
    VideoImportVideoStatus,
    "already_in_campaign" | "exists_elsewhere"
  > | null;
  message: string | null;
} {
  const byUrl = existingVideos.find((row) => row.video_url === normalizedUrl);
  if (byUrl) {
    if (byUrl.campaign_id === campaignId) {
      return {
        videoStatus: "already_in_campaign",
        message: VIDEO_IMPORT_MESSAGES.already_in_campaign,
      };
    }
    return {
      videoStatus: "exists_elsewhere",
      message: VIDEO_IMPORT_MESSAGES.exists_elsewhere,
    };
  }

  if (platformVideoId) {
    const byId = existingVideos.find(
      (row) =>
        row.platform_video_id != null &&
        row.platform_video_id === platformVideoId
    );
    if (byId) {
      if (byId.campaign_id === campaignId) {
        return {
          videoStatus: "already_in_campaign",
          message: VIDEO_IMPORT_MESSAGES.already_in_campaign,
        };
      }
      return {
        videoStatus: "exists_elsewhere",
        message: VIDEO_IMPORT_MESSAGES.exists_elsewhere,
      };
    }
  }

  return { videoStatus: null, message: null };
}

export function buildPreviewRow(input: {
  rowKey: string;
  originalUrl: string;
  normalizedUrl: string;
  platformVideoId: string | null;
  thumbnailUrl: string | null;
  caption: string | null;
  publishedAt: string | null;
  creatorUsername: string | null;
  creatorDisplayName: string | null;
  creatorAvatarUrl: string | null;
  creatorFollowerCount: number | null;
  creatorProfileUrl: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  matchedCreator: ExistingCreatorIdentity | null;
  /** Pre-set terminal video statuses (invalid / provider / duplicate). */
  forcedVideoStatus?: VideoImportVideoStatus | null;
  forcedMessage?: string | null;
}): VideoImportPreviewRow {
  const handle = normalizeHandle(input.creatorUsername);
  let videoStatus: VideoImportVideoStatus =
    input.forcedVideoStatus ?? "importable";
  let message = input.forcedMessage ?? null;
  let creatorStatus: VideoImportCreatorStatus = "none";
  let matchedCreatorId: string | null = null;

  if (
    videoStatus === "invalid_url" ||
    videoStatus === "provider_empty" ||
    videoStatus === "login_required_content" ||
    videoStatus === "already_in_campaign" ||
    videoStatus === "exists_elsewhere"
  ) {
    if (input.matchedCreator) {
      creatorStatus = "matched_existing";
      matchedCreatorId = input.matchedCreator.id;
    } else if (handle) {
      creatorStatus = "will_create";
    }
  } else if (!handle) {
    videoStatus = "creator_unverified";
    creatorStatus = "manual_required";
    message = VIDEO_IMPORT_MESSAGES.creator_unverified;
  } else if (input.matchedCreator) {
    creatorStatus = "matched_existing";
    matchedCreatorId = input.matchedCreator.id;
    videoStatus = "importable";
  } else {
    creatorStatus = "will_create";
    videoStatus = "importable";
  }

  const selectable =
    videoStatus === "importable" ||
    (videoStatus === "creator_unverified" &&
      creatorStatus === "manual_required");

  return {
    rowKey: input.rowKey,
    originalUrl: input.originalUrl,
    normalizedUrl: input.normalizedUrl,
    platformVideoId: input.platformVideoId,
    thumbnailUrl: input.thumbnailUrl,
    caption: input.caption,
    publishedAt: input.publishedAt,
    creatorUsername: handle,
    creatorDisplayName: input.creatorDisplayName,
    creatorAvatarUrl: input.creatorAvatarUrl,
    creatorFollowerCount: input.creatorFollowerCount,
    creatorProfileUrl:
      input.creatorProfileUrl ??
      (handle ? buildTikTokProfileUrl(handle) : null),
    matchedCreatorId,
    creatorStatus,
    videoStatus,
    message,
    selectable,
    views: input.views,
    likes: input.likes,
    comments: input.comments,
    shares: input.shares,
    saves: input.saves,
  };
}
