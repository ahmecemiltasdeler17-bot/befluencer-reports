"use client";

import { useEffect, useState } from "react";

import { PDF_READY_ATTRIBUTE } from "@/features/pdf/constants";

/**
 * Deterministic readiness signal for the PDF generator.
 *
 * Waits for fonts, for every image to settle (loaded or failed), and then for a
 * bounded settle delay that lets chart enter animations finish. Every wait is
 * capped so a broken remote image can never block the export.
 */
export function PdfReadyMarker({
  chartSettleMs = 1800,
  assetTimeoutMs = 8000,
}: {
  chartSettleMs?: number;
  assetTimeoutMs?: number;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    function bounded<T>(promise: Promise<T>): Promise<unknown> {
      return Promise.race([
        promise,
        new Promise((resolve) => {
          timers.push(setTimeout(resolve, assetTimeoutMs));
        }),
      ]);
    }

    async function waitForAssets() {
      await bounded(document.fonts.ready);

      const pending = Array.from(document.images).filter(
        (image) => !image.complete
      );

      await bounded(
        Promise.all(
          pending.map(
            (image) =>
              new Promise<void>((resolve) => {
                image.addEventListener("load", () => resolve(), { once: true });
                image.addEventListener("error", () => resolve(), { once: true });
              })
          )
        )
      );
    }

    void waitForAssets()
      .catch(() => undefined)
      .then(() => {
        if (cancelled) {
          return;
        }

        // Two frames plus a settle delay so chart geometry is final.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            timers.push(
              setTimeout(() => {
                if (!cancelled) {
                  setReady(true);
                }
              }, chartSettleMs)
            );
          });
        });
      });

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [assetTimeoutMs, chartSettleMs]);

  return (
    <span
      {...{ [PDF_READY_ATTRIBUTE]: ready ? "true" : "false" }}
      aria-hidden="true"
      className="sr-only"
    />
  );
}
