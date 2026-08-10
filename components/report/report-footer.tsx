import { REPORT_BRAND } from "@/components/report/brand/befluencer-mark";

type ReportFooterProps = {
  reportNumber?: string;
  reportDate?: string;
  lastUpdated?: string;
  presentationNote?: string;
};

/**
 * Minimal brand signature. Report metadata lives in the cover header —
 * props remain for call-site compatibility but are not rendered.
 */
export function ReportFooter(props: ReportFooterProps = {}) {
  void props;
  return (
    <footer className="report-footer pdf-avoid-break mt-16 border-t border-[var(--report-border)] pt-12 pb-14 text-center min-[1100px]:mt-20">
      <p className="text-sm font-semibold tracking-[0.32em] text-[var(--report-accent)] uppercase">
        {REPORT_BRAND.name}
      </p>
    </footer>
  );
}
