"use client";

import { Download } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { PdfExportFeedback } from "@/features/pdf/components/pdf-export-feedback";

const GENERIC_ERROR = "PDF oluşturulamadı. Lütfen tekrar deneyin.";

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" && body.error.length > 0
      ? body.error
      : GENERIC_ERROR;
  } catch {
    return GENERIC_ERROR;
  }
}

function filenameFromDisposition(header: string | null, fallback: string): string {
  const match = header?.match(/filename="([^"]+)"/);
  return match?.[1] ?? fallback;
}

export function DownloadReportPdfButton({
  campaignId,
  versionId,
  versionNumber,
  status,
  variant = "outline",
  size = "sm",
  label = "PDF İndir",
}: {
  campaignId: string;
  versionId: string;
  versionNumber: number;
  status: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm";
  label?: string;
}) {
  const [isPending, setIsPending] = useState(false);
  const [feedback, setFeedback] = useState<{ success?: string; error?: string }>({});
  const objectUrlRef = useRef<string | null>(null);

  const canExport = status === "ready" || status === "archived";

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  async function handleClick() {
    if (isPending || !canExport) {
      return;
    }

    setIsPending(true);
    setFeedback({});

    try {
      const response = await fetch(
        `/api/campaigns/${campaignId}/reports/${versionId}/pdf`,
        { method: "POST", headers: { Accept: "application/pdf" } }
      );

      if (!response.ok) {
        setFeedback({ error: await readErrorMessage(response) });
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

      // Revoke after the download has been handed to the browser.
      window.setTimeout(() => {
        if (objectUrlRef.current === objectUrl) {
          URL.revokeObjectURL(objectUrl);
          objectUrlRef.current = null;
        }
      }, 4000);

      setFeedback({ success: "PDF indirildi." });
    } catch {
      setFeedback({ error: GENERIC_ERROR });
    } finally {
      setIsPending(false);
    }
  }

  if (!canExport) {
    return null;
  }

  return (
    <div className="print:hidden">
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={isPending}
        aria-busy={isPending}
        onClick={handleClick}
      >
        <Download className="size-3.5 shrink-0" aria-hidden="true" />
        {isPending ? "PDF hazırlanıyor…" : label}
      </Button>
      <PdfExportFeedback {...feedback} className="mt-1.5" />
    </div>
  );
}
