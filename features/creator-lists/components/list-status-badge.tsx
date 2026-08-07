import { Badge } from "@/components/ui/badge";
import type { CreatorListStatus } from "@/features/creator-lists/types";

const LABELS: Record<CreatorListStatus, string> = {
  draft: "Taslak",
  ready: "Hazır",
  archived: "Arşiv",
};

export function ListStatusBadge({ status }: { status: CreatorListStatus }) {
  const variant =
    status === "ready"
      ? "default"
      : status === "archived"
        ? "secondary"
        : "outline";

  return <Badge variant={variant}>{LABELS[status]}</Badge>;
}
