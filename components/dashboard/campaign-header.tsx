import { Download, ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateRange } from "@/lib/format";
import type { Campaign } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CampaignHeaderProps {
  campaign: Campaign;
}

const statusStyles: Record<Campaign["status"], string> = {
  active: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
  completed: "border-zinc-500/20 bg-zinc-500/10 text-zinc-400",
  draft: "border-amber-500/20 bg-amber-500/10 text-amber-400",
  paused: "border-orange-500/20 bg-orange-500/10 text-orange-400",
};

export function CampaignHeader({ campaign }: CampaignHeaderProps) {
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex gap-5">
        <div
          className="hidden size-16 shrink-0 rounded-xl ring-1 ring-white/10 sm:block"
          style={{
            background: `linear-gradient(135deg, ${campaign.coverColor}, #09090B)`,
          }}
        />
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Badge
              variant="outline"
              className={cn("capitalize", statusStyles[campaign.status])}
            >
              {campaign.status}
            </Badge>
            <span className="text-xs text-zinc-500">
              {formatDateRange(campaign.startDate, campaign.endDate)}
            </span>
          </div>

          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {campaign.name}
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              {campaign.artist} · {campaign.track}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-500">
            <span>
              Client:{" "}
              <span className="text-zinc-300">{campaign.client}</span>
            </span>
            <span className="hidden text-zinc-700 sm:inline">·</span>
            <a
              href={campaign.soundUrl}
              className="inline-flex items-center gap-1 text-zinc-400 transition-colors hover:text-zinc-200"
            >
              View sound
              <ExternalLink className="size-3" />
            </a>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button variant="outline" size="sm">
          Share
        </Button>
        <Button size="sm">
          <Download className="size-4" />
          Export Report
        </Button>
      </div>
    </div>
  );
}
