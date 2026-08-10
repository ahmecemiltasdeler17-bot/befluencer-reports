"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Children,
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

/** Ambient drift — lively but not a conveyor belt. */
export const AUTO_DRIFT_PX_PER_SECOND = 15;
/** Resume autoplay this long after the last deliberate interaction. */
export const RAIL_RESUME_IDLE_MS = 4500;
const DRAG_THRESHOLD_PX = 4;
const EDGE_TOLERANCE_PX = 2;

interface ContentRailProps {
  /** Accessible name, e.g. the category label. */
  label: string;
  children: ReactNode;
  /** Ambient drift is opt-out for short rails that never overflow. */
  autoDrift?: boolean;
}

/**
 * Pure-touch / coarse-only devices skip ambient autoplay.
 *
 * Hybrid Windows laptops expose touch APIs but still have a fine pointer —
 * those MUST keep autoplay. Never gate on broad touch-capability sniffing.
 */
export function shouldEnableRailAutoplay(
  matchMedia: ((query: string) => MediaQueryList) | undefined
): boolean {
  if (typeof matchMedia !== "function") return false;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return false;

  const hasFinePointer = matchMedia("(any-pointer: fine)").matches;
  const coarsePrimary = matchMedia("(pointer: coarse)").matches;

  // Phones / pure touch: no ambient drift. Mouse + hybrid: allow.
  if (coarsePrimary && !hasFinePointer) return false;

  return true;
}

/** Apply one ambient drift step. Mutates `direction` via return value. */
export function advanceRailDrift(input: {
  scrollLeft: number;
  maxScroll: number;
  direction: 1 | -1;
  deltaSeconds: number;
  pxPerSecond?: number;
  edgeTolerance?: number;
}): { nextLeft: number; direction: 1 | -1 } {
  const pxPerSecond = input.pxPerSecond ?? AUTO_DRIFT_PX_PER_SECOND;
  const edge = input.edgeTolerance ?? EDGE_TOLERANCE_PX;

  if (input.maxScroll <= 0) {
    return { nextLeft: 0, direction: input.direction };
  }

  let nextLeft =
    input.scrollLeft + input.direction * pxPerSecond * input.deltaSeconds;
  let direction = input.direction;

  if (nextLeft >= input.maxScroll - edge) {
    nextLeft = input.maxScroll;
    direction = -1;
  } else if (nextLeft <= edge) {
    nextLeft = 0;
    direction = 1;
  }

  return { nextLeft, direction };
}

/**
 * Horizontal catalog rail built on native overflow scrolling.
 *
 * Autoplay pauses on interaction and resumes after an idle delay once the
 * pointer leaves. Vertical wheel input is never intercepted. Print/PDF turns
 * the viewport into a static grid via CSS so every card remains visible.
 */
