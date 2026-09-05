"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  convertLeadToCreatorAction,
  saveLeadNoteAction,
  updateLeadStatusAction,
} from "@/features/leads/actions";
import {
  describeLeadFields,
  extractTikTokUsername,
  leadKindLabel,
  leadStatusLabel,
} from "@/features/leads/calculations";
import { LEAD_STATUSES } from "@/features/leads/types";
import type { LeadActionState, LeadWithCreator } from "@/features/leads/types";

const DATE_FORMAT = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Istanbul",
});

function formatReceivedAt(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : DATE_FORMAT.format(parsed);
}

const STATUS_TONE: Record<string, string> = {
  new: "border-[var(--bf-accent)]/40 bg-[color-mix(in_srgb,var(--bf-accent)_14%,transparent)] text-[var(--bf-accent)]",
  contacted:
    "border-[var(--bf-border)] bg-[var(--bf-surface)] text-[var(--bf-text)]",
  qualified:
    "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  archived:
    "border-[var(--bf-border)] bg-transparent text-[var(--bf-text-secondary)]",
};

function ActionFeedback({ state }: { state: LeadActionState | null }) {
  if (!state?.error && !state?.success) {
    return null;
  }

  return (
    <p
      role="status"
      className={
        state.error
          ? "text-xs text-red-400"
          : "text-xs text-emerald-400"
      }
    >
      {state.error ?? state.success}
    </p>
  );
}

export function LeadCard({ lead }: { lead: LeadWithCreator }) {
  const [statusState, statusAction, statusPending] = useActionState(
    updateLeadStatusAction,
    null
  );
  const [noteState, noteAction, notePending] = useActionState(
    saveLeadNoteAction,
    null
  );
  const [convertState, convertAction, convertPending] = useActionState(
    convertLeadToCreatorAction,
    null
  );

  const fields = describeLeadFields(lead.kind, lead.payload);
  const canConvert =
    lead.kind === "creator_application" &&
    !lead.creator_id &&
    extractTikTokUsername(lead.payload.tiktokUrl) !== null;

  return (
    <article className="rounded-xl border border-[var(--bf-border)] bg-[var(--bf-surface)]/50 p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-[var(--bf-text)]">
              {lead.full_name}
            </h2>
            <span className="rounded-full border border-[var(--bf-border)] px-2 py-0.5 text-[11px] text-[var(--bf-text-secondary)]">
              {leadKindLabel(lead.kind)}
            </span>
            <span
              className={`rounded-full border px-2 py-0.5 text-[11px] ${
                STATUS_TONE[lead.status] ?? STATUS_TONE.archived
              }`}
            >
              {leadStatusLabel(lead.status)}
            </span>
          </div>
          <p className="mt-1 text-sm text-[var(--bf-text-secondary)]">
            <a
              href={`mailto:${lead.email}`}
              className="underline underline-offset-2 hover:text-[var(--bf-text)]"
            >
              {lead.email}
            </a>
            {lead.phone ? <span> · {lead.phone}</span> : null}
          </p>
        </div>
        <time
          dateTime={lead.received_at}
          className="shrink-0 text-xs text-[var(--bf-text-secondary)] tabular-nums"
        >
          {formatReceivedAt(lead.received_at)}
        </time>
      </header>

      {fields.length > 0 ? (
        <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field.key} className="min-w-0">
              <dt className="text-[11px] uppercase tracking-wide text-[var(--bf-text-secondary)]">
                {field.label}
              </dt>
              <dd className="mt-0.5 text-sm break-words text-[var(--bf-text)]">
                {/^https?:\/\//i.test(field.value) ? (
                  <a
                    href={field.value}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="underline underline-offset-2"
                  >
                    {field.value}
                  </a>
                ) : (
                  field.value
                )}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {lead.creator ? (
        <p className="mt-4 text-sm text-[var(--bf-text-secondary)]">
          İçerik üreticisi:{" "}
          <Link
            href={`/creators/${lead.creator.id}`}
            className="text-[var(--bf-accent)] underline underline-offset-2"
          >
            @{lead.creator.username}
          </Link>
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap items-end gap-4 border-t border-[var(--bf-border)] pt-4">
        <form action={statusAction} className="flex items-end gap-2">
          <input type="hidden" name="leadId" value={lead.id} />
          <label className="space-y-1">
            <span className="block text-[11px] text-[var(--bf-text-secondary)]">
              Durum
            </span>
            <select
              name="status"
              defaultValue={lead.status}
              className="h-9 rounded-lg border border-[var(--bf-border)] bg-[var(--bf-bg)] px-2 text-sm text-[var(--bf-text)]"
            >
              {LEAD_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {leadStatusLabel(status)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={statusPending}
            className="h-9 rounded-lg border border-[var(--bf-border)] px-3 text-sm text-[var(--bf-text)] transition-colors hover:bg-[var(--bf-surface)] disabled:opacity-50"
          >
            {statusPending ? "Kaydediliyor…" : "Kaydet"}
          </button>
          <ActionFeedback state={statusState} />
        </form>

        {canConvert ? (
          <form action={convertAction} className="flex items-end gap-2">
            <input type="hidden" name="leadId" value={lead.id} />
            <button
              type="submit"
              disabled={convertPending}
              className="h-9 rounded-lg bg-[var(--bf-accent)] px-3 text-sm font-medium text-[var(--bf-bg)] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {convertPending ? "Ekleniyor…" : "Creator olarak ekle"}
            </button>
            <ActionFeedback state={convertState} />
          </form>
        ) : null}
      </div>

      <form action={noteAction} className="mt-4 space-y-2">
        <input type="hidden" name="leadId" value={lead.id} />
        <label
          htmlFor={`note-${lead.id}`}
          className="block text-[11px] text-[var(--bf-text-secondary)]"
        >
          Not
        </label>
        <textarea
          id={`note-${lead.id}`}
          name="note"
          rows={2}
          defaultValue={lead.admin_note ?? ""}
          maxLength={2000}
          placeholder="Görüşme notu, takip tarihi…"
          className="w-full rounded-lg border border-[var(--bf-border)] bg-[var(--bf-bg)] px-3 py-2 text-sm text-[var(--bf-text)] outline-none placeholder:text-[var(--bf-text-secondary)]/60 focus:border-[var(--bf-accent)]/60"
        />
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={notePending}
            className="h-9 rounded-lg border border-[var(--bf-border)] px-3 text-sm text-[var(--bf-text)] transition-colors hover:bg-[var(--bf-surface)] disabled:opacity-50"
          >
            {notePending ? "Kaydediliyor…" : "Notu kaydet"}
          </button>
          <ActionFeedback state={noteState} />
        </div>
      </form>
    </article>
  );
}
