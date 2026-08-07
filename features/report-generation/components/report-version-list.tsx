import { mapReportVersionSummary } from "@/features/report-generation/calculations";
import { ReportEmptyState } from "@/features/report-generation/components/report-empty-state";
import { ReportVersionRow } from "@/features/report-generation/components/report-version-row";
import type { ReportVersionRow as ReportVersionDbRow } from "@/features/report-generation/types";

export function ReportVersionList({
  campaignId,
  versions,
}: {
  campaignId: string;
  versions: ReportVersionDbRow[];
}) {
  if (versions.length === 0) {
    return (
      <ReportEmptyState
        title="Henüz rapor sürümü yok"
        description="Canlı kampanya verilerinden kalıcı bir rapor sürümü oluşturabilirsiniz."
      />
    );
  }

  const summaries = versions.map(mapReportVersionSummary);
  const latestReady = summaries.find(
    (version) => version.status === "ready" || version.status === "archived"
  );

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800">
      <table className="min-w-full divide-y divide-zinc-800 text-sm">
        <thead className="bg-zinc-950/40">
          <tr className="text-left text-zinc-400">
            <th className="px-3 py-3 font-medium">Sürüm</th>
            <th className="px-3 py-3 font-medium">Durum</th>
            <th className="px-3 py-3 font-medium">Oluşturulma</th>
            <th className="px-3 py-3 font-medium">Oluşturan</th>
            <th className="px-3 py-3 font-medium">Toplam izlenme</th>
            <th className="px-3 py-3 font-medium">Etkileşim oranı</th>
            <th className="px-3 py-3 font-medium">Video</th>
            <th className="px-3 py-3 font-medium">Üretici</th>
            <th className="px-3 py-3 font-medium">Kaynak son güncelleme</th>
            <th className="px-3 py-3 font-medium text-right">İşlemler</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/80 bg-zinc-950/20">
          {summaries.map((version) => (
            <ReportVersionRow
              key={version.id}
              campaignId={campaignId}
              version={version}
              compareBaseId={latestReady?.id}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
