import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import {
  CreatorGrowthCell,
  CreatorSyncStateCell,
} from "@/features/creator-sync/components/creator-sync-state";
import { SyncCreatorButton } from "@/features/creator-sync/components/sync-creator-button";
import type { CreatorSyncSummary } from "@/features/creator-sync/types";
import { CreatorAvatar } from "@/features/creators/components/creator-avatar";
import { CreatorCategoryBadge } from "@/features/creators/components/creator-category-badge";
import { CreatorPlatformBadge } from "@/features/creators/components/creator-platform-badge";
import { RemoveCreatorButton } from "@/features/creators/components/remove-creator-button";
import type { CampaignCreatorWithCreator } from "@/features/creators/types";
import { CompactCountText } from "@/components/format/compact-count-text";
import { cn } from "@/lib/utils";

function formatFee(fee: number | null): string {
  if (fee === null) {
    return "—";
  }

  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(fee);
}

function truncateNotes(notes: string | null, max = 60): string | null {
  if (!notes?.trim()) {
    return null;
  }

  return notes.length > max ? `${notes.slice(0, max)}…` : notes;
}

export function CampaignCreatorRow({
  assignment,
  campaignId,
  syncSummary,
  syncConfigured,
}: {
  assignment: CampaignCreatorWithCreator;
  campaignId: string;
  /** Follower growth and sync state, absent when snapshots were not loaded. */
  syncSummary?: CreatorSyncSummary;
  syncConfigured: boolean;
}) {
  const { creator } = assignment;
  const notesPreview = truncateNotes(assignment.notes);

  return (
    <tr className="text-bf-text/90 transition-colors hover:bg-primary/[0.04]">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <CreatorAvatar
            username={creator.username}
            displayName={creator.display_name}
            avatarUrl={creator.avatar_url}
            size="sm"
          />
          <div>
            <p className="font-medium text-bf-text">@{creator.username}</p>
            <p className="text-xs text-bf-steel">
              {creator.display_name ?? "—"}
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <CreatorPlatformBadge platform={creator.platform} />
      </td>
      <td className="px-4 py-3">
        <CreatorCategoryBadge category={creator.category} />
      </td>
      <td className="px-4 py-3 tabular-nums">
        <CompactCountText
          value={syncSummary?.currentFollowers ?? creator.follower_count}
          variant="management"
        />
      </td>
      <td className="px-4 py-3">
        <CreatorGrowthCell
          absoluteGrowth={syncSummary?.absoluteGrowth ?? null}
          growthPercentage={syncSummary?.growthPercentage ?? null}
        />
      </td>
      <td className="px-4 py-3">
        <CreatorSyncStateCell
          status={syncSummary?.syncStatus ?? creator.sync_status ?? "pending"}
          lastSyncedAt={syncSummary?.lastSyncedAt ?? creator.last_synced_at}
          accountStatus={creator.account_status ?? "active"}
        />
      </td>
      <td className="px-4 py-3 tabular-nums">
        {assignment.agreed_content_count}
      </td>
      <td className="px-4 py-3 tabular-nums">{formatFee(assignment.fee)}</td>
      <td className="px-4 py-3 max-w-[200px] truncate text-bf-steel">
        {notesPreview ?? "—"}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-2">
          <SyncCreatorButton
            creatorId={creator.id}
            platform={creator.platform}
            syncConfigured={syncConfigured}
            accountStatus={creator.account_status ?? "active"}
            compact
          />
          <Link
            href={`/creators/${creator.id}`}
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            Aç
          </Link>
          <Link
            href={`/campaigns/${campaignId}/creators/${creator.id}/edit`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Düzenle
          </Link>
          <RemoveCreatorButton
            campaignId={campaignId}
            creatorId={creator.id}
            creatorName={creator.display_name ?? creator.username}
          />
        </div>
      </td>
    </tr>
  );
}
