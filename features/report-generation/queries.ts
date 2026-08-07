import { notFound } from "next/navigation";

import { mapReportVersionSummary } from "@/features/report-generation/calculations";
import type {
  CampaignReportSeriesSummary,
  ReportSeries,
  ReportVersionRow,
} from "@/features/report-generation/types";
import { getCampaignById } from "@/features/campaigns/queries";
import { getCampaignReportData } from "@/features/reports/queries";
import { getVerifiedAuth } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

function mapSupabaseError(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes("permission denied")) {
    return "Bu işlem için yetkiniz yok.";
  }

  if (normalized.includes("jwt")) {
    return "Oturumunuz geçersiz. Lütfen tekrar giriş yapın.";
  }

  return "Veritabanı hatası oluştu. Lütfen tekrar deneyin.";
}

async function requireAuthenticatedClient() {
  const supabase = await createClient();
  const auth = await getVerifiedAuth(supabase);

  if (!auth) {
    throw new Error("Oturum açmanız gerekiyor.");
  }

  return supabase;
}

export async function getReportSeriesByCampaignId(
  campaignId: string
): Promise<ReportSeries | null> {
  const supabase = await requireAuthenticatedClient();

  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(mapSupabaseError(error.message));
  }

  return (data as ReportSeries | null) ?? null;
}

export async function getOrCreateReportSeries(
  campaignId: string
): Promise<ReportSeries> {
  const existing = await getReportSeriesByCampaignId(campaignId);

  if (existing) {
    return existing;
  }

  const campaign = await getCampaignById(campaignId);

  if (!campaign) {
    notFound();
  }

  const supabase = await requireAuthenticatedClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("reports")
    .insert({
      campaign_id: campaignId,
      report_number: campaign.report_number,
      generated_at: now,
      last_updated_at: now,
      is_public: false,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      const retry = await getReportSeriesByCampaignId(campaignId);
      if (retry) {
        return retry;
      }
    }

    throw new Error(mapSupabaseError(error.message));
  }

  return data as ReportSeries;
}

export async function listReportVersions(
  campaignId: string
): Promise<ReportVersionRow[]> {
  const supabase = await requireAuthenticatedClient();

  const { data, error } = await supabase
    .from("report_versions")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("version_number", { ascending: false });

  if (error) {
    throw new Error(mapSupabaseError(error.message));
  }

  return (data ?? []) as ReportVersionRow[];
}

export async function getReportVersionById(
  versionId: string
): Promise<ReportVersionRow | null> {
  const supabase = await requireAuthenticatedClient();

  const { data, error } = await supabase
    .from("report_versions")
    .select("*")
    .eq("id", versionId)
    .maybeSingle();

  if (error) {
    throw new Error(mapSupabaseError(error.message));
  }

  return (data as ReportVersionRow | null) ?? null;
}

export async function getLatestReadyReportVersion(
  campaignId: string
): Promise<ReportVersionRow | null> {
  const supabase = await requireAuthenticatedClient();

  const { data, error } = await supabase
    .from("report_versions")
    .select("*")
    .eq("campaign_id", campaignId)
    .in("status", ["ready", "archived"])
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(mapSupabaseError(error.message));
  }

  return (data as ReportVersionRow | null) ?? null;
}

export async function getLatestComparableReportVersion(
  campaignId: string
): Promise<ReportVersionRow | null> {
  return getLatestReadyReportVersion(campaignId);
}

export async function getReportVersionCount(
  campaignId: string
): Promise<number> {
  const supabase = await requireAuthenticatedClient();

  const { count, error } = await supabase
    .from("report_versions")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", campaignId);

  if (error) {
    throw new Error(mapSupabaseError(error.message));
  }

  return count ?? 0;
}

export async function getMaxVersionNumber(reportId: string): Promise<number | null> {
  const supabase = await requireAuthenticatedClient();

  const { data, error } = await supabase
    .from("report_versions")
    .select("version_number")
    .eq("report_id", reportId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(mapSupabaseError(error.message));
  }

  return data?.version_number ?? null;
}

export async function getComparableReportVersions(
  campaignId: string,
  fromId: string,
  toId: string
): Promise<{ from: ReportVersionRow; to: ReportVersionRow } | null> {
  const [from, to] = await Promise.all([
    getReportVersionById(fromId),
    getReportVersionById(toId),
  ]);

  if (!from || !to) {
    return null;
  }

  if (from.campaign_id !== campaignId || to.campaign_id !== campaignId) {
    return null;
  }

  if (
    !["ready", "archived"].includes(from.status) ||
    !["ready", "archived"].includes(to.status)
  ) {
    return null;
  }

  return { from, to };
}

export async function getCampaignReportSeriesSummary(
  campaignId: string
): Promise<CampaignReportSeriesSummary> {
  const [series, versions, liveReport] = await Promise.all([
    getReportSeriesByCampaignId(campaignId),
    listReportVersions(campaignId),
    getCampaignReportData(campaignId).catch(() => null),
  ]);

  const latest = versions.find(
    (version) => version.status === "ready" || version.status === "archived"
  ) ?? versions[0] ?? null;

  return {
    hasSeries: Boolean(series),
    reportId: series?.id ?? null,
    reportNumber: series?.report_number ?? null,
    latestVersion: latest ? mapReportVersionSummary(latest) : null,
    versionCount: versions.length,
    hasGenerating: versions.some((version) => version.status === "generating"),
    hasFailed: versions.some((version) => version.status === "failed"),
    liveFreshness:
      liveReport?.metadata.freshness ?? {
        lastSuccessfulSyncAt: null,
        videosWithoutMetrics: 0,
        staleVideoCount: 0,
      },
  };
}

export async function hasGeneratingReportVersion(
  campaignId: string
): Promise<boolean> {
  const supabase = await requireAuthenticatedClient();

  const { count, error } = await supabase
    .from("report_versions")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("status", "generating");

  if (error) {
    throw new Error(mapSupabaseError(error.message));
  }

  return (count ?? 0) > 0;
}
