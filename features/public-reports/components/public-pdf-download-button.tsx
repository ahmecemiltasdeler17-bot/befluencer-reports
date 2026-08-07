"use client";

import { Download } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { PUBLIC_SHARE_UNAVAILABLE_MESSAGE } from "@/features/public-reports/errors";

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" && body.error.length > 0
      ? body.error
      : PUBLIC_SHARE_UNAVAILABLE_MESSAGE;
  } catch {
    return PUBLIC_SHARE_UNAVAILABLE_MESSAGE;
  }
}

function filenameFromDisposition(header: string | null, fallback: string): string {
  const match = header?.match(/filename="([^"]+)"/);
  return match?.[1] ?? fallback;
}

/**
 * Downloads PDF for the current public share. Uses POST so prefetch cannot
 * trigger generation or access increments.
 */
export function PublicPdfDownloadButton({
  versionNumber,
}: {
  versionNumber: number;
}) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  async function handleClick() {
    if (isPending) {
      return;
    }

    setIsPending(true);
    setError(null);

    try {
      const token = window.location.pathname.split("/").filter(Boolean).pop();

      if (!token) {
        setError(PUBLIC_SHARE_UNAVAILABLE_MESSAGE);
        return;
      }

      const response = await fetch(`/api/public/reports/${token}/pdf`, {
        method: "POST",
        headers: { Accept: "application/pdf" },
      });

      if (!response.ok) {
        setError(await readErrorMessage(response));
        return;
      }

      const blob = await response.blob();
      const filename = filenameFromDisposition(
        response.headers.get("Content-Disposition"),
        `befluencer-report-v${versionNumber}.pdf`
      );

      const objectUrl = URL.createObjectURL(blob);
      objectUrlRef.current = objectUrl;

      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.setTimeout(() => {
        if (objectUrlRef.current === objectUrl) {
          URL.revokeObjectURL(objectUrl);
          objectUrlRef.current = null;
        }
      }, 4000);
    } catch {
      setError(PUBLIC_SHARE_UNAVAILABLE_MESSAGE);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="print:hidden">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        aria-busy={isPending}
        onClick={handleClick}
      >
        <Download className="size-3.5 shrink-0" aria-hidden="true" />
        {isPending ? "PDF hazırlanıyor…" : "PDF İndir"}
      </Button>
      {error ? <p className="mt-1.5 text-xs text-red-400">{error}</p> : null}
    </div>
  );
}
