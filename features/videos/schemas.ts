import { z } from "zod";

import {
  VIDEO_PLATFORMS,
  VIDEO_STATUSES,
  VIDEO_STATUS_FROM_DB,
  VIDEO_STATUS_TO_DB,
  type Video,
  type VideoFormValues,
  type VideoStatus,
} from "@/features/videos/types";

const optionalText = z
  .string()
  .transform((value) => value.trim())
  .transform((value) => (value.length === 0 ? null : value));

export const videoFormSchema = z.object({
  creator_id: z
    .string({ error: "İçerik üreticisi seçimi gereklidir." })
    .uuid("Geçerli bir içerik üreticisi seçin."),
  platform: z.enum(VIDEO_PLATFORMS, {
    error: "Geçerli bir platform seçin.",
  }),
  video_url: z
    .string({ error: "Video URL gereklidir." })
    .trim()
    .min(1, "Video URL gereklidir.")
    .url("Geçerli bir http(s) URL girin.")
    .refine(
      (value) => /^https?:\/\/.+/i.test(value),
      "Geçerli bir http(s) URL girin."
    ),
  platform_video_id: optionalText,
  caption: optionalText.pipe(
    z
      .string()
      .max(5000, "Açıklama en fazla 5000 karakter olabilir.")
      .nullable()
  ),
  published_at: z
    .string({ error: "Yayın tarihi gereklidir." })
    .trim()
    .min(1, "Yayın tarihi gereklidir.")
    .refine((value) => !Number.isNaN(Date.parse(value)), {
      message: "Geçerli bir yayın tarihi girin.",
    }),
  status: z.enum(VIDEO_STATUSES, {
    error: "Geçerli bir durum seçin.",
  }),
});

export type VideoFormInput = z.infer<typeof videoFormSchema>;

export function parseVideoFormData(formData: FormData) {
  return {
    creator_id: String(formData.get("creator_id") ?? ""),
    platform: String(formData.get("platform") ?? "tiktok"),
    video_url: String(formData.get("video_url") ?? ""),
    platform_video_id: String(formData.get("platform_video_id") ?? ""),
    caption: String(formData.get("caption") ?? ""),
    published_at: String(formData.get("published_at") ?? ""),
    status: String(formData.get("status") ?? "draft"),
  };
}

export function toVideoFormValues(input: VideoFormInput): VideoFormValues {
  return {
    creator_id: input.creator_id,
    platform: input.platform,
    video_url: input.video_url,
    platform_video_id: input.platform_video_id ?? "",
    caption: input.caption ?? "",
    published_at: toDatetimeLocalValue(input.published_at),
    status: input.status,
  };
}

export function videoToFormValues(video: Video): VideoFormValues {
  return {
    creator_id: video.creator_id,
    platform: video.platform,
    video_url: video.video_url,
    platform_video_id: video.platform_video_id ?? "",
    caption: video.caption ?? "",
    published_at: video.published_at
      ? toDatetimeLocalValue(video.published_at)
      : "",
    status: VIDEO_STATUS_FROM_DB[video.status],
  };
}

export function statusToDb(status: VideoStatus): Video["status"] {
  return VIDEO_STATUS_TO_DB[status];
}

export function toIsoTimestamp(datetimeLocal: string): string {
  return new Date(datetimeLocal).toISOString();
}

function toDatetimeLocalValue(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function groupVideosByCreator(
  videos: import("@/features/videos/types").VideoWithCreator[]
): import("@/features/videos/types").VideosByCreator[] {
  const groups = new Map<string, import("@/features/videos/types").VideosByCreator>();

  for (const video of videos) {
    const existing = groups.get(video.creator_id);

    if (existing) {
      existing.videos.push(video);
      continue;
    }

    groups.set(video.creator_id, {
      creator: video.creator,
      videos: [video],
    });
  }

  return Array.from(groups.values());
}
