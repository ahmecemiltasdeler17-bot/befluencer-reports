import { ReportSection } from "@/components/report/report-section";
import type { Creator } from "@/lib/types";

import { CreatorRankingCard } from "./creator-ranking-card";

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
        <p className="text-sm text-[var(--report-text-tertiary)]">
          Bu kampanyaya henüz içerik üreticisi atanmadı.
        </p>
      </ReportSection>
    );
  }

  const maxContribution =
    totalReach > 0
      ? Math.max(...creators.map((c) => (c.views / totalReach) * 100), 1)
      : 1;

  return (
    <ReportSection
      id="creators"
      eyebrow="İçerik üreticileri"
      title="İçerik Üreticisi Performansı"
      description="Toplam kampanya erişimine göre sıralama. Sıra soldan sağa, satır satır ilerler."
      aside={
        <span className="text-[var(--report-text-secondary)]">
          {creators.length} creator
        </span>
      }
    >
      {/* An ordered list keeps the ranking sequence explicit for assistive tech
          even though the grid renders two columns per row on wide screens. */}
      <ol className="report-ranking-grid report-leaderboard">
        {creators.map((creator) => (
          <CreatorRankingCard
            key={creator.id}
            creator={creator}
            totalReach={totalReach}
            isLeader={creator.rank === 1}
            maxContribution={maxContribution}
          />
        ))}
      </ol>
    </ReportSection>
  );
}
