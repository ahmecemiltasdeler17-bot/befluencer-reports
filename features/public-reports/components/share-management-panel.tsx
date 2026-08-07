import { ShareList } from "@/features/public-reports/components/share-list";
import { listPublicReportShares } from "@/features/public-reports/queries";
import { isShareableVersionStatus } from "@/features/public-reports/calculations";

export async function ShareManagementPanel({
  reportVersionId,
  status,
}: {
  reportVersionId: string;
  status: string;
}) {
  const canCreate = isShareableVersionStatus(status);
  let shares: Awaited<ReturnType<typeof listPublicReportShares>> = [];

  try {
    shares = await listPublicReportShares(reportVersionId);
  } catch {
    shares = [];
  }

  return (
    <ShareList
      reportVersionId={reportVersionId}
      shares={shares}
      canCreate={canCreate}
    />
  );
}
