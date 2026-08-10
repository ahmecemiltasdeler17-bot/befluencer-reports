import { REPORT_BRAND } from "@/components/report/brand/befluencer-mark";

type ReportPrintFooterProps = {
  title: string;
  reportNumber: string;
  versionNumber: number;
  generatedAt: string | null;
  archived?: boolean;
};

/**
 * Minimal print brand signature. Version metadata remains in the cover header.
 * Props stay for call-site compatibility.
 */
export function ReportPrintFooter(props: ReportPrintFooterProps) {
  void props;
  return (
    <footer className="report-print-footer pdf-avoid-break mt-12 border-t border-[var(--report-border)] pt-8 pb-1 text-center">
      <p className="text-[11px] font-semibold tracking-[0.28em] text-[var(--report-accent)] uppercase">
        {REPORT_BRAND.name}
      </p>
    </footer>
  );
}
