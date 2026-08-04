import type { Creator } from "@/lib/types";

import { CreatorLeaderboardRow } from "./creator-leaderboard-row";

interface CreatorLeaderboardProps {
  creators: Creator[];
  totalReach: number;
}

export function CreatorLeaderboard({
  creators,
  totalReach,
}: CreatorLeaderboardProps) {
  return (
    <section aria-label="İçerik üreticisi sıralaması" className="mt-24">
      <h2 className="text-[28px] font-semibold tracking-tight text-white min-[1100px]:text-[32px]">
        İçerik Üreticisi Sıralaması
      </h2>
      <p className="mt-2 text-base text-zinc-400">
        Toplam kampanya erişimine göre
      </p>

      <div className="mt-8 border-t border-white/[0.06]">
        {creators.map((creator) => (
          <CreatorLeaderboardRow
            key={creator.id}
            creator={creator}
            totalReach={totalReach}
            isLeader={creator.rank === 1}
          />
        ))}
      </div>
    </section>
  );
}
