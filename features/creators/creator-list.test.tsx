import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { CreatorAvatar } from "@/features/creators/components/creator-avatar";
import { getCreatorInitials } from "@/features/creators/get-creator-initials";

describe("creator list avatar hydration", () => {
  it("uses the pure initials helper from CreatorAvatar", () => {
    const source = readFileSync(
      "features/creators/components/creator-avatar.tsx",
      "utf8"
    );
    assert.match(source, /getCreatorInitials/);
    assert.match(source, /getCreatorAvatarSeed/);
    assert.doesNotMatch(source, /suppressHydrationWarning/);
    assert.doesNotMatch(source, /toLocaleUpperCase\(\s*\)/);
    assert.doesNotMatch(source, /Intl\.Segmenter/);
    assert.doesNotMatch(source, /navigator\.language/);
    assert.doesNotMatch(source, /Math\.random/);
  });

  it("list page renders CreatorAvatar without client-only initial branches", () => {
    const page = readFileSync(
      "app/(protected)/(manage)/creators/page.tsx",
      "utf8"
    );
    const directory = readFileSync(
      "features/creator-lists/components/creator-directory-selection.tsx",
      "utf8"
    );
    assert.match(page, /CreatorDirectorySelection/);
    assert.match(directory, /CreatorAvatar/);
    assert.doesNotMatch(page, /suppressHydrationWarning/);
    assert.doesNotMatch(directory, /suppressHydrationWarning/);
  });

  it("wires allowlisted sort URL params without selection ids", () => {
    const page = readFileSync(
      "app/(protected)/(manage)/creators/page.tsx",
      "utf8"
    );
    const directory = readFileSync(
      "features/creator-lists/components/creator-directory-selection.tsx",
      "utf8"
    );
    assert.match(page, /parseCreatorDirectorySortState/);
    assert.match(page, /CreatorDirectoryFilterForm/);
    assert.match(directory, /sortCreatorDirectoryRows/);
    assert.match(directory, /history\.replaceState/);
    assert.doesNotMatch(
      directory,
      /selectedIds.*searchParams|URLSearchParams.*selected/
    );
    assert.doesNotMatch(page, /Math\.random/);
    assert.doesNotMatch(directory, /Math\.random/);

    const filterForm = readFileSync(
      "features/creators/components/creator-directory-filter-form.tsx",
      "utf8"
    );
    assert.match(filterForm, /sort/);
    assert.match(filterForm, /direction/);
  });

  it("SSR markup for list-like avatars matches a second render", () => {
    const rows = [
      { username: "ecemdans", displayName: "Ecem Dans", avatarUrl: null },
      {
        username: "irem",
        displayName: "irem yılmaz\uFFFD",
        avatarUrl: "https://cdn.example.com/a.jpg",
      },
      { username: "solo", displayName: null, avatarUrl: null },
    ];

    for (const row of rows) {
      const expected = getCreatorInitials(row.displayName, row.username);
      const html = renderToStaticMarkup(
        <CreatorAvatar
          username={row.username}
          displayName={row.displayName}
          avatarUrl={row.avatarUrl}
          size="sm"
        />
      );
      const again = renderToStaticMarkup(
        <CreatorAvatar
          username={row.username}
          displayName={row.displayName}
          avatarUrl={row.avatarUrl}
          size="sm"
        />
      );

      assert.equal(html, again);
      assert.match(html, new RegExp(`data-creator-initials="${expected}"`));
    }
  });
});
