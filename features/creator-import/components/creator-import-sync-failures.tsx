"use client";

import { buttonVariants } from "@/components/ui/button";
import type { CreatorImportSyncRow } from "@/features/creator-import/types";
import { cn } from "@/lib/utils";

export function CreatorImportSyncFailures({
  failedRows,
  isPending,
  onRetryAll,
  onRetryOne,
}: {
  failedRows: CreatorImportSyncRow[];
  isPending: boolean;
  onRetryAll: () => void;
  onRetryOne: (creatorId: string) => void;
}) {
  if (failedRows.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-lg border border-red-500/20 bg-red-500/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-white">Başarısız Profiller</h3>
          <p className="mt-1 text-xs text-zinc-500">
            {failedRows.length} profil güncellenemedi. Başarılı güncellemeler
            korundu.
          </p>
        </div>
        <button
          type="button"
          disabled={isPending}
          onClick={onRetryAll}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "disabled:opacity-50"
          )}
        >
          {isPending ? "Yeniden deneniyor…" : "Tüm Başarısızları Tekrar Dene"}
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-800">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-800 text-sm">
            <thead className="bg-zinc-950/80">
              <tr className="text-left text-zinc-400">
                <th className="px-3 py-2 font-medium">Kullanıcı adı</th>
                <th className="px-3 py-2 font-medium">Profil bağlantısı</th>
                <th className="px-3 py-2 font-medium">Hata</th>
                <th className="px-3 py-2 font-medium text-right">Tekrar dene</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80 bg-zinc-950/40">
              {failedRows.map((row) => (
                <tr key={row.creatorId} className="text-zinc-200">
                  <td className="px-3 py-2 font-medium text-white">
                    @{row.username}
                  </td>
                  <td className="max-w-[220px] truncate px-3 py-2 text-xs">
                    {row.profileUrl ? (
                      <a
                        href={row.profileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:text-[var(--bf-accent-soft)]"
                      >
                        {row.profileUrl}
                      </a>
                    ) : (
                      <span className="text-zinc-500">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-red-300">
                    {row.errorMessage ?? "Profil güncellenemedi."}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => onRetryOne(row.creatorId)}
                      className={cn(
                        buttonVariants({ variant: "ghost", size: "sm" }),
                        "disabled:opacity-50"
                      )}
                    >
                      Tekrar Dene
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
