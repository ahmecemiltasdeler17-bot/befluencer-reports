import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isFineHoverEnvironment,
  shouldArmHoverPreview,
  shouldPreferTouchPreviewControl,
} from "@/components/report/content/featured-preview-interaction";

function mq(map: Record<string, boolean>) {
  return (query: string) => ({ matches: Boolean(map[query]) });
}

describe("featured preview pointer helpers", () => {
  it("arms hover preview only for mouse in fine+hover environments", () => {
    const desktop = mq({
      "(hover: hover)": true,
      "(pointer: fine)": true,
    });
    assert.equal(shouldArmHoverPreview("mouse", desktop), true);
    assert.equal(shouldArmHoverPreview("touch", desktop), false);
    assert.equal(shouldArmHoverPreview("pen", desktop), false);
  });

  it("does not arm hover preview on coarse / no-hover devices", () => {
    const mobile = mq({
      "(hover: hover)": false,
      "(pointer: fine)": false,
    });
    assert.equal(shouldArmHoverPreview("mouse", mobile), false);
    assert.equal(shouldPreferTouchPreviewControl(mobile), true);
    assert.equal(isFineHoverEnvironment(mobile), false);
  });

  it("hybrid fine+hover prefers desktop hover path, not touch-only gating", () => {
    const hybrid = mq({
      "(hover: hover)": true,
      "(pointer: fine)": true,
    });
    assert.equal(isFineHoverEnvironment(hybrid), true);
    assert.equal(shouldPreferTouchPreviewControl(hybrid), false);
    // Touch pointer still must not trigger hover arming.
    assert.equal(shouldArmHoverPreview("touch", hybrid), false);
    assert.equal(shouldArmHoverPreview("mouse", hybrid), true);
  });
});
