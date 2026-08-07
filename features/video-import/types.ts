import type {
  VIDEO_IMPORT_CREATOR_STATUS_LABELS,
  VIDEO_IMPORT_VIDEO_STATUS_LABELS,
} from "@/features/video-import/constants";

export type VideoImportCreatorStatus =
  keyof typeof VIDEO_IMPORT_CREATOR_STATUS_LABELS;

export type VideoImportVideoStatus =
  keyof typeof VIDEO_IMPORT_VIDEO_STATUS_LABELS;

export type VideoImportParsedUrl = {
  originalUrl: string;
  normalizedUrl: string;
  platformVideoId: string | null;
  isShortUrl: boolean;
};

export type VideoImportPreviewRow = {
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
  matchedCreatorId: string | null;
  creatorStatus: VideoImportCreatorStatus;
  videoStatus: VideoImportVideoStatus;
  message: string | null;
  /** Default include when status is importable (and creator resolved or will create). */
  selectable: boolean;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
};

export type VideoImportPreviewResult = {
  error?: string;
  rows?: VideoImportPreviewRow[];
  urlCount?: number;
  skippedEmptyLines?: number;
  dedupedCount?: number;
};

export type VideoImportCommitRowInput = {
  rowKey: string;
  normalizedUrl: string;
  originalUrl: string;
  platformVideoId: string | null;
  thumbnailUrl: string | null;
  caption: string | null;
  publishedAt: string | null;
  creatorUsername: string | null;
  creatorDisplayName: string | null;
  creatorAvatarUrl: string | null;
  creatorFollowerCount: number | null;
  creatorProfileUrl: string | null;
  matchedCreatorId: string | null;
  manualCreatorId?: string | null;
  views?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  saves?: number | null;
};

export type VideoImportCommitRowResult = {
  rowKey: string;
  normalizedUrl: string;
  ok: boolean;
  outcome:
    | "added"
    | "already_in_campaign"
    | "exists_elsewhere"
    | "failed"
    | "skipped";
  message: string;
  videoId?: string;
  creatorId?: string;
  createdCreator?: boolean;
  matchedCreator?: boolean;
};

export type VideoImportCommitSummary = {
  totalSubmitted: number;
  addedVideos: number;
  linkedExistingVideos: number;
  skippedDuplicates: number;
  createdCreators: number;
  matchedCreators: number;
  failedRows: number;
};

export type VideoImportCommitResult = {
  error?: string;
  summary?: VideoImportCommitSummary;
  rows?: VideoImportCommitRowResult[];
};

export type ManualCreatorOption = {
  id: string;
  username: string;
  display_name: string | null;
};
