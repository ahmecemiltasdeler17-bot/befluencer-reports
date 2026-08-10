"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { createPublicReportShareAction } from "@/features/public-reports/actions";
import { ShareLinkResult } from "@/features/public-reports/components/share-link-result";
import type {
  CreatePublicReportShareResult,
  ShareExpirationPreset,
} from "@/features/public-reports/types";

export function CreateShareDialog({
  reportVersionId,
  disabled,
}: {
  reportVersionId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [expiration, setExpiration] = useState<ShareExpirationPreset>("7d");
  const [customExpiresAt, setCustomExpiresAt] = useState("");
  const [allowPdfDownload, setAllowPdfDownload] = useState(true);
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreatePublicReportShareResult | null>(
    null
  );

  function resetForm() {
    setExpiration("7d");
    setCustomExpiresAt("");
    setAllowPdfDownload(true);
    setLabel("");
    setError(null);
    setResult(null);
  }

  function handleClose() {
    setOpen(false);
    resetForm();
    router.refresh();
  }

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      let customIso: string | null = null;

      if (expiration === "custom") {
        if (!customExpiresAt) {
          setError("Özel bitiş tarihi gerekli.");
          return;
        }

        const parsed = new Date(customExpiresAt);

        if (!Number.isFinite(parsed.getTime())) {
          setError("Geçersiz bitiş tarihi.");
          return;
        }

        customIso = parsed.toISOString();
      }

      const response = await createPublicReportShareAction({
        reportVersionId,
        expiration,
        customExpiresAt: customIso,
        allowPdfDownload,
        label: label || null,
      });

      if (response.error) {
        setError(response.error);
        return;
      }

      if (response.result) {
        setResult(response.result);
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled}
        onClick={() => {
          resetForm();
          setOpen(true);
        }}
      >
        Paylaşım Linki Oluştur
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-share-title"
        >
          <div className="w-full max-w-md rounded-lg border border-bf-border bg-bf-elevated p-5 shadow-xl shadow-black/40">
            <h2
              id="create-share-title"
              className="text-sm font-semibold text-bf-text"
            >
              Paylaşım bağlantısı
            </h2>
            <p className="mt-1 text-xs text-bf-steel">
              Yalnızca bu dondurulmuş rapor sürümü paylaşılır. Canlı veri
              erişilemez.
            </p>

            {result ? (
              <div className="mt-4 space-y-4">
                <ShareLinkResult result={result} />
                <div className="flex justify-end">
                  <Button type="button" size="sm" onClick={handleClose}>
                    Kapat
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <label className="block space-y-1">
                  <span className="text-[11px] text-bf-steel">Süre</span>
                  <select
                    className="w-full rounded-lg border border-bf-border bg-bf-bg px-2 py-1.5 text-sm text-bf-text outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                    value={expiration}
                    onChange={(event) =>
                      setExpiration(event.target.value as ShareExpirationPreset)
                    }
                  >
                    <option value="never">Süresiz</option>
                    <option value="24h">24 saat</option>
                    <option value="7d">7 gün</option>
                    <option value="30d">30 gün</option>
                    <option value="custom">Özel tarih</option>
                  </select>
                </label>

                {expiration === "custom" ? (
                  <label className="block space-y-1">
                    <span className="text-[11px] text-bf-steel">
                      Bitiş (yerel saat)
                    </span>
                    <input
                      type="datetime-local"
                      className="w-full rounded-lg border border-bf-border bg-bf-bg px-2 py-1.5 text-sm text-bf-text outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                      value={customExpiresAt}
                      onChange={(event) =>
                        setCustomExpiresAt(event.target.value)
                      }
                    />
                  </label>
                ) : null}

                <label className="block space-y-1">
                  <span className="text-[11px] text-bf-steel">
                    Etiket (isteğe bağlı)
                  </span>
                  <input
                    type="text"
                    maxLength={120}
                    className="w-full rounded-lg border border-bf-border bg-bf-bg px-2 py-1.5 text-sm text-bf-text outline-none placeholder:text-bf-steel/60 focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                    value={label}
                    onChange={(event) => setLabel(event.target.value)}
                    placeholder="Örn. Müşteri paylaşımı"
                  />
                </label>

                <label className="flex items-center gap-2 text-sm text-bf-text/90">
                  <input
                    type="checkbox"
                    checked={allowPdfDownload}
                    onChange={(event) =>
                      setAllowPdfDownload(event.target.checked)
                    }
                    className="accent-primary"
                  />
                  PDF indirmeye izin ver
                </label>

                {error ? (
                  <p className="text-xs text-red-400">{error}</p>
                ) : null}

                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={isPending}
                    onClick={handleClose}
                  >
                    Vazgeç
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={isPending}
                    onClick={handleCreate}
                  >
                    {isPending ? "Oluşturuluyor…" : "Oluştur"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
