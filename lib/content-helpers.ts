import type { CreatorCategory } from "@/lib/types";

export const CREATOR_CATEGORY_LABELS: Record<CreatorCategory, string> = {
  macro: "Makro İçerik Üreticisi",
  micro: "Mikro İçerik Üreticisi",
  template: "Şablon / Konsept İçeriği",
};

export const PLATFORM_LABELS = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
} as const;

export function estimateSaves(likes: number): number {
  return Math.round(likes * 0.068);
}

export function engagementVsCampaignAverage(
  rate: number,
  campaignAverage: number
): number {
  if (campaignAverage === 0) return 0;
  return ((rate - campaignAverage) / campaignAverage) * 100;
}
