"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import { buttonVariants } from "@/components/ui/button";
import {
  importCreatorsAction,
  previewCreatorImportAction,
  syncImportedCreatorsAction,
} from "@/features/creator-import/actions";
import { CreatorImportSyncFailures } from "@/features/creator-import/components/creator-import-sync-failures";
import {
  failedCreatorIdsFromSyncResult,
  mergeCreatorImportSyncResults,
} from "@/features/creator-import/sync-result";
import {
  CREATOR_IMPORT_STATUS_LABELS,
  type CreatorImportInsertResult,
  type CreatorImportPreview,
  type CreatorImportSyncResult,
} from "@/features/creator-import/types";
import { cn } from "@/lib/utils";

type Step = "input" | "preview" | "result";

export function CreatorImportForm() {
  const [text, setText] = useState("");
  const [step, setStep] = useState<Step>("input");
  const [preview, setPreview] = useState<CreatorImportPreview | null>(null);
  const [importResult, setImportResult] =
    useState<CreatorImportInsertResult | null>(null);
  const [syncResult, setSyncResult] = useState<CreatorImportSyncResult | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const readyCount = preview?.totals.ready ?? 0;

  const statusTone = useMemo(
    () =>
      ({
        ready: "text-emerald-400",
        existing: "text-zinc-400",
        duplicate_in_list: "text-amber-400",
        invalid_link: "text-red-400",
        username_unextracted: "text-red-400",
      }) as const,
    []
  );

  function handleFile(file: File | null) {
    setError(null);

    if (!file) {
      return;
    }

    const lower = file.name.toLowerCase();

    if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
      setError(
        "Excel (.xlsx) şu an desteklenmiyor. Lütfen CSV yükleyin veya bağlantıları yapıştırın."
      );
      return;
    }

    if (!lower.endsWith(".csv") && file.type !== "text/csv") {
      setError("Yalnızca .csv dosyaları yüklenebilir.");
      return;
    }

    if (file.size > 250_000) {
      setError("Dosya çok büyük. En fazla 250 KB yükleyebilirsiniz.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === "string" ? reader.result : "";
      setText(content);
      setStep("input");
      setPreview(null);
      setImportResult(null);
      setSyncResult(null);
    };
    reader.onerror = () => {
      setError("Dosya okunamadı.");
    };
    reader.readAsText(file);
  }

  function handlePreview() {
    setError(null);
    startTransition(async () => {
      const result = await previewCreatorImportAction(text);
      if (result.error) {
        setError(result.error);
        setPreview(null);
        return;
      }
      setPreview(result);
      setStep("preview");
    });
  }

  function handleImport() {
    setError(null);
    startTransition(async () => {
      const result = await importCreatorsAction(text);
      if (result.error) {
        setError(result.error);
        return;
      }
      setImportResult(result);
      setStep("result");
    });
  }

  const failedSyncRows = useMemo(
    () => (syncResult?.rows ?? []).filter((row) => row.status === "failed"),
    [syncResult]
  );

  function handleSync() {
    if (!importResult?.insertedIds.length) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await syncImportedCreatorsAction(importResult.insertedIds);
      if (result.error && result.rows.length === 0) {
        setError(result.error);
        return;
      }
      setSyncResult(result);
    });
  }

  function handleRetryFailedIds(creatorIds: string[]) {
    if (creatorIds.length === 0 || !syncResult) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const retry = await syncImportedCreatorsAction(creatorIds);
      if (retry.error && retry.rows.length === 0) {
        setError(retry.error);
        return;
      }
      setSyncResult(mergeCreatorImportSyncResults(syncResult, retry));
    });
  }

  function handleRetryAllFailed() {
    if (!syncResult) {
      return;
    }
    handleRetryFailedIds(failedCreatorIdsFromSyncResult(syncResult));
  }

  function handleRetryOne(creatorId: string) {
    handleRetryFailedIds([creatorId]);
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {step === "input" && (
        <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-6">
          <div>
            <h2 className="text-base font-medium text-white">
              TikTok profil bağlantılarını yapıştırın
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Her satıra bir bağlantı. Markdown bağlantıları, takip parametreli
              URL’ler ve Google yönlendirme linkleri kabul edilir. Ücret sütunları
              yok sayılır.
            </p>
          </div>

          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={14}
            spellCheck={false}
            placeholder={`https://www.tiktok.com/@ornek\nhttps://www.tiktok.com/@baska_ornek?is_from_webapp=1\n[https://www.tiktok.com/@ucuncu](https://www.tiktok.com/@ucuncu)`}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-3 font-mono text-sm text-white outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
          />

          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-zinc-400">
              <span className={cn(buttonVariants({ variant: "outline" }), "cursor-pointer")}>
                CSV Yükle
              </span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
              />
            </label>
            <p className="text-xs text-zinc-500">
              .xlsx desteklenmiyor — CSV veya yapıştırma kullanın.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isPending || text.trim().length === 0}
              onClick={handlePreview}
              className={cn(
                buttonVariants({ variant: "default" }),
                "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              )}
            >
              {isPending ? "Hazırlanıyor…" : "Önizleme"}
            </button>
            <Link
              href="/creators"
              className={cn(buttonVariants({ variant: "ghost" }))}
            >
              İptal
            </Link>
          </div>
        </section>
      )}

      {step === "preview" && preview && (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Stat label="Toplam satır" value={preview.totals.total} />
            <Stat label="Yeni (hazır)" value={preview.totals.ready} accent />
            <Stat label="Sistemde mevcut" value={preview.totals.existing} />
            <Stat label="Listede tekrar" value={preview.totals.duplicateInList} />
            <Stat label="Geçersiz" value={preview.totals.invalid} />
          </div>

          <p className="text-sm text-zinc-400">
            Kategori, profil senkronizasyonundan sonra otomatik belirlenecek.
          </p>

          <div className="overflow-hidden rounded-xl border border-zinc-800">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-800 text-sm">
                <thead className="bg-zinc-950/80">
                  <tr className="text-left text-zinc-400">
                    <th className="px-4 py-3 font-medium">Original satır</th>
                    <th className="px-4 py-3 font-medium">Kullanıcı adı</th>
                    <th className="px-4 py-3 font-medium">Görünen ad</th>
                    <th className="px-4 py-3 font-medium">Temiz profil linki</th>
                    <th className="px-4 py-3 font-medium">Durum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80 bg-zinc-950/40">
                  {preview.rows.map((row) => (
                    <tr key={row.rowNumber} className="text-zinc-200">
                      <td className="max-w-[240px] truncate px-4 py-3 font-mono text-xs text-zinc-400">
                        {row.original}
                      </td>
                      <td className="px-4 py-3">
                        {row.username ? `@${row.username}` : "—"}
                      </td>
                      <td className="px-4 py-3">{row.displayName ?? "—"}</td>
                      <td className="max-w-[260px] truncate px-4 py-3 text-xs">
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
                          "—"
                        )}
                      </td>
                      <td className={cn("px-4 py-3", statusTone[row.status])}>
                        {CREATOR_IMPORT_STATUS_LABELS[row.status]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isPending || readyCount === 0}
              onClick={handleImport}
              className={cn(
                buttonVariants({ variant: "default" }),
                "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              )}
            >
              {isPending
                ? "İçe aktarılıyor…"
                : `${readyCount} Yeni Creatorı İçe Aktar`}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                setStep("input");
                setPreview(null);
              }}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              Düzenle
            </button>
            <Link
              href="/creators"
              className={cn(buttonVariants({ variant: "ghost" }))}
            >
              İptal
            </Link>
          </div>
        </section>
      )}

      {step === "result" && importResult && (
        <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-6">
          <div>
            <h2 className="text-base font-medium text-white">İçe aktarma sonucu</h2>
            {importResult.message && (
              <p className="mt-2 text-sm text-zinc-300">{importResult.message}</p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Stat label="Toplam satır" value={importResult.total} />
            <Stat label="Eklenen" value={importResult.inserted} accent />
            <Stat label="Mevcut atlandı" value={importResult.skippedExisting} />
            <Stat label="Tekrar atlandı" value={importResult.skippedDuplicate} />
            <Stat
              label="Geçersiz / hatalı"
              value={importResult.invalid + importResult.failed}
            />
          </div>

          {importResult.insertedIds.length > 0 && (
            <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
              <p className="text-sm text-zinc-300">
                Yeni eklenen TikTok profillerini sağlayıcıdan güncelleyebilirsiniz.
              </p>
              <p className="text-xs text-amber-400/90">
                Bu işlem her creator için sağlayıcı isteği oluşturur.
              </p>
              <button
                type="button"
                disabled={isPending}
                onClick={handleSync}
                className={cn(
                  buttonVariants({ variant: "default" }),
                  "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                )}
              >
                {isPending
                  ? "Güncelleniyor…"
                  : "Yeni Eklenen TikTok Profillerini Güncelle"}
              </button>
              {syncResult && (
                <div className="space-y-3">
                  <p className="text-sm text-zinc-400">
                    {syncResult.message ??
                      `${syncResult.success}/${syncResult.total} başarılı`}
                  </p>
                  <CreatorImportSyncFailures
                    failedRows={failedSyncRows}
                    isPending={isPending}
                    onRetryAll={handleRetryAllFailed}
                    onRetryOne={handleRetryOne}
                  />
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Link
              href="/creators"
              className={cn(
                buttonVariants({ variant: "default" }),
                "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
            >
              Creator Listesine Dön
            </Link>
            <button
              type="button"
              onClick={() => {
                setText("");
                setPreview(null);
                setImportResult(null);
                setSyncResult(null);
                setStep("input");
              }}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              Yeni İçe Aktarma
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-4 py-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p
        className={cn(
          "mt-1 text-xl font-semibold tabular-nums",
          accent ? "text-primary" : "text-white"
        )}
      >
        {value}
      </p>
    </div>
  );
}
