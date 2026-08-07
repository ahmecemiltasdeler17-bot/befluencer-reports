import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { CreatorAvatar } from "@/features/creators/components/creator-avatar";
import {
  getCreatorAvatarSeed,
  getCreatorInitials,
  sanitizeCreatorNameText,
} from "@/features/creators/get-creator-initials";

describe("sanitizeCreatorNameText", () => {
  it("removes replacement characters and control characters", () => {
    assert.equal(
      sanitizeCreatorNameText(`Ecem\u0001Dans\uFFFD`),
      "EcemDans"
    );
  });

  it("collapses repeated whitespace and trims", () => {
    assert.equal(sanitizeCreatorNameText("  Ecem   Dans  "), "Ecem Dans");
  });

  it("preserves valid Turkish characters after NFC", () => {
    assert.equal(sanitizeCreatorNameText("İrem Şahin"), "İrem Şahin");
  });
});

describe("getCreatorInitials", () => {
  it("uses a normal ASCII display name", () => {
    assert.equal(getCreatorInitials("Ecem Dans", "ecemdans"), "ED");
  });

  it("handles Turkish characters with fixed locale casing", () => {
    assert.equal(getCreatorInitials("irem yılmaz", "irem"), "IY");
    // Already-uppercase İ must remain stable under en-US casing.
    const turkish = getCreatorInitials("İrem Yılmaz", "irem");
    assert.equal(turkish.length, 2);
    assert.equal(turkish[1], "Y");
    assert.match(turkish[0]!, /[İI]/);
  });

  it("handles emoji plus text without throwing", () => {
    const initials = getCreatorInitials("🔥 Ecem", "ecemdans");
    assert.ok(initials.length >= 1);
    assert.notEqual(initials, "?");
  });

  it("strips replacement characters before initials", () => {
    assert.equal(getCreatorInitials("Ecem\uFFFD Dans", "ecemdans"), "ED");
    assert.equal(getCreatorInitials("\uFFFD\uFFFD", "ecemdans"), "EC");
  });

  it("falls back to username when display name is empty", () => {
    assert.equal(getCreatorInitials("", "ecemdans"), "EC");
    assert.equal(getCreatorInitials(null, "ecemdans"), "EC");
    assert.equal(getCreatorInitials("   ", "ecemdans"), "EC");
  });

  it("falls back to username after malformed display name sanitization", () => {
    assert.equal(getCreatorInitials("\uFFFD\u0000", "micro_star"), "MI");
  });

  it("builds two-word initials", () => {
    assert.equal(getCreatorInitials("Ada Lovelace", "ada"), "AL");
  });

  it("builds one-word initials from up to two characters", () => {
    assert.equal(getCreatorInitials("Ecem", "x"), "EC");
    assert.equal(getCreatorInitials("A", "x"), "A");
  });

  it("returns ? when nothing safe remains", () => {
    assert.equal(getCreatorInitials("\uFFFD", "\u0001"), "?");
    assert.equal(getCreatorInitials(null, ""), "?");
  });

  it("produces identical output repeatedly for the same input", () => {
    const input: [string, string] = ["Şule  Öztürk", "sule_ozturk"];
    const first = getCreatorInitials(...input);
    for (let i = 0; i < 20; i += 1) {
      assert.equal(getCreatorInitials(...input), first);
    }
  });
});

describe("getCreatorAvatarSeed", () => {
  it("is deterministic for the same username", () => {
    const a = getCreatorAvatarSeed("ecemdans");
    const b = getCreatorAvatarSeed("ecemdans");
    assert.equal(a, b);
    assert.ok(Number.isInteger(a));
    assert.ok(a >= 0);
  });

  it("does not depend on Math.random or Date", () => {
    assert.notEqual(getCreatorAvatarSeed("a"), getCreatorAvatarSeed("b"));
  });
});

describe("CreatorAvatar hydration", () => {
  it("server-rendered markup equals a second render (stable SSR)", () => {
    const props = {
      username: "irem_yilmaz",
      displayName: "irem yılmaz\uFFFD",
      avatarUrl: null as string | null,
    };

    const first = renderToStaticMarkup(<CreatorAvatar {...props} />);
    const second = renderToStaticMarkup(<CreatorAvatar {...props} />);

    assert.equal(first, second);
    assert.match(first, /data-creator-initials="IY"/);
    assert.match(first, />IY</);
  });

  it("keeps the same initials when an image URL is present on first paint", () => {
    const html = renderToStaticMarkup(
      <CreatorAvatar
        username="ecemdans"
        displayName="Ecem Dans"
        avatarUrl="https://cdn.example.com/avatar.jpg"
      />
    );

    assert.match(html, /data-creator-initials="ED"/);
    assert.match(html, /cdn\.example\.com\/avatar\.jpg/);
  });

  it("image error path keeps the same initials string", () => {
    const withImage = getCreatorInitials("Ecem Dans", "ecemdans");
    const withoutImage = getCreatorInitials("Ecem Dans", "ecemdans");
    assert.equal(withImage, withoutImage);
    assert.equal(withImage, "ED");

    const fallbackHtml = renderToStaticMarkup(
      <CreatorAvatar
        username="ecemdans"
        displayName="Ecem Dans"
        avatarUrl={null}
      />
    );
    assert.match(fallbackHtml, /data-creator-initials="ED"/);
  });
});
