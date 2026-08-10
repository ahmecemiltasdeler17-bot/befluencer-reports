import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { CreatorLeaderboard } from "@/components/report/content/creator-leaderboard";
import { CreatorRankingCard } from "@/components/report/content/creator-ranking-card";
import type { Creator } from "@/lib/types";

const ROOT = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

function makeCreator(
  partial: Partial<Creator> & Pick<Creator, "id" | "rank">
): Creator {
  return {
    handle: `@user_${partial.rank}`,
    displayName: `Creator ${partial.rank}`,
    avatar: "",
    followers: 10_000,
    videos: 2,
    views: 50_000,
    engagement: 1000,
    engagementRate: 4.2,
    category: "micro",
    platform: "tiktok",
    profileUrl: `https://www.tiktok.com/@user_${partial.rank}`,
    ...partial,
  };
}

function makeCreators(count: number): Creator[] {
  return Array.from({ length: count }, (_, index) =>
    makeCreator({
      id: `c${index + 1}`,
      rank: index + 1,
      views: (count - index) * 1000,
    })
  );
}

/** Ranks in document order — grid rows read left to right. */
function rankSequence(html: string): number[] {
  return [...html.matchAll(/w-6 shrink-0 text-sm font-semibold tabular-nums[^>]*>(\d+)</g)].map(
    (match) => Number(match[1])
  );
}

describe("compact two-column creator leaderboard", () => {
  it("renders every creator once, in rank order, as an ordered list", () => {
    const creators = makeCreators(34);
    const html = renderToStaticMarkup(
      <CreatorLeaderboard creators={creators} totalReach={100_000} />
    );

    assert.match(html, /report-ranking-grid/);
    assert.match(html, /<ol /);
    assert.equal(
      (html.match(/report-ranking-card/g) ?? []).length >= 34,
      true
    );
    assert.deepEqual(
      rankSequence(html),
      Array.from({ length: 34 }, (_, index) => index + 1)
    );
    for (const creator of creators) {
      assert.match(html, new RegExp(`${creator.handle}\\b`));
    }
    assert.match(html, /34 creator/);
  });

  it("marks only rank 1 as leader and keeps real values", () => {
    const html = renderToStaticMarkup(
      <CreatorLeaderboard
        creators={[
          makeCreator({ id: "c1", rank: 1, views: 80_000 }),
          makeCreator({ id: "c2", rank: 2, views: 20_000 }),
        ]}
        totalReach={100_000}
      />
    );

    assert.equal((html.match(/report-ranking-card--leader/g) ?? []).length, 1);
    assert.equal((html.match(/Lider/g) ?? []).length, 1);
    assert.match(html, /80,0 B/);
    assert.match(html, /80,0% katkı/);
    assert.match(html, /20,0% katkı/);
    assert.equal(html.includes("score"), false);
  });

  it("scales the contribution bar from the real share only", () => {
    const html = renderToStaticMarkup(
      <ul>
        <CreatorRankingCard
          creator={makeCreator({ id: "c1", rank: 1, views: 25 })}
          totalReach={100}
          maxContribution={50}
          isLeader
        />
      </ul>
    );

    assert.match(html, /report-bar-fill/);
    assert.match(html, /width:\s*50%/);
    assert.match(html, /25,0% katkı/);
  });

  it("uses the short category form and a single profile action", () => {
    const html = renderToStaticMarkup(
      <ul>
        <CreatorRankingCard
          creator={makeCreator({
            id: "c1",
            rank: 1,
            category: "macro",
            followers: 144_300,
            videos: 1,
          })}
          totalReach={100_000}
        />
      </ul>
    );

    assert.match(html, /144,3 B takipçi/);
    assert.match(html, /1 içerik/);
    assert.match(html, /Makro</);
    assert.equal(html.includes("Makro İçerik Üreticisi"), false);
    // Avatar + handle + trailing action, and the action is screen-only.
    assert.match(html, /report-ranking-card__action/);
    assert.match(html, /screen-only/);
  });

  it("keeps two columns on wide screens and in PDF, one column when narrow", () => {
    const css = read("app/globals.css");

    assert.match(css, /\.report-ranking-grid\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);
    assert.match(
      css,
      /@media \(min-width: 1080px\)\s*\{\s*\.report-ranking-grid\s*\{\s*grid-template-columns:\s*repeat\(2/
    );
    assert.match(
      css,
      /\.pdf-document \.report-ranking-grid\s*\{[\s\S]*?repeat\(2, minmax\(0, 1fr\)\) !important/
    );
  });
});
