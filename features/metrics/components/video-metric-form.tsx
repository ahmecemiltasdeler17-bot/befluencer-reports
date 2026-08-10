"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import type { VideoMetricFormState } from "@/features/metrics/types";
import { cn } from "@/lib/utils";

type VideoMetricFormProps = {
  action: (
    prevState: VideoMetricFormState,
    formData: FormData
  ) => Promise<VideoMetricFormState>;
  defaultValues: import("@/features/metrics/types").VideoMetricFormValues;
  cancelHref: string;
};

function fieldClass(hasError: boolean) {
  return cn(
    "h-10 w-full rounded-lg border bg-zinc-950/80 px-3 text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:ring-2 disabled:opacity-60",
    hasError
      ? "border-red-500/50 focus:border-red-500/60 focus:ring-red-500/20"
      : "border-zinc-800 focus:border-primary/60 focus:ring-primary/20"
  );
}

export function VideoMetricForm({
  action,
  defaultValues,
  cancelHref,
}: VideoMetricFormProps) {
  const initialState: VideoMetricFormState = { values: defaultValues };
  const [state, formAction, isPending] = useActionState(action, initialState);
  const values = state.values ?? defaultValues;
  const engagementTotal =
    Number(values.likes) +
    Number(values.comments) +
    Number(values.shares) +
    Number(values.saves);
  const views = Number(values.views);
  const showEngagementWarning =
    !Number.isNaN(engagementTotal) &&
    !Number.isNaN(views) &&
    engagementTotal > views;

  return (
    <form
      key={JSON.stringify(values)}
      action={formAction}
      className="space-y-6"
    >
      <div className="grid gap-4 md:grid-cols-2">
        {(
          [
            ["views", "İzlenme"],
            ["likes", "Beğeni"],
            ["comments", "Yorum"],
            ["shares", "Paylaşım"],
            ["saves", "Kaydetme"],
          ] as const
        ).map(([id, label]) => (
          <div key={id} className="space-y-2">
            <label htmlFor={id} className="text-sm font-medium text-zinc-300">
              {label} <span className="text-primary">*</span>
            </label>
            <input
              id={id}
              name={id}
              type="number"
              min={0}
              required
              defaultValue={values[id]}
              className={fieldClass(Boolean(state.fieldErrors?.[id]))}
            />
            {state.fieldErrors?.[id] ? (
              <p className="text-xs text-red-400">{state.fieldErrors[id]}</p>
            ) : null}
          </div>
        ))}

        <div className="space-y-2 md:col-span-2">
          <label
            htmlFor="captured_at"
            className="text-sm font-medium text-zinc-300"
          >
            Yakalanma zamanı <span className="text-primary">*</span>
          </label>
          <input
            id="captured_at"
            name="captured_at"
            type="datetime-local"
            required
            defaultValue={values.captured_at}
            className={fieldClass(Boolean(state.fieldErrors?.captured_at))}
          />
          {state.fieldErrors?.captured_at ? (
            <p className="text-xs text-red-400">{state.fieldErrors.captured_at}</p>
          ) : null}
        </div>
      </div>

      {showEngagementWarning || state.warning ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          {state.warning ??
            "Beğeni, yorum, paylaşım ve kaydetme toplamı izlenmeyi aşıyor."}
        </p>
      ) : null}

      {state.error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
        >
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 border-t border-zinc-800 pt-6">
        <Button
          type="submit"
          disabled={isPending}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {isPending ? "Kaydediliyor…" : "Metriği Kaydet"}
        </Button>
        <Link
          href={cancelHref}
          className={cn(
            buttonVariants({ variant: "outline" }),
            isPending && "pointer-events-none opacity-50"
          )}
        >
          İptal
        </Link>
      </div>
    </form>
  );
}
