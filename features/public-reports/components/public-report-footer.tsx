import { REPORT_BRAND } from "@/components/report/brand/befluencer-mark";

type PublicReportFooterProps = {
  reportNumber: string | null;
  versionNumber: number;
};

export function PublicReportFooter(props: PublicReportFooterProps) {
  void props;
  return (
    <footer className="mt-10 border-t border-[var(--report-border)] py-8 text-center print:hidden">
      <p className="text-[11px] font-semibold tracking-[0.28em] text-[var(--report-accent)] uppercase">
        {REPORT_BRAND.name}
      </p>
    </footer>
  );
}
