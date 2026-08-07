import {
  formatComparisonPercent,
  formatComparisonValue,
} from "@/features/report-generation/comparison";
import type { ReportVersionComparison } from "@/features/report-generation/types";

export function ReportComparisonTable({
  comparison,
}: {
  comparison: ReportVersionComparison;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800">
      <table className="min-w-full divide-y divide-zinc-800 text-sm">
        <thead className="bg-zinc-950/40">
          <tr className="text-left text-zinc-400">
            <th className="px-4 py-3 font-medium">Metrik</th>
            <th className="px-4 py-3 font-medium">Eski değer</th>
            <th className="px-4 py-3 font-medium">Yeni değer</th>
            <th className="px-4 py-3 font-medium">Mutlak fark</th>
            <th className="px-4 py-3 font-medium">Yüzde fark</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/80 bg-zinc-950/20">
          {comparison.metrics.map((metric) => (
            <tr key={metric.key} className="text-zinc-200">
              <td className="px-4 py-3">{metric.label}</td>
              <td className="px-4 py-3 tabular-nums">
                {formatComparisonValue(metric.oldValue)}
              </td>
              <td className="px-4 py-3 tabular-nums">
                {formatComparisonValue(metric.newValue)}
              </td>
              <td className="px-4 py-3 tabular-nums">
                {formatComparisonValue(metric.absoluteDelta)}
              </td>
              <td className="px-4 py-3 tabular-nums">
                {formatComparisonPercent(metric.percentDelta)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
