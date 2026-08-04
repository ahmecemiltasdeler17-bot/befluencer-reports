import { Eye, TrendingUp, Users } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCompact, formatPercent } from "@/lib/format";
import type { Creator } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CreatorRankingProps {
  creators: Creator[];
}

export function CreatorRanking({ creators }: CreatorRankingProps) {
  return (
    <Card className="border-white/8 bg-[#111113] py-0 ring-0">
      <CardHeader className="border-b border-white/6 pb-4">
        <CardTitle className="text-sm font-medium text-zinc-200">
          Creator Ranking
        </CardTitle>
        <p className="text-xs text-zinc-500">Top performers by total views</p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-white/6">
          {creators.map((creator) => (
            <div
              key={creator.id}
              className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-white/2"
            >
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold tabular-nums",
                  creator.rank <= 3
                    ? "bg-white/10 text-white"
                    : "bg-white/5 text-zinc-500"
                )}
              >
                {creator.rank}
              </span>

              <Avatar size="sm">
                <AvatarImage src={creator.avatar} alt={creator.displayName} />
                <AvatarFallback>
                  {creator.displayName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">
                  {creator.displayName}
                </p>
                <p className="truncate text-xs text-zinc-500">{creator.handle}</p>
              </div>

              <div className="hidden shrink-0 text-right sm:block">
                <p className="text-sm font-medium text-white tabular-nums">
                  {formatCompact(creator.views)}
                </p>
                <p className="text-xs text-zinc-500">views</p>
              </div>

              <div className="hidden shrink-0 flex-col items-end gap-0.5 lg:flex">
                <div className="flex items-center gap-1 text-xs text-emerald-400">
                  <TrendingUp className="size-3" />
                  {formatPercent(creator.engagementRate)}
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <span className="flex items-center gap-0.5">
                    <Users className="size-3" />
                    {formatCompact(creator.followers)}
                  </span>
                  <span>·</span>
                  <span>{creator.videos} videos</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-white/6 px-5 py-3">
          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
            <Eye className="size-3" />
            Ranked by total campaign views
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
