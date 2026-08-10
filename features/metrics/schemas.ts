import { z } from "zod";

import type {
  ClusterSoundMetricFormValues,
  SoundMetricFormValues,
  VideoMetricFormValues,
} from "@/features/metrics/types";

const metricCount = (label: string) =>
  z.coerce
    .number({ error: `${label} gereklidir.` })
    .int(`${label} tam sayı olmalıdır.`)
    .min(0, `${label} 0 veya daha büyük olmalıdır.`);

export const videoMetricFormSchema = z.object({
  views: metricCount("İzlenme"),
  likes: metricCount("Beğeni"),
  comments: metricCount("Yorum"),
  shares: metricCount("Paylaşım"),
  saves: metricCount("Kaydetme"),
  captured_at: z
    .string({ error: "Yakalanma zamanı gereklidir." })
    .trim()
    .min(1, "Yakalanma zamanı gereklidir.")
    .refine((value) => !Number.isNaN(Date.parse(value)), {
      message: "Geçerli bir tarih ve saat girin.",
    }),
});

export const soundMetricFormSchema = z.object({
  usage_count: metricCount("Kullanım sayısı"),
  captured_at: z
    .string({ error: "Yakalanma zamanı gereklidir." })
    .trim()
    .min(1, "Yakalanma zamanı gereklidir.")
    .refine((value) => !Number.isNaN(Date.parse(value)), {
      message: "Geçerli bir tarih ve saat girin.",
    }),
});

export const clusterSoundMetricFormSchema = z.object({
  usage_count: metricCount("Toplam ses kullanımı"),
  captured_at: z
    .string({ error: "Ölçüm zamanı gereklidir." })
    .trim()
    .min(1, "Ölçüm zamanı gereklidir.")
    .refine((value) => !Number.isNaN(Date.parse(value)), {
      message: "Geçerli bir tarih ve saat girin.",
    }),
  note: z.string().trim().max(500, "Not en fazla 500 karakter olabilir."),
});

export type VideoMetricFormInput = z.infer<typeof videoMetricFormSchema>;
export type SoundMetricFormInput = z.infer<typeof soundMetricFormSchema>;
export type ClusterSoundMetricFormInput = z.infer<
  typeof clusterSoundMetricFormSchema
>;

export function parseVideoMetricFormData(formData: FormData) {
  return {
    views: String(formData.get("views") ?? "0"),
    likes: String(formData.get("likes") ?? "0"),
    comments: String(formData.get("comments") ?? "0"),
    shares: String(formData.get("shares") ?? "0"),
    saves: String(formData.get("saves") ?? "0"),
    captured_at: String(formData.get("captured_at") ?? ""),
  };
}

export function parseSoundMetricFormData(formData: FormData) {
  return {
    usage_count: String(formData.get("usage_count") ?? "0"),
    captured_at: String(formData.get("captured_at") ?? ""),
  };
}

export function parseClusterSoundMetricFormData(formData: FormData) {
  return {
    usage_count: String(formData.get("usage_count") ?? ""),
    captured_at: String(formData.get("captured_at") ?? ""),
    note: String(formData.get("note") ?? ""),
  };
}

export function toVideoMetricFormValues(
  input: VideoMetricFormInput
): VideoMetricFormValues {
  return {
    views: String(input.views),
    likes: String(input.likes),
    comments: String(input.comments),
    shares: String(input.shares),
    saves: String(input.saves),
    captured_at: toDatetimeLocalValue(input.captured_at),
  };
}

export function toSoundMetricFormValues(
  input: SoundMetricFormInput
): SoundMetricFormValues {
  return {
    usage_count: String(input.usage_count),
    captured_at: toDatetimeLocalValue(input.captured_at),
  };
}

export function toClusterSoundMetricFormValues(
  input: ClusterSoundMetricFormInput
): ClusterSoundMetricFormValues {
  return {
    usage_count: String(input.usage_count),
    captured_at: toDatetimeLocalValue(input.captured_at),
    note: input.note ?? "",
  };
}

export function defaultClusterSoundMetricFormValues(): ClusterSoundMetricFormValues {
  return {
    usage_count: "",
    captured_at: toDatetimeLocalValue(new Date().toISOString()),
    note: "",
  };
}

export function defaultVideoMetricFormValues(): VideoMetricFormValues {
  return {
    views: "0",
    likes: "0",
    comments: "0",
    shares: "0",
    saves: "0",
    captured_at: toDatetimeLocalValue(new Date().toISOString()),
  };
}

export function defaultSoundMetricFormValues(): SoundMetricFormValues {
  return {
    usage_count: "0",
    captured_at: toDatetimeLocalValue(new Date().toISOString()),
  };
}

export function toIsoTimestamp(datetimeLocal: string): string {
  return new Date(datetimeLocal).toISOString();
}

function toDatetimeLocalValue(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function engagementExceedsViewsWarning(input: VideoMetricFormInput): string | undefined {
  const engagement = input.likes + input.comments + input.shares + input.saves;

  if (engagement > input.views) {
    return "Beğeni, yorum, paylaşım ve kaydetme toplamı izlenmeyi aşıyor.";
  }

  return undefined;
}
