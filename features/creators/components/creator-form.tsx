"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  CREATOR_CATEGORIES,
  CREATOR_PLATFORMS,
  type CreateAndAssignFormValues,
  type CreatorFormState,
  type CreatorFormValues,
} from "@/features/creators/types";
import { cn } from "@/lib/utils";
import {
  getCategoryLabel,
} from "@/features/creators/components/creator-category-badge";
import {
  getPlatformLabel,
} from "@/features/creators/components/creator-platform-badge";

const DEFAULT_VALUES: CreatorFormValues = {
  platform: "tiktok",
  username: "",
  display_name: "",
  profile_url: "",
  avatar_url: "",
  follower_count: "0",
  category: "",
};

type CreatorFormProps = {
  action: (
    prevState: CreatorFormState,
    formData: FormData
  ) => Promise<CreatorFormState>;
  defaultValues?: Partial<CreatorFormValues | CreateAndAssignFormValues>;
  submitLabel: string;
  cancelHref?: string;
  includeCampaignFields?: boolean;
};

function fieldClass(hasError: boolean) {
  return cn(
    "h-10 w-full rounded-lg border bg-bf-bg px-3 text-sm text-bf-text outline-none transition-colors placeholder:text-bf-steel/60 focus:ring-2 disabled:opacity-60",
    hasError
      ? "border-red-500/50 focus:border-red-500/60 focus:ring-red-500/20"
      : "border-bf-border focus:border-primary/60 focus:ring-primary/20"
  );
}

export function CreatorForm({
  action,
  defaultValues,
  submitLabel,
  cancelHref,
  includeCampaignFields = false,
}: CreatorFormProps) {
  const mergedDefaults = { ...DEFAULT_VALUES, ...defaultValues };
  const initialState: CreatorFormState = { values: mergedDefaults };

  const [state, formAction, isPending] = useActionState(action, initialState);
  const values = state.values ?? mergedDefaults;
  const campaignValues =
    includeCampaignFields && "agreed_content_count" in values
      ? (values as CreateAndAssignFormValues)
      : null;

  return (
    <form
      key={JSON.stringify(values)}
      action={formAction}
      className="space-y-6"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <FormSelect
          id="platform"
          label="Platform"
          required
          error={state.fieldErrors?.platform}
          value={values.platform}
          options={CREATOR_PLATFORMS.map((platform) => ({
            value: platform,
            label: getPlatformLabel(platform),
          }))}
        />
        <FormField
          id="username"
          label="Kullanıcı adı"
          required
          error={state.fieldErrors?.username}
          value={values.username}
          placeholder="kullaniciadi"
        />
        <FormField
          id="display_name"
          label="Görünen ad"
          error={state.fieldErrors?.display_name}
          value={values.display_name}
        />
        <FormSelect
          id="category"
          label="Kategori"
          error={state.fieldErrors?.category}
          value={values.category}
          options={[
            { value: "", label: "Kategorisiz (otomatik)" },
            ...CREATOR_CATEGORIES.map((category) => ({
              value: category,
              label: getCategoryLabel(category),
            })),
          ]}
          hint="Manuel seçim senkronizasyonda korunur. Boş bırakılırsa takipçi sayısından hesaplanır."
        />
        <FormField
          id="profile_url"
          label="Profil linki"
          type="url"
          error={state.fieldErrors?.profile_url}
          value={values.profile_url}
          placeholder="https://..."
        />
        <FormField
          id="avatar_url"
          label="Avatar linki"
          type="url"
          error={state.fieldErrors?.avatar_url}
          value={values.avatar_url}
          placeholder="https://..."
        />
        <FormField
          id="follower_count"
          label="Takipçi sayısı"
          type="number"
          min={0}
          required
          error={state.fieldErrors?.follower_count}
          value={values.follower_count}
        />
      </div>

      {includeCampaignFields ? (
        <div className="space-y-4 border-t border-bf-border pt-6">
          <h3 className="text-sm font-medium text-zinc-300">
            Kampanya Bilgileri
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              id="agreed_content_count"
              label="Anlaşılan içerik sayısı"
              type="number"
              min={1}
              required
              error={state.fieldErrors?.agreed_content_count}
              value={campaignValues?.agreed_content_count ?? "1"}
            />
            <FormField
              id="fee"
              label="Ücret"
              type="number"
              min={0}
              step="0.01"
              error={state.fieldErrors?.fee}
              value={campaignValues?.fee ?? ""}
              placeholder="Opsiyonel"
            />
          </div>
          <FormTextarea
            id="notes"
            label="Notlar"
            error={state.fieldErrors?.notes}
            value={campaignValues?.notes ?? ""}
          />
        </div>
      ) : null}

      {state.error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
        >
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 border-t border-bf-border pt-6">
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
  min,
  step,
  placeholder,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  value: string;
  type?: string;
  min?: number;
  step?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium text-zinc-300">
        {label}
        {required ? <span className="text-primary"> *</span> : null}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        defaultValue={value}
        required={required}
        min={min}
        step={step}
        placeholder={placeholder}
        className={fieldClass(Boolean(error))}
      />
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
    </div>
  );
}

function FormTextarea({
  id,
  label,
  error,
  value,
}: {
  id: string;
  label: string;
  error?: string;
  value: string;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium text-zinc-300">
        {label}
      </label>
      <textarea
        id={id}
        name={id}
        defaultValue={value}
        rows={3}
        className={cn(fieldClass(Boolean(error)), "min-h-24 py-2")}
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
  hint,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium text-zinc-300">
        {label}
        {required ? <span className="text-primary"> *</span> : null}
      </label>
      <select
        id={id}
        name={id}
        defaultValue={value}
        required={required}
        className={fieldClass(Boolean(error))}
      >
        {options.map((option) => (
          <option key={option.value || "empty"} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint ? <p className="text-xs text-zinc-500">{hint}</p> : null}
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
    </div>
  );
}
