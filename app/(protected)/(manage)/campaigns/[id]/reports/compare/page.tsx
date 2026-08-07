import Link from "next/link";
import { notFound } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import {
  compareReportSnapshots,
} from "@/features/report-generation/comparison";
import { mapReportVersionSummary } from "@/features/report-generation/calculations";
import { ReportComparisonTable } from "@/features/report-generation/components/report-comparison-table";
import { ReportVersionStatusBadge } from "@/features/report-generation/components/report-version-status-badge";
import { getComparableReportVersions } from "@/features/report-generation/queries";
import { getCampaignById } from "@/features/campaigns/queries";
import type { ReportVersionStatus } from "@/features/report-generation/types";
import { cn } from "@/lib/utils";

function formatDateTime(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function ReportComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { id } = await params;
  const { from, to } = await searchParams;

  if (!from || !to) {
    notFound();
  }

  const [campaign, pair] = await Promise.all([
    getCampaignById(id),
    getComparableReportVersions(id, from, to),
  ]);

  if (!campaign || !pair) {
    notFound();
  }

  const comparison = compareReportSnapshots({
    fromVersion: mapReportVersionSummary(pair.from),
    toVersion: mapReportVersionSummary(pair.to),
    fromSnapshot: pair.from.snapshot,
    toSnapshot: pair.to.snapshot,
  });

  return (
    <div className="space-y-8">
      <div>
        <Link
          href={`/campaigns/${id}/reports`}
          className="text-sm text-zinc-400 transition-colors hover:text-white"
        >
          ← Rapor geçmişine dön
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-white">
          Rapor Karşılaştırması
        </h1>
        <p className="mt-1 text-sm text-zinc-400">{campaign.name}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <VersionCard
          label="Eski sürüm"
          versionNumber={comparison.fromVersion.versionNumber}
          status={comparison.fromVersion.status}
          generatedAt={comparison.fromVersion.generatedAt}
          href={`/campaigns/${id}/reports/${comparison.fromVersion.id}`}
        />
        <VersionCard
          label="Yeni sürüm"
          versionNumber={comparison.toVersion.versionNumber}
          status={comparison.toVersion.status}
          generatedAt={comparison.toVersion.generatedAt}
          href={`/campaigns/${id}/reports/${comparison.toVersion.id}`}
        />
      </div>

      <ReportComparisonTable comparison={comparison} />

      <Link
        href={`/campaigns/${id}/reports`}
        className={cn(buttonVariants({ variant: "outline" }))}
      >
        Rapor geçmişine dön
      </Link>
    </div>
  );
}

function VersionCard({
  label,
  versionNumber,
  status,
  generatedAt,
  href,
}: {
  label: string;
  versionNumber: number;
  status: ReportVersionStatus;
  generatedAt: string | null;
  href: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-5">
      <p className="text-xs text-zinc-500 uppercase tracking-[0.16em]">
        {label}
      </p>
      <div className="mt-3 flex items-center gap-3">
        <h2 className="text-lg font-medium text-white">v{versionNumber}</h2>
        <ReportVersionStatusBadge status={status} />
      </div>
      <p className="mt-2 text-sm text-zinc-400">
        {formatDateTime(generatedAt)}
      </p>
      <Link
        href={href}
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "mt-4"
        )}
      >
        Raporu aç
      </Link>
    </div>
  );
}
