"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { revokePublicReportShareAction } from "@/features/public-reports/actions";
import { CreateShareDialog } from "@/features/public-reports/components/create-share-dialog";
import { ShareStatusBadge } from "@/features/public-reports/components/share-status-badge";
import type { PublicReportShareSummary } from "@/features/public-reports/types";

function formatDateTime(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function ShareList({
  reportVersionId,
  shares,
  canCreate,
}: {
  reportVersionId: string;
  shares: PublicReportShareSummary[];
  canCreate: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleRevoke(shareId: string) {
    const confirmed = window.confirm(
      "Bu paylaşım bağlantısını iptal etmek istediğinize emin misiniz? Alıcılar hemen erişimi kaybeder."
    );

    if (!confirmed) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await revokePublicReportShareAction(shareId);

      if (result.error) {
        setError(result.error);
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          className="text-xs text-zinc-500 transition-colors hover:text-zinc-300"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Paylaşım Linklerini Gizle" : "Paylaşım Linkleri"}
          {shares.length > 0 ? ` (${shares.length})` : ""}
        </button>
        {canCreate ? (
          <CreateShareDialog reportVersionId={reportVersionId} />
        ) : null}
      </div>

      {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}

      {open ? (
        <div className="mt-3 overflow-x-auto rounded-md border border-zinc-800">
          {shares.length === 0 ? (
            <p className="px-3 py-4 text-xs text-zinc-500">
              Bu sürüm için henüz paylaşım bağlantısı yok. Kaybedilen bağlantılar
              yeniden görüntülenemez — yeni bir bağlantı oluşturun.
            </p>
          ) : (
            <table className="w-full min-w-[640px] text-left text-xs text-zinc-300">
              <thead className="border-b border-zinc-800 text-[10px] tracking-wide text-zinc-500 uppercase">
                <tr>
                  <th className="px-3 py-2 font-medium">Etiket</th>
                  <th className="px-3 py-2 font-medium">Oluşturulma</th>
                  <th className="px-3 py-2 font-medium">Bitiş</th>
                  <th className="px-3 py-2 font-medium">Durum</th>
                  <th className="px-3 py-2 font-medium">Son erişim</th>
                  <th className="px-3 py-2 font-medium">Erişim</th>
                  <th className="px-3 py-2 font-medium">PDF</th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {shares.map((share) => (
                  <tr key={share.id} className="border-b border-zinc-900/80">
                    <td className="px-3 py-2">{share.label ?? "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {formatDateTime(share.createdAt)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {share.expiresAt
                        ? formatDateTime(share.expiresAt)
                        : "Süresiz"}
                    </td>
                    <td className="px-3 py-2">
                      <ShareStatusBadge status={share.status} />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {formatDateTime(share.lastAccessedAt)}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {share.accessCount}
                    </td>
                    <td className="px-3 py-2">
                      {share.allowPdfDownload ? "Açık" : "Kapalı"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {share.status === "active" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={isPending}
                          className="text-red-400 hover:text-red-300"
                          onClick={() => handleRevoke(share.id)}
                        >
                          İptal et
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="border-t border-zinc-800 px-3 py-2 text-[11px] text-zinc-600">
            Ham bağlantı yalnızca oluşturma anında gösterilir. Kaybedilen URL
            için yeni paylaşım oluşturun.
          </p>
        </div>
      ) : null}
    </div>
  );
}
