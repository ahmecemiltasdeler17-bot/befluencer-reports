"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { createCreatorListShareAction } from "@/features/creator-lists/actions";
import type {
  CreateCreatorListShareResult,
  ShareExpirationPreset,
} from "@/features/creator-lists/types";
import { ShareLinkResult } from "@/features/public-reports/components/share-link-result";

export function CreateListShareDialog({
  listId,
  disabled,
}: {
  listId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [expiration, setExpiration] = useState<ShareExpirationPreset>("7d");
  const [customExpiresAt, setCustomExpiresAt] = useState("");
  const [allowCsvDownload, setAllowCsvDownload] = useState(true);
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateCreatorListShareResult | null>(
    null
  );

  function resetForm() {
    setExpiration("7d");
    setCustomExpiresAt("");
    setAllowCsvDownload(true);
    setLabel("");
    setError(null);
    setResult(null);
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

      const response = await createCreatorListShareAction({
        listId,
        expiration,
        customExpiresAt: customIso,
        allowCsvDownload,
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
          aria-labelledby="create-list-share-title"
        >
          <div className="w-full max-w-md space-y-4 rounded-lg border border-bf-border bg-bf-elevated p-5 shadow-xl shadow-black/40">
            <div>
              <h2
                id="create-list-share-title"
                className="text-sm font-semibold text-bf-text"
              >
                Creator listesi paylaşımı
              </h2>
              <p className="mt-1 text-xs text-bf-steel">
                Üyelik sabittir; takipçi ve avatar canlı veriden gelir. Ham
                bağlantı yalnızca bir kez gösterilir.
              </p>
            </div>

            {result ? (
              <>
                <ShareLinkResult
                  result={{
                    shareId: result.shareId,
                    publicUrl: result.publicUrl,
                    expiresAt: result.expiresAt,
                    allowPdfDownload: result.allowCsvDownload,
                  }}
                />
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      setOpen(false);
                      resetForm();
                      router.refresh();
                    }}
                  >
                    Tamam
                  </Button>
                </div>
              </>
            ) : (
              <>
                <label className="block space-y-1 text-xs text-bf-steel">
                  Süre
                  <select
                    value={expiration}
                    onChange={(event) =>
                      setExpiration(event.target.value as ShareExpirationPreset)
                    }
                    className="h-10 w-full rounded-lg border border-bf-border bg-bf-bg px-3 text-sm text-bf-text outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="never">Süresiz</option>
                    <option value="24h">24 saat</option>
                    <option value="7d">7 gün</option>
                    <option value="30d">30 gün</option>
                    <option value="custom">Özel</option>
                  </select>
                </label>

                {expiration === "custom" ? (
                  <label className="block space-y-1 text-xs text-bf-steel">
                    Bitiş
                    <input
                      type="datetime-local"
                      value={customExpiresAt}
                      onChange={(event) =>
                        setCustomExpiresAt(event.target.value)
                      }
                      className="h-10 w-full rounded-lg border border-bf-border bg-bf-bg px-3 text-sm text-bf-text outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                    />
                  </label>
                ) : null}

                <label className="flex items-center gap-2 text-xs text-bf-text/90">
                  <input
                    type="checkbox"
                    checked={allowCsvDownload}
                    onChange={(event) =>
                      setAllowCsvDownload(event.target.checked)
                    }
                    className="accent-primary"
                  />
                  CSV indirmeye izin ver
                </label>

                <label className="block space-y-1 text-xs text-bf-steel">
                  Etiket (opsiyonel)
                  <input
                    value={label}
                    onChange={(event) => setLabel(event.target.value)}
                    maxLength={120}
                    className="h-10 w-full rounded-lg border border-bf-border bg-bf-bg px-3 text-sm text-bf-text outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                  />
                </label>

                {error ? <p className="text-xs text-red-400">{error}</p> : null}

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setOpen(false);
                      resetForm();
                    }}
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
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