export function ContentRail({
  label,
  children,
  autoDrift = true,
}: ContentRailProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [dragging, setDragging] = useState(false);

  const dragState = useRef({ active: false, startX: 0, startLeft: 0 });
  const movedRef = useRef(false);
  const driftPausedRef = useRef(false);
  const pointerInsideRef = useRef(false);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const directionRef = useRef<1 | -1>(1);
  /** Set only while an actual touch gesture is in progress — never by capability. */
  const touchActiveRef = useRef(false);

  const clearResumeTimer = useCallback(() => {
    if (resumeTimerRef.current !== null) {
      clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
  }, []);

  const scheduleResume = useCallback(() => {
    clearResumeTimer();
    if (touchActiveRef.current) return;
    if (pointerInsideRef.current || dragState.current.active) return;

    resumeTimerRef.current = setTimeout(() => {
      resumeTimerRef.current = null;
      if (
        touchActiveRef.current ||
        pointerInsideRef.current ||
        dragState.current.active
      ) {
        return;
      }
      driftPausedRef.current = false;
    }, RAIL_RESUME_IDLE_MS);
  }, [clearResumeTimer]);

  const pauseForInteraction = useCallback(() => {
    driftPausedRef.current = true;
    clearResumeTimer();
  }, [clearResumeTimer]);

  const syncEdges = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > EDGE_TOLERANCE_PX);
    setCanScrollRight(el.scrollLeft < maxScroll - EDGE_TOLERANCE_PX);
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        syncEdges();
      });
    };

    syncEdges();
    el.addEventListener("scroll", onScroll, { passive: true });

    const observer = new ResizeObserver(onScroll);
    observer.observe(el);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      el.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, [syncEdges]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el || !autoDrift) return;
    if (!shouldEnableRailAutoplay(window.matchMedia.bind(window))) return;

    let frame = 0;
    let lastTime = 0;
    let visible = false;
    let position = el.scrollLeft;

    const step = (time: number) => {
      frame = 0;
      if (!visible) return;

      const delta = lastTime ? (time - lastTime) / 1000 : 0;
      lastTime = time;

      if (driftPausedRef.current) {
        position = el.scrollLeft;
      } else if (delta > 0 && delta < 0.25) {
        const maxScroll = el.scrollWidth - el.clientWidth;
        if (maxScroll > 0) {
          const advanced = advanceRailDrift({
            scrollLeft: position,
            maxScroll,
            direction: directionRef.current,
            deltaSeconds: delta,
          });
          position = advanced.nextLeft;
          directionRef.current = advanced.direction;
          // Direct assignment bypasses CSS `scroll-behavior: smooth`, which
          // otherwise fights per-frame ambient drift and looks frozen.
          el.scrollLeft = position;
        }
      }

      frame = requestAnimationFrame(step);
    };

    const start = () => {
      if (frame) return;
      lastTime = 0;
      position = el.scrollLeft;
      frame = requestAnimationFrame(step);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? false;
        if (visible) {
          start();
        } else if (frame) {
          cancelAnimationFrame(frame);
          frame = 0;
          lastTime = 0;
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      clearResumeTimer();
    };
  }, [autoDrift, clearResumeTimer]);

  const scrollByPage = useCallback(
    (direction: -1 | 1) => {
      const el = viewportRef.current;
      if (!el) return;
      pauseForInteraction();
      directionRef.current = direction;
      el.scrollBy({ left: direction * el.clientWidth * 0.85 });
      scheduleResume();
    },
    [pauseForInteraction, scheduleResume]
  );

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch") {
      touchActiveRef.current = true;
      pauseForInteraction();
      return;
    }
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    const el = viewportRef.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;

    pauseForInteraction();
    dragState.current = {
      active: true,
      startX: event.clientX,
      startLeft: el.scrollLeft,
    };
    movedRef.current = false;
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const el = viewportRef.current;
    if (!el || !dragState.current.active) return;

    const distance = event.clientX - dragState.current.startX;
    if (!movedRef.current && Math.abs(distance) < DRAG_THRESHOLD_PX) return;

    if (!movedRef.current) {
      movedRef.current = true;
      setDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    el.scrollLeft = dragState.current.startLeft - distance;
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch") {
      touchActiveRef.current = false;
      // After a real touch gesture, resume only after idle if a fine pointer exists.
      if (shouldEnableRailAutoplay(window.matchMedia.bind(window))) {
        scheduleResume();
      }
      return;
    }

    if (!dragState.current.active) return;
    dragState.current.active = false;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!pointerInsideRef.current) {
      scheduleResume();
    }
  }

  function handleClickCapture(event: ReactMouseEvent<HTMLDivElement>) {
    if (!movedRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    movedRef.current = false;
  }

  const scrollable = canScrollLeft || canScrollRight;

  return (
    <div
      className="report-rail"
      data-report-rail=""
      data-scrollable={scrollable ? "true" : "false"}
      data-at-start={canScrollLeft ? "false" : "true"}
      data-at-end={canScrollRight ? "false" : "true"}
      data-dragging={dragging ? "true" : "false"}
      data-resume-idle-ms={String(RAIL_RESUME_IDLE_MS)}
      data-drift-speed={String(AUTO_DRIFT_PX_PER_SECOND)}
      onPointerEnter={(event) => {
        // Ignore synthetic/touch enters so hybrid devices don't stick paused.
        if (event.pointerType === "touch") return;
        pointerInsideRef.current = true;
        pauseForInteraction();
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "touch") return;
        pointerInsideRef.current = false;
        scheduleResume();
      }}
      onFocusCapture={pauseForInteraction}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          scheduleResume();
        }
      }}
      onWheel={() => {
        pauseForInteraction();
        scheduleResume();
      }}
    >
      <button
        type="button"
        className="report-rail__nav report-rail__nav--prev report-interactive report-focus-ring screen-only"
        aria-label={`${label}: geri kaydır`}
        disabled={!canScrollLeft}
        onClick={() => scrollByPage(-1)}
      >
        <ChevronLeft className="size-4" aria-hidden />
      </button>

      <div
        ref={viewportRef}
        className="report-rail__viewport"
        role="group"
        aria-label={label}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={handleClickCapture}
        onDragStart={(event) => event.preventDefault()}
        onKeyDown={() => {
          pauseForInteraction();
          scheduleResume();
        }}
      >
        {Children.map(children, (child) => (
          <div className="report-rail__item">{child}</div>
        ))}
      </div>

      <button
        type="button"
        className="report-rail__nav report-rail__nav--next report-interactive report-focus-ring screen-only"
        aria-label={`${label}: ileri kaydır`}
        disabled={!canScrollRight}
        onClick={() => scrollByPage(1)}
      >
        <ChevronRight className="size-4" aria-hidden />
      </button>
    </div>
  );
}
