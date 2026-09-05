import Link from "next/link";

import { LeadCard } from "@/features/leads/components/lead-card";
import { leadKindLabel, leadStatusLabel } from "@/features/leads/calculations";
import { getLeadStatusCounts, listLeads } from "@/features/leads/queries";
import { LEAD_KINDS, LEAD_STATUSES } from "@/features/leads/types";
import type { LeadKind, LeadStatus } from "@/features/leads/types";
import { isLeadIngestConfigured } from "@/lib/env.server";

type SearchParams = {
  kind?: string;
  status?: string;
  q?: string;
};

export const metadata = {
  title: "Gelen Talepler",
};

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  const kind = (LEAD_KINDS as readonly string[]).includes(params.kind ?? "")
    ? (params.kind as LeadKind)
    : "all";
  const status = (LEAD_STATUSES as readonly string[]).includes(params.status ?? "")
    ? (params.status as LeadStatus)
    : "all";

  const [leads, counts] = await Promise.all([
    listLeads({ kind, status, query: params.q }),
    getLeadStatusCounts(),
  ]);

  const ingestConfigured = isLeadIngestConfigured();
  const hasFilters = kind !== "all" || status !== "all" || Boolean(params.q);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--bf-text)]">
            Gelen Talepler
          </h1>
          <p className="mt-1 text-sm text-[var(--bf-text-secondary)]">
            befluencer.co üzerindeki marka ve creator formlarından gelen
            başvurular
          </p>
        </div>
        <dl className="flex flex-wrap items-center gap-4 text-sm">
          {LEAD_STATUSES.map((value) => (
            <div key={value} className="text-right">
              <dt className="text-[11px] uppercase tracking-wide text-[var(--bf-text-secondary)]">
                {leadStatusLabel(value)}
              </dt>
              <dd className="tabular-nums text-[var(--bf-text)]">
                {counts[value]}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {!ingestConfigured ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Form gönderim ucu yapılandırılmamış. Marketing sitesinden gelen
          başvurular kaydedilmiyor — <code>LEADS_INGEST_SECRET</code> tanımlayın
          ve aynı değeri befluencer-web tarafında{" "}
          <code>FORM_WEBHOOK_SECRET</code> olarak girin.
        </div>
      ) : null}

      <form
        className="flex flex-wrap items-end gap-3 rounded-xl border border-[var(--bf-border)] bg-[var(--bf-surface)]/50 p-3"
        method="get"
      >
        <div className="min-w-[200px] flex-1 space-y-1">
          <label htmlFor="q" className="text-xs text-[var(--bf-text-secondary)]">
            Ara
          </label>
          <input
            id="q"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Ad soyad veya e-posta"
            className="h-10 w-full rounded-lg border border-[var(--bf-border)] bg-[var(--bf-bg)] px-3 text-sm text-[var(--bf-text)] outline-none placeholder:text-[var(--bf-text-secondary)]/60 focus:border-[var(--bf-accent)]/60"
          />
        </div>
        <div className="space-y-1">
          <label
            htmlFor="kind"
            className="text-xs text-[var(--bf-text-secondary)]"
          >
            Tür
          </label>
          <select
            id="kind"
            name="kind"
            defaultValue={kind}
            className="h-10 rounded-lg border border-[var(--bf-border)] bg-[var(--bf-bg)] px-3 text-sm text-[var(--bf-text)]"
          >
            <option value="all">Tümü</option>
            {LEAD_KINDS.map((value) => (
              <option key={value} value={value}>
                {leadKindLabel(value)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label
            htmlFor="status"
            className="text-xs text-[var(--bf-text-secondary)]"
          >
            Durum
          </label>
          <select
            id="status"
            name="status"
            defaultValue={status}
            className="h-10 rounded-lg border border-[var(--bf-border)] bg-[var(--bf-bg)] px-3 text-sm text-[var(--bf-text)]"
          >
            <option value="all">Tümü</option>
            {LEAD_STATUSES.map((value) => (
              <option key={value} value={value}>
                {leadStatusLabel(value)}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="h-10 rounded-lg bg-[var(--bf-accent)] px-4 text-sm font-medium text-[var(--bf-bg)] hover:opacity-90"
        >
          Filtrele
        </button>
        {hasFilters ? (
          <Link
            href="/leads"
            className="h-10 rounded-lg px-3 text-sm leading-10 text-[var(--bf-text-secondary)] hover:text-[var(--bf-text)]"
          >
            Temizle
          </Link>
        ) : null}
      </form>

      {leads.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--bf-border)] px-6 py-12 text-center text-sm text-[var(--bf-text-secondary)]">
          {hasFilters
            ? "Bu filtrelere uyan başvuru yok."
            : "Henüz başvuru gelmedi."}
        </div>
      ) : (
        <div className="space-y-4">
          {leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} />
          ))}
        </div>
      )}
    </div>
  );
}
