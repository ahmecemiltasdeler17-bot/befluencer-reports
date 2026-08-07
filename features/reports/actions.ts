"use server";

import { revalidatePath } from "next/cache";

import { getOrCreateReportSeries } from "@/features/report-generation/queries";

export type EnsureReportState = {
  error?: string;
  success?: string;
};

export async function ensureCampaignReport(
  campaignId: string
): Promise<EnsureReportState> {
  try {
    await getOrCreateReportSeries(campaignId);
  } catch {
    return { error: "Rapor kaydı oluşturulamadı. Lütfen tekrar deneyin." };
  }

  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath(`/campaigns/${campaignId}/report`);
  revalidatePath(`/campaigns/${campaignId}/reports`);

  return { success: "Rapor kaydı oluşturuldu." };
}
