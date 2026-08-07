"use client";

import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { addCreatorListToCampaignAction } from "@/features/creator-lists/actions";

export function AddListToCampaignDialog({
  listId,
  creatorCount,
  campaigns,
  disabled,
}: {
  listId: string;
  creatorCount: number;
  campaigns: Array<{ id: string; name: string }>;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === campaignId) ?? null,
    [campaignId, campaigns]
  );

  function handleConfirm() {
    setError(null);
    setSummary(null);
    startTransition(async () => {
      const result = await addCreatorListToCampaignAction({
        listId,
        campaignId,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      if (result.campaignSummary) {
        setSummary(
          `${result.campaignSummary.newlyAssignedCount} yeni atama · ${result.campaignSummary.alreadyAssignedCount} zaten kampanyada · ${result.campaignSummary.selectedCount} toplam`
        );
      } else {
        setSummary(result.success ?? "Tamamlandı.");
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled || creatorCount === 0 || campaigns.length === 0}
        onClick={() => {
          setError(null);
          setSummary(null);
          setCampaignId(campaigns[0]?.id ?? "");
          setOpen(true);
        }}
      >
        Kampanyaya Ekle
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-list-campaign-title"
        >
          <div className="w-full max-w-md space-y-4 rounded-lg border border-zinc-800 bg-zinc-950 p-5 shadow-xl">
            <div>
              <h2
                id="add-list-campaign-title"
                className="text-sm font-semibold text-white"
              >
                Kampanyaya ekle
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                Yalnızca eksik atamalar eklenir. Ücret veya kampanya alanları
                üzerine yazılmaz.
              </p>
            </div>

            <label className="block space-y-1 text-xs text-zinc-400">
              Kampanya
              <select
                value={campaignId}
                onChange={(event) => setCampaignId(event.target.value)}
                className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-white"
              >
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded-md border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-xs text-zinc-300">
              <p>Seçili creator: {creatorCount}</p>
              <p>Hedef: {selectedCampaign?.name ?? "—"}</p>
              <p className="mt-1 text-zinc-500">
                Onay sonrası zaten atanmış olanlar atlanır.
              </p>
            </div>

            {error ? <p className="text-xs text-red-400">{error}</p> : null}
            {summary ? <p className="text-xs text-emerald-400">{summary}</p> : null}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
              >
                Kapat
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isPending || !campaignId}
                onClick={handleConfirm}
              >
                {isPending ? "Ekleniyor…" : "Onayla"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
