export const VIDEO_PLATFORMS = ["tiktok", "instagram", "youtube"] as const;

/** Application-facing video lifecycle states. */
export const VIDEO_STATUSES = ["draft", "published", "removed"] as const;

/** Maps UI status values to the existing videos.status check constraint. */
export const VIDEO_STATUS_TO_DB = {
  draft: "pending",
  published: "published",
  removed: "unavailable",
} as const satisfies Record<
  (typeof VIDEO_STATUSES)[number],
  "pending" | "published" | "unavailable"
>;

/** Maps database status values back to UI status values. */
export const VIDEO_STATUS_FROM_DB = {
  pending: "draft",
  published: "published",
  unavailable: "removed",
} as const satisfies Record<
  "pending" | "published" | "unavailable",
  (typeof VIDEO_STATUSES)[number]
>;

export type VideoPlatform = (typeof VIDEO_PLATFORMS)[number];
export type VideoStatus = (typeof VIDEO_STATUSES)[number];
export type VideoDbStatus = keyof typeof VIDEO_STATUS_FROM_DB;
export type VideoSyncStatus = "pending" | "success" | "failed";

export type Video = {
  id: string;
  campaign_id: string;
  creator_id: string;
  platform: VideoPlatform;
  video_url: string;
  platform_video_id: string | null;
  thumbnail_url: string | null;
  /** Public Storage URL for optional manual MP4/WebM preview. */
  preview_media_url?: string | null;
  preview_media_type?: string | null;
  caption: string | null;
  published_at: string | null;
  status: VideoDbStatus;
  last_synced_at: string | null;
  sync_status: VideoSyncStatus;
  created_at: string;
  updated_at: string;
};

export type VideoPreviewActionState = {
  error?: string;
  success?: boolean;
};

export type VideoWithCreator = Video & {
  creator: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    platform: VideoPlatform;
  };
};

export type VideoWithRelations = VideoWithCreator & {
  campaign: {
    id: string;
    name: string;
  };
};

export type VideoFormValues = {
  creator_id: string;
  platform: VideoPlatform;
  video_url: string;
  platform_video_id: string;
  caption: string;
  published_at: string;
  status: VideoStatus;
};

export type VideoFormState = {
  error?: string;
  fieldErrors?: Partial<Record<keyof VideoFormValues, string>>;
  values?: VideoFormValues;
};

export type VideosByCreator = {
  creator: VideoWithCreator["creator"];
  videos: VideoWithCreator[];
};
