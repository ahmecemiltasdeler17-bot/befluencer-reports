"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import type { CampaignFormState, CampaignFormValues } from "@/features/campaigns/types";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = [
  { value: "draft", label: "Taslak" },
  { value: "active", label: "Aktif" },
  { value: "completed", label: "Tamamlandı" },
  { value: "archived", label: "Arşivlendi" },
] as const;

const DEFAULT_VALUES: CampaignFormValues = {
  name: "",
  artist_name: "",
  track_name: "",
  client_name: "",
  sound_url: "",
  status: "draft",
  start_date: "",
  end_date: "",
  report_number: "",
};

type CampaignFormProps = {
  action: (
    prevState: CampaignFormState,
    formData: FormData
  ) => Promise<CampaignFormState>;
  defaultValues?: Partial<CampaignFormValues>;
  submitLabel: string;
  cancelHref?: string;
};

function mergeValues(defaultValues?: Partial<CampaignFormValues>): CampaignFormValues {
  return { ...DEFAULT_VALUES, ...defaultValues };
}

function fieldClass(hasError: boolean) {
  return cn(
    "h-10 w-full rounded-lg border bg-zinc-950/80 px-3 text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:ring-2 disabled:opacity-60",
    hasError
      ? "border-red-500/50 focus:border-red-500/60 focus:ring-red-500/20"
      : "border-zinc-800 focus:border-orange-500/60 focus:ring-orange-500/20"
  );
}

export function CampaignForm({
  action,
  defaultValues,
  submitLabel,
  cancelHref,
}: CampaignFormProps) {
  const initialState: CampaignFormState = {
    values: mergeValues(defaultValues),
  };

  const [state, formAction, isPending] = useActionState(action, initialState);
  const values = state.values ?? mergeValues(defaultValues);

  return (
    <form
      key={JSON.stringify(values)}
      action={formAction}
      className="space-y-6"
    >
      <div className="grid gap-6 md:grid-cols-2">
        <FormField
          id="name"
          label="Kampanya adı"
          required
          error={state.fieldErrors?.name}
          value={values.name}
        />
        <FormField
          id="client_name"
          label="Müşteri adı"
          error={state.fieldErrors?.client_name}
          value={values.client_name}
        />
        <FormField
          id="artist_name"
          label="Sanatçı adı"
          required
          error={state.fieldErrors?.artist_name}
          value={values.artist_name}
        />
        <FormField
          id="track_name"
          label="Şarkı adı"
          required
          error={state.fieldErrors?.track_name}
          value={values.track_name}
        />
        <FormField
          id="sound_url"
          label="TikTok ses linki"
          type="url"
          placeholder="https://www.tiktok.com/music/..."
          error={state.fieldErrors?.sound_url}
          value={values.sound_url}
          className="md:col-span-2"
        />
        <FormSelect
          id="status"
          label="Durum"
          required
          error={state.fieldErrors?.status}
          value={values.status}
          options={STATUS_OPTIONS}
        />
        <FormField
          id="report_number"
          label="Rapor numarası"
          placeholder="RPT-2026-0047"
          error={state.fieldErrors?.report_number}
          value={values.report_number}
        />
        <FormField
          id="start_date"
          label="Başlangıç tarihi"
          type="date"
          error={state.fieldErrors?.start_date}
          value={values.start_date}
        />
        <FormField
          id="end_date"
          label="Bitiş tarihi"
          type="date"
          error={state.fieldErrors?.end_date}
          value={values.end_date}
        />
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
          className="bg-orange-500 text-white hover:bg-orange-500/90"
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
  placeholder,
  className,
}: {
  id: keyof CampaignFormValues;
  label: string;
  required?: boolean;
  error?: string;
  value: string;
  type?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <label htmlFor={id} className="text-sm font-medium text-zinc-300">
        {label}
        {required ? <span className="text-orange-400"> *</span> : null}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        defaultValue={value}
        required={required}
        placeholder={placeholder}
        className={fieldClass(Boolean(error))}
      />
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
    </div>
  );
}

function FormSelect({
  id,
  label,
  required,
  error,
  value,
  options,
}: {
  id: keyof CampaignFormValues;
  label: string;
  required?: boolean;
  error?: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium text-zinc-300">
        {label}
        {required ? <span className="text-orange-400"> *</span> : null}
      </label>
      <select
        id={id}
        name={id}
        defaultValue={value}
        required={required}
        className={fieldClass(Boolean(error))}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
    </div>
  );
}
