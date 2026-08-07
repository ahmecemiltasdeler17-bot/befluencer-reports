import "server-only";

import type { ScheduledSyncRunRow } from "@/features/scheduled-sync/types";
import { getVerifiedAuth } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

function mapSupabaseError(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes("permission denied")) {
    return "Bu işlem için yetkiniz yok.";
  }

  if (normalized.includes("jwt")) {
    return "Oturumunuz geçersiz. Lütfen tekrar giriş yapın.";
  }

  return "Veritabanı hatası oluştu. Lütfen tekrar deneyin.";
}

async function requireAuthenticatedClient() {
  const supabase = await createClient();
  const auth = await getVerifiedAuth(supabase);

  if (!auth) {
    throw new Error("Oturum açmanız gerekiyor.");
  }

  return supabase;
}

function mapRun(row: Record<string, unknown>): ScheduledSyncRunRow {
  return {
    id: row.id as string,
    run_type: row.run_type as ScheduledSyncRunRow["run_type"],
    status: row.status as ScheduledSyncRunRow["status"],
    started_at: row.started_at as string,
    completed_at: (row.completed_at as string | null) ?? null,
    triggered_by: row.triggered_by as ScheduledSyncRunRow["triggered_by"],
    total_campaigns: Number(row.total_campaigns),
    successful_campaigns: Number(row.successful_campaigns),
    failed_campaigns: Number(row.failed_campaigns),
    skipped_campaigns: Number(row.skipped_campaigns),
    video_success: Number(row.video_success),
    video_failed: Number(row.video_failed),
    creator_success: Number(row.creator_success),
    creator_failed: Number(row.creator_failed),
    sound_success: Number(row.sound_success),
    sound_failed: Number(row.sound_failed),
    error_message: (row.error_message as string | null) ?? null,
    created_at: row.created_at as string,
  };
}

export async function listScheduledSyncRuns(
  limit = 20
): Promise<ScheduledSyncRunRow[]> {
  const supabase = await requireAuthenticatedClient();

  const { data, error } = await supabase
    .from("scheduled_sync_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(mapSupabaseError(error.message));
  }

  return (data ?? []).map((row) => mapRun(row as Record<string, unknown>));
}

export async function getLatestScheduledSyncRun(): Promise<ScheduledSyncRunRow | null> {
  const runs = await listScheduledSyncRuns(1);
  return runs[0] ?? null;
}
