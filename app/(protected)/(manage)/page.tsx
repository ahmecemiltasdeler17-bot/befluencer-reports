import { DashboardActivity } from "@/features/dashboard/components/dashboard-activity";
import { DashboardAttention } from "@/features/dashboard/components/dashboard-attention";
import { DashboardCampaignOverview } from "@/features/dashboard/components/dashboard-campaign-overview";
import { DashboardHeader } from "@/features/dashboard/components/dashboard-header";
import { DashboardKpiCards } from "@/features/dashboard/components/dashboard-kpi-cards";
import { DashboardRecentReports } from "@/features/dashboard/components/dashboard-recent-reports";
import { DashboardSyncStatus } from "@/features/dashboard/components/dashboard-sync-status";
import { getDashboardData } from "@/features/dashboard/queries";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const data = await getDashboardData();

  return (
    <div className="space-y-8">
      <DashboardHeader
        syncConfigured={data.syncConfigured}
        videoAddHref={data.videoAddHref}
      />

      <DashboardKpiCards kpis={data.kpis} />

      <DashboardCampaignOverview campaigns={data.campaigns} />

      <div className="grid gap-6 lg:grid-cols-2">
        <DashboardAttention warnings={data.warnings} />
        <DashboardSyncStatus
          latestSync={data.latestSync}
          recentFailedSyncs={data.recentFailedSyncs}
          syncConfigured={data.syncConfigured}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <DashboardRecentReports reports={data.recentReports} />
        <DashboardActivity activity={data.activity} />
      </div>
    </div>
  );
}
