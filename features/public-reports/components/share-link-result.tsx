"use client";

import { ExternalLink } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { CreatePublicReportShareResult } from "@/features/public-reports/types";

export function ShareLinkResult({
  result,
}: {
  result: CreatePublicReportShareResult;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(result.publicUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-3 rounded-md border border-orange-500/30 bg-orange-500/5 p-3">
      <p className="text-xs text-orange-200/90">
        Bu bağlantı daha sonra tekrar görüntülenemez. Kaybetmeniz halinde yeni
        bağlantı oluşturmanız gerekir.
      </p>
      <div className="break-all rounded bg-zinc-950/80 px-2.5 py-2 font-mono text-[11px] text-zinc-200">
        {result.publicUrl}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={handleCopy}>
          {copied ? "Kopyalandı" : "Kopyala"}
        </Button>
        <a
          href={result.publicUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex"
        >
          <Button type="button" size="sm" variant="ghost">
            <ExternalLink className="size-3.5" aria-hidden="true" />
            Yeni sekmede aç
          </Button>
        </a>
      </div>
    </div>
  );
}
