import type { CreatorCategory } from "@/lib/types";

export const CREATOR_CATEGORY_LABELS: Record<CreatorCategory, string> = {
  mega: "Mega İçerik Üreticisi",
  macro: "Makro İçerik Üreticisi",
  micro: "Mikro İçerik Üreticisi",
  nano: "Nano İçerik Üreticisi",
  template: "Şablon / Konsept İçeriği",
  uncategorized: "Kategorisiz",
};

/** Same taxonomy, short form — for dense rows where the full label wraps. */
export const CREATOR_CATEGORY_SHORT_LABELS: Record<CreatorCategory, string> = {
  mega: "Mega",
  macro: "Makro",
  micro: "Mikro",
  nano: "Nano",
  template: "Şablon",
  uncategorized: "Kategorisiz",
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
