import { ReportSection } from "@/components/report/report-section";
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
  if (creators.length === 0) {
    return (
      <ReportSection
        id="creators"
        eyebrow="İçerik üreticileri"
        title="İçerik Üreticisi Performansı"
        description="Toplam kampanya erişimine göre sıralama."
      >
        <p className="text-sm text-zinc-500">
          Bu kampanyaya henüz içerik üreticisi atanmadı.
        </p>
      </ReportSection>
    );
  }

  return (
    <ReportSection
      id="creators"
      eyebrow="İçerik üreticileri"
      title="İçerik Üreticisi Performansı"
      description="Toplam kampanya erişimine göre sıralama."
      aside={<span>{creators.length} creator</span>}
    >
      <div className="overflow-hidden rounded-xl border border-white/[0.06]">
        <div className="hidden border-b border-white/[0.06] bg-white/[0.02] px-4 py-3 text-[10px] tracking-[0.16em] text-zinc-500 uppercase min-[800px]:grid min-[800px]:grid-cols-[auto_auto_minmax(0,1.4fr)_auto_auto_auto_auto] min-[800px]:gap-4">
          <span>#</span>
          <span className="col-span-2">Kimlik</span>
          <span className="text-right">İzlenme</span>
          <span className="text-right">Katkı</span>
          <span className="text-right">Etkileşim</span>
          <span />
        </div>
        {creators.map((creator) => (
          <CreatorLeaderboardRow
            key={creator.id}
            creator={creator}
            totalReach={totalReach}
            isLeader={creator.rank === 1}
          />
        ))}
      </div>
    </ReportSection>
  );
}
