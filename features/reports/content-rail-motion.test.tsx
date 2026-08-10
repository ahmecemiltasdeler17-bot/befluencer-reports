import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  advanceRailDrift,
  AUTO_DRIFT_PX_PER_SECOND,
  RAIL_RESUME_IDLE_MS,
  shouldEnableRailAutoplay,
} from "@/components/report/content/content-rail";

const ROOT = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

function media(queries: Record<string, boolean>) {
  return (query: string) =>
    ({
      matches: Boolean(queries[query]),
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false;
      },
    }) as MediaQueryList;
}

describe("content rail autoplay gating", () => {
  it("enables autoplay for desktop mouse / fine pointer", () => {
    assert.equal(
      shouldEnableRailAutoplay(
        media({
          "(prefers-reduced-motion: reduce)": false,
          "(any-pointer: fine)": true,
          "(pointer: coarse)": false,
        })
      ),
      true
    );
  });

  it("keeps autoplay on hybrid Windows touch + mouse devices", () => {
    assert.equal(
      shouldEnableRailAutoplay(
        media({
          "(prefers-reduced-motion: reduce)": false,
          "(any-pointer: fine)": true,
          "(pointer: coarse)": true,
        })
      ),
      true
    );
  });

  it("disables autoplay on coarse-only devices", () => {
    assert.equal(
      shouldEnableRailAutoplay(
        media({
          "(prefers-reduced-motion: reduce)": false,
          "(any-pointer: fine)": false,
          "(pointer: coarse)": true,
        })
      ),
      false
    );
  });

  it("disables autoplay when reduced motion is preferred", () => {
    assert.equal(
      shouldEnableRailAutoplay(
        media({
          "(prefers-reduced-motion: reduce)": true,
          "(any-pointer: fine)": true,
          "(pointer: coarse)": false,
        })
      ),
      false
    );
  });

  it("never uses ontouchstart capability detection", () => {
    const source = read("components/report/content/content-rail.tsx");
    assert.equal(/['"]ontouchstart['"]\s*in\s*window/.test(source), false);
    assert.equal(/ontouchstart/.test(source), false);
    assert.match(source, /any-pointer: fine/);
  });
});

describe("content rail drift step", () => {
  it("advances at approximately 15px/s", () => {
    const step = advanceRailDrift({
      scrollLeft: 0,
      maxScroll: 1000,
      direction: 1,
      deltaSeconds: 1,
    });
    assert.equal(step.nextLeft, AUTO_DRIFT_PX_PER_SECOND);
    assert.equal(AUTO_DRIFT_PX_PER_SECOND, 15);
  });

  it("reverses at the end instead of teleporting", () => {
    const atEnd = advanceRailDrift({
      scrollLeft: 990,
      maxScroll: 1000,
      direction: 1,
      deltaSeconds: 1,
    });
    assert.equal(atEnd.nextLeft, 1000);
    assert.equal(atEnd.direction, -1);

    const reverse = advanceRailDrift({
      scrollLeft: 1000,
      maxScroll: 1000,
      direction: -1,
      deltaSeconds: 1,
    });
    assert.equal(reverse.nextLeft, 985);
    assert.equal(reverse.direction, -1);
    assert.notEqual(reverse.nextLeft, 0);
  });

  it("reverses at the start while moving left", () => {
    const atStart = advanceRailDrift({
      scrollLeft: 5,
      maxScroll: 1000,
      direction: -1,
      deltaSeconds: 1,
    });
    assert.equal(atStart.nextLeft, 0);
    assert.equal(atStart.direction, 1);
  });
});

describe("content rail motion wiring", () => {
  it("resumes after a multi-second idle delay instead of stopping forever", () => {
    assert.equal(RAIL_RESUME_IDLE_MS, 4500);
    const source = read("components/report/content/content-rail.tsx");
    assert.match(source, /scheduleResume/);
    assert.match(source, /RAIL_RESUME_IDLE_MS/);
    assert.equal(source.includes("driftStoppedRef"), false);
    assert.match(source, /el\.scrollLeft = position/);
  });

  it("pauses on pointer enter / drag / wheel / focus and resumes after idle", () => {
    const source = read("components/report/content/content-rail.tsx");
    assert.match(source, /pointerInsideRef/);
    assert.match(source, /pauseForInteraction/);
    assert.match(source, /onPointerEnter/);
    assert.match(source, /onPointerLeave/);
    assert.match(source, /onWheel=\{/);
    assert.match(source, /scrollByPage/);
    assert.match(source, /scheduleResume/);
  });

  it("does not permanently lock desktop autoplay from touch capability", () => {
    const source = read("components/report/content/content-rail.tsx");
    assert.match(source, /touchActiveRef/);
    assert.equal(source.includes("touchLockedRef"), false);
    assert.match(source, /shouldEnableRailAutoplay/);
  });

  it("cancels rAF and resume timers on cleanup", () => {
    const source = read("components/report/content/content-rail.tsx");
    assert.match(source, /cancelAnimationFrame\(frame\)/);
    assert.match(source, /clearResumeTimer\(\)/);
    assert.match(source, /observer\.disconnect\(\)/);
  });

  it("speeds up the hero marquee and still resumes after hover", () => {
    const css = read("app/globals.css");
    assert.match(
      css,
      /\.report-creator-showcase--motion \.report-creator-showcase__list[\s\S]*?animation: report-avatar-marquee 78s/
    );
    assert.match(css, /animation-duration: 92s/);
    assert.match(
      css,
      /\.report-creator-showcase--motion:hover \.report-creator-showcase__list[\s\S]*?animation-play-state: paused/
    );
    // Leave resumes via CSS — no permanent paused class.
    assert.equal(css.includes("animation-play-state: paused !important"), false);
  });
});
