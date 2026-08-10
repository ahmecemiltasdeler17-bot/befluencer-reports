import type { ReactNode } from "react";

import { BeFluencerMark } from "@/components/report/brand/befluencer-mark";
import { ReportCanvas } from "@/components/report/report-canvas";

/**
 * Legacy shell retained for compatibility. Prefer ReportCanvas + CampaignReportView.
 */
export function ReportShell({ children }: { children: ReactNode }) {
  return (
    <ReportCanvas
      topSlot={
        <div className="mb-8 flex h-12 items-center border-b border-white/[0.06] pb-4">
          <BeFluencerMark size="md" />
        </div>
      }
    >
      <article>{children}</article>
    </ReportCanvas>
  );
}
