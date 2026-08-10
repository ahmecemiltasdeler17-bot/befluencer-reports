"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import type { SoundMetricFormState } from "@/features/metrics/types";
import { cn } from "@/lib/utils";

type SoundMetricFormProps = {
  action: (
    prevState: SoundMetricFormState,
    formData: FormData
  ) => Promise<SoundMetricFormState>;
  defaultValues: import("@/features/metrics/types").SoundMetricFormValues;
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

export function SoundMetricForm({
  action,
  defaultValues,
  cancelHref,
}: SoundMetricFormProps) {
  const initialState: SoundMetricFormState = { values: defaultValues };
  const [state, formAction, isPending] = useActionState(action, initialState);
  const values = state.values ?? defaultValues;

  return (
    <form
      key={JSON.stringify(values)}
      action={formAction}
      className="space-y-6"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label
            htmlFor="usage_count"
            className="text-sm font-medium text-zinc-300"
          >
            Kullanım sayısı <span className="text-primary">*</span>
          </label>
          <input
            id="usage_count"
            name="usage_count"
            type="number"
            min={0}
            required
            defaultValue={values.usage_count}
            className={fieldClass(Boolean(state.fieldErrors?.usage_count))}
          />
          {state.fieldErrors?.usage_count ? (
            <p className="text-xs text-red-400">{state.fieldErrors.usage_count}</p>
          ) : null}
        </div>

        <div className="space-y-2">
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
          {isPending ? "Kaydediliyor…" : "Ses Kullanımını Kaydet"}
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
