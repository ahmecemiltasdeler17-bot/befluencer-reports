"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { defaultClusterSoundMetricFormValues } from "@/features/metrics/schemas";
import type { ClusterSoundMetricFormState } from "@/features/metrics/types";
import { createClusterSoundUsageSnapshotAction } from "@/features/sound-sync/actions";
import { cn } from "@/lib/utils";

function fieldClass(hasError: boolean) {
  return cn(
    "h-10 w-full rounded-lg border bg-zinc-950/80 px-3 text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:ring-2 disabled:opacity-60",
    hasError
      ? "border-red-500/50 focus:border-red-500/60 focus:ring-red-500/20"
      : "border-zinc-800 focus:border-sky-400/50 focus:ring-sky-400/15"
  );
}

export function ClusterSoundUsageForm({
  campaignId,
}: {
  campaignId: string;
}) {
  const action = createClusterSoundUsageSnapshotAction.bind(null, campaignId);
  const defaults = defaultClusterSoundMetricFormValues();
  const initialState: ClusterSoundMetricFormState = { values: defaults };
  const [state, formAction, isPending] = useActionState(action, initialState);
  const values = state.values ?? defaults;

  return (
    <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-950/30 p-5">
      <div>
        <h3 className="text-base font-medium text-white">
          Toplam Ses Kullanımı
        </h3>
        <p className="mt-1 text-sm text-zinc-500">
          TikTok mobilde “Şunu içerir” ekranındaki toplam/cluster kullanımı
          manuel olarak girin. Yalnızca girdiğiniz gerçek ölçümler kaydedilir;
          aradaki günler için otomatik değer üretilmez.
        </p>
      </div>

      <form
        key={JSON.stringify(values) + String(state.success ?? "")}
        action={formAction}
        className="space-y-4"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label
              htmlFor="cluster_usage_count"
              className="text-sm font-medium text-zinc-300"
            >
              Toplam kullanım <span className="text-sky-300">*</span>
            </label>
            <input
              id="cluster_usage_count"
              name="usage_count"
              type="number"
              min={0}
              required
              placeholder="4890"
              defaultValue={values.usage_count}
              className={fieldClass(Boolean(state.fieldErrors?.usage_count))}
            />
            {state.fieldErrors?.usage_count ? (
              <p className="text-xs text-red-400">
                {state.fieldErrors.usage_count}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label
              htmlFor="cluster_captured_at"
              className="text-sm font-medium text-zinc-300"
            >
              Ölçüm zamanı <span className="text-sky-300">*</span>
            </label>
            <input
              id="cluster_captured_at"
              name="captured_at"
              type="datetime-local"
              required
              defaultValue={values.captured_at}
              className={fieldClass(Boolean(state.fieldErrors?.captured_at))}
            />
            {state.fieldErrors?.captured_at ? (
              <p className="text-xs text-red-400">
                {state.fieldErrors.captured_at}
              </p>
            ) : null}
          </div>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="cluster_note"
            className="text-sm font-medium text-zinc-300"
          >
            Not <span className="text-zinc-600">(opsiyonel)</span>
          </label>
          <input
            id="cluster_note"
            name="note"
            type="text"
            maxLength={500}
            placeholder="Mobil TikTok’ta kontrol edildi"
            defaultValue={values.note}
            className={fieldClass(Boolean(state.fieldErrors?.note))}
          />
          {state.fieldErrors?.note ? (
            <p className="text-xs text-red-400">{state.fieldErrors.note}</p>
          ) : null}
        </div>

        {state.error ? (
          <p
            role="alert"
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
          >
            {state.error}
          </p>
        ) : null}

        {state.success ? (
          <p
            role="status"
            className="rounded-lg border border-sky-500/25 bg-sky-500/10 px-3 py-2 text-sm text-sky-200"
          >
            {state.success}
          </p>
        ) : null}

        <Button
          type="submit"
          disabled={isPending}
          className="bg-sky-500/90 text-zinc-950 hover:bg-sky-400"
        >
          {isPending ? "Kaydediliyor…" : "Toplam Ses Kullanımını Kaydet"}
        </Button>
      </form>
    </section>
  );
}
