"use client";

import { useActionState } from "react";
import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import type { AssignCreatorFormState, CampaignCreatorFormValues } from "@/features/creators/types";
import { cn } from "@/lib/utils";

const DEFAULT_VALUES: CampaignCreatorFormValues = {
  agreed_content_count: "1",
  fee: "",
  notes: "",
};

type AssignCreatorFormProps = {
  action: (
    prevState: AssignCreatorFormState,
    formData: FormData
  ) => Promise<AssignCreatorFormState>;
  defaultValues?: Partial<CampaignCreatorFormValues>;
  submitLabel: string;
  cancelHref?: string;
  hiddenFields?: Record<string, string>;
};

function fieldClass(hasError: boolean) {
  return cn(
    "h-10 w-full rounded-lg border bg-zinc-950/80 px-3 text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:ring-2 disabled:opacity-60",
    hasError
      ? "border-red-500/50 focus:border-red-500/60 focus:ring-red-500/20"
      : "border-zinc-800 focus:border-primary/60 focus:ring-primary/20"
  );
}

export function AssignCreatorForm({
  action,
  defaultValues,
  submitLabel,
  cancelHref,
  hiddenFields,
}: AssignCreatorFormProps) {
  const initialState: AssignCreatorFormState = {
    values: { ...DEFAULT_VALUES, ...defaultValues },
  };

  const [state, formAction, isPending] = useActionState(action, initialState);
  const values = state.values ?? { ...DEFAULT_VALUES, ...defaultValues };

  return (
    <form
      key={JSON.stringify(values)}
      action={formAction}
      className="space-y-4"
    >
      {hiddenFields
        ? Object.entries(hiddenFields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))
        : null}

      <div className="grid gap-4 md:grid-cols-2">
        <FormField
          id="agreed_content_count"
          label="Anlaşılan içerik sayısı"
          type="number"
          min={1}
          required
          error={state.fieldErrors?.agreed_content_count}
          value={values.agreed_content_count}
        />
        <FormField
          id="fee"
          label="Ücret"
          type="number"
          min={0}
          step="0.01"
          error={state.fieldErrors?.fee}
          value={values.fee}
          placeholder="Opsiyonel"
        />
      </div>

      <FormField
        id="notes"
        label="Notlar"
        as="textarea"
        error={state.fieldErrors?.notes}
        value={values.notes}
        placeholder="Kampanyaya özel notlar"
      />

      {state.error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
        >
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          disabled={isPending}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {isPending ? "Kaydediliyor…" : submitLabel}
        </Button>
        {cancelHref ? (
          <Link
            href={cancelHref}
            className={cn(
              buttonVariants({ variant: "outline" }),
              isPending && "pointer-events-none opacity-50"
            )}
            aria-disabled={isPending}
            tabIndex={isPending ? -1 : undefined}
          >
            İptal
          </Link>
        ) : null}
      </div>
    </form>
  );
}

function FormField({
  id,
  label,
  required,
  error,
  value,
  type = "text",
  as = "input",
  min,
  step,
  placeholder,
}: {
  id: keyof CampaignCreatorFormValues;
  label: string;
  required?: boolean;
  error?: string;
  value: string;
  type?: string;
  as?: "input" | "textarea";
  min?: number;
  step?: string;
  placeholder?: string;
}) {
  const sharedClass = fieldClass(Boolean(error));

  return (
    <div className={as === "textarea" ? "md:col-span-2 space-y-2" : "space-y-2"}>
      <label htmlFor={id} className="text-sm font-medium text-zinc-300">
        {label}
        {required ? <span className="text-primary"> *</span> : null}
      </label>
      {as === "textarea" ? (
        <textarea
          id={id}
          name={id}
          defaultValue={value}
          rows={3}
          placeholder={placeholder}
          className={cn(sharedClass, "min-h-24 py-2")}
        />
      ) : (
        <input
          id={id}
          name={id}
          type={type}
          defaultValue={value}
          required={required}
          min={min}
          step={step}
          placeholder={placeholder}
          className={sharedClass}
        />
      )}
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
    </div>
  );
}
