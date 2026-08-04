import { TrendingUp } from "lucide-react";

import { formatTurkishReport } from "@/lib/format";
import type { TotalReach } from "@/lib/types";

import { CreatorAvatarStack } from "./creator-avatar-stack";
import type { CreatorAvatar } from "./creator-avatar-stack";

interface TotalReachHeroProps {
  totalReach: TotalReach;
  creators: CreatorAvatar[];
  overflowCount?: number;
}

export function TotalReachHero({
  totalReach,
  creators,
  overflowCount = 12,
}: TotalReachHeroProps) {
  return (
    <section className="flex flex-col items-center pt-16 pb-0 text-center min-[1100px]:pt-20">
      <p className="text-[11px] font-medium tracking-[0.28em] text-zinc-500 uppercase">
        Toplam Erişim
      </p>

      <p className="mt-4 text-[72px] leading-[0.9] font-bold tracking-tighter text-white tabular-nums min-[1100px]:text-[96px] min-[1100px]:leading-[0.88] xl:text-[120px]">
        {formatTurkishReport(totalReach.value)}
      </p>

      <div className="mt-5 flex items-center gap-2 text-sm font-medium text-emerald-400">
        <span className="flex size-5 items-center justify-center rounded-full bg-emerald-500/15">
          <TrendingUp className="size-3" strokeWidth={2.5} />
        </span>
        <span>
          Kampanya başlangıcından beri +
          {totalReach.growthSinceStart.toFixed(1).replace(".", ",")}%
        </span>
      </div>

      <div className="mt-8">
        <CreatorAvatarStack creators={creators} overflowCount={overflowCount} />
      </div>
    </section>
  );
}
