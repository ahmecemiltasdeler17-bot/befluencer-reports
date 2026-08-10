"use client";

import { useMemo, useState, useTransition } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  importCampaignVideosFromUrlsAction,
  previewCampaignVideoImportAction,
  searchCreatorsForVideoImportAction,
} from "@/features/video-import/actions";
import {
  VIDEO_IMPORT_CREATOR_STATUS_LABELS,
  VIDEO_IMPORT_MAX_URLS,
  VIDEO_IMPORT_MESSAGES,
  VIDEO_IMPORT_VIDEO_STATUS_LABELS,
} from "@/features/video-import/constants";
import type {
  ManualCreatorOption,
  VideoImportCommitResult,
  VideoImportPreviewRow,
} from "@/features/video-import/types";
import { cn } from "@/lib/utils";

type Step = "input" | "preview" | "result";

export function ImportCampaignVideosDialog({
  campaignId,
  campaignCreators,
}: {
  campaignId: string;
  campaignCreators: ManualCreatorOption[];
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("input");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<VideoImportPreviewRow[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [manualCreators, setManualCreators] = useState<
    Record<string, string>
  >({});
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOptions, setSearchOptions] = useState<ManualCreatorOption[]>([]);
  const [commitResult, setCommitResult] =
    useState<VideoImportCommitResult | null>(null);
  const [meta, setMeta] = useState<{
    urlCount: number;
    dedupedCount: number;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const lineCount = useMemo(
    () =>
      text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean).length,
    [text]
  );

  const selectableRows = rows.filter((row) => row.selectable);
  const selectedCount = selectableRows.filter(
    (row) => selected[row.rowKey]
  ).length;

  function reset() {
    setStep("input");
    setText("");
    setError(null);
    setRows([]);
    setSelected({});
    setManualCreators({});
    setSearchQuery("");
    setSearchOptions([]);
    setCommitResult(null);
    setMeta(null);
  }

  function handleOpen() {
    reset();
    setOpen(true);
  }

  function handlePreview() {
    setError(null);
    startTransition(async () => {
      const result = await previewCampaignVideoImportAction(campaignId, text);
      if (result.error) {
        setError(result.error);
        return;
      }

      const nextRows = result.rows ?? [];
      setRows(nextRows);
      setMeta({
        urlCount: result.urlCount ?? 0,
        dedupedCount: result.dedupedCount ?? 0,
      });

      const nextSelected: Record<string, boolean> = {};
      for (const row of nextRows) {
        nextSelected[row.rowKey] =
          row.selectable && row.videoStatus === "importable";
      }
      setSelected(nextSelected);
      setStep("preview");
    });
  }

  function handleSearch() {
    startTransition(async () => {
      const result = await searchCreatorsForVideoImportAction(searchQuery);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSearchOptions(result.creators ?? []);
    });
  }

  function handleCommit() {
    setError(null);
    const payload = rows
      .filter((row) => row.selectable && selected[row.rowKey])
      .map((row) => ({
        rowKey: row.rowKey,
        normalizedUrl: row.normalizedUrl,
        originalUrl: row.originalUrl,
        platformVideoId: row.platformVideoId,
        thumbnailUrl: row.thumbnailUrl,
        caption: row.caption,
        publishedAt: row.publishedAt,
        creatorUsername: row.creatorUsername,
        creatorDisplayName: row.creatorDisplayName,
        creatorAvatarUrl: row.creatorAvatarUrl,
        creatorFollowerCount: row.creatorFollowerCount,
        creatorProfileUrl: row.creatorProfileUrl,
        matchedCreatorId: row.matchedCreatorId,
        manualCreatorId: manualCreators[row.rowKey] ?? null,
        views: row.views,
        likes: row.likes,
        comments: row.comments,
        shares: row.shares,
        saves: row.saves,
      }));

    for (const row of rows) {
      if (
        selected[row.rowKey] &&
        row.creatorStatus === "manual_required" &&
        !manualCreators[row.rowKey]
      ) {
        setError("Manuel eşleştirme gereken satırlar için creator seçin.");
        return;
      }
    }

    startTransition(async () => {
      const result = await importCampaignVideosFromUrlsAction({
        campaignId,
        rows: payload,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setCommitResult(result);
      setStep("result");
    });
  }

  const creatorOptions = useMemo(() => {
    const map = new Map<string, ManualCreatorOption>();
    for (const creator of campaignCreators) {
      map.set(creator.id, creator);
    }
    for (const creator of searchOptions) {
      map.set(creator.id, creator);
    }
    return Array.from(map.values());
  }, [campaignCreators, searchOptions]);

  return (
    <>
      <Button
        type="button"
        onClick={handleOpen}
      >
        Video Linklerinden Ekle
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 py-8"
          role="dialog"
          aria-modal="true"
          aria-labelledby="video-import-title"
        >
          <div className="w-full max-w-5xl space-y-4 rounded-lg border border-bf-border bg-bf-elevated p-5 shadow-xl shadow-black/40">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2
                  id="video-import-title"
                  className="text-base font-semibold text-bf-text"
                >
                  Video linklerinden ekle
                </h2>
                <p className="mt-1 text-sm text-bf-steel">
                  TikTok video URL’lerini yapıştırın. Önizleme sonrası seçilen
                  satırlar kampanyaya eklenir.
                </p>
              </div>
              <button
                type="button"
                className="text-sm text-bf-steel hover:text-bf-text"
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
              >
                Kapat
              </button>
            </div>

            {error ? (
              <p className="rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">
                {error}
              </p>
            ) : null}

            {step === "input" ? (
              <div className="space-y-3">
                <label className="block space-y-1.5">
                  <span className="text-sm text-bf-text/90">
                    TikTok video bağlantıları (satır başına bir URL)
                  </span>
                  <textarea
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    rows={10}
                    placeholder={"https://www.tiktok.com/@user/video/123...\nhttps://www.tiktok.com/@user/video/456..."}
                    className="w-full rounded-md border border-bf-border bg-bf-bg px-3 py-2 text-sm text-bf-text placeholder:text-bf-steel/60 outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                  />
                </label>
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-bf-steel">
                  <span>
                    {lineCount} bağlantı (en fazla {VIDEO_IMPORT_MAX_URLS})
                  </span>
                  <Button
                    type="button"
                    disabled={isPending || lineCount === 0}
                    onClick={handlePreview}
                  >
                    {isPending ? "Kontrol ediliyor…" : "Bağlantıları Kontrol Et"}
                  </Button>
                </div>
              </div>
            ) : null}

            {step === "preview" ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-bf-steel">
                  <span>
                    {meta?.urlCount ?? 0} benzersiz URL
                    {meta?.dedupedCount
                      ? ` · ${meta.dedupedCount} tekrar atlandı`
                      : ""}
                    {" · "}
                    {selectedCount}/{selectableRows.length} seçili
                  </span>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isPending}
                      onClick={() => setStep("input")}
                    >
                      Geri
                    </Button>
                    <Button
                      type="button"
                      disabled={isPending || selectedCount === 0}
                      onClick={handleCommit}
                    >
                      {isPending
                        ? "İçe aktarılıyor…"
                        : `Seçilenleri İçe Aktar (${selectedCount})`}
                    </Button>
                  </div>
                </div>

                {rows.some((row) => row.creatorStatus === "manual_required") ? (
                  <div className="flex flex-wrap items-end gap-2 rounded-md border border-bf-border bg-bf-surface/40 p-3">
                    <label className="grow space-y-1 text-sm">
                      <span className="text-bf-steel">
                        Manuel eşleştirme için creator ara
                      </span>
                      <input
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        className="w-full rounded-md border border-bf-border bg-bf-bg px-3 py-1.5 text-bf-text outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                        placeholder="@kullanici"
                      />
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isPending || !searchQuery.trim()}
                      onClick={handleSearch}
                    >
                      Ara
                    </Button>
                  </div>
                ) : null}

                <div className="overflow-x-auto rounded-lg border border-bf-border">
                  <table className="min-w-full divide-y divide-bf-border text-sm">
                    <thead className="bg-bf-surface text-left text-bf-steel">
                      <tr>
                        <th className="px-3 py-2">Seç</th>
                        <th className="px-3 py-2">Önizleme</th>
                        <th className="px-3 py-2">URL</th>
                        <th className="px-3 py-2">Creator</th>
                        <th className="px-3 py-2">Creator durumu</th>
                        <th className="px-3 py-2">Video durumu</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-bf-border/80">
                      {rows.map((row) => (
                        <tr key={row.rowKey} className="align-top text-bf-text/90">
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              disabled={!row.selectable}
                              checked={Boolean(selected[row.rowKey])}
                              onChange={(event) =>
                                setSelected((prev) => ({
                                  ...prev,
                                  [row.rowKey]: event.target.checked,
                                }))
                              }
                              className="accent-primary"
                            />
                          </td>
                          <td className="px-3 py-2">
                            {row.thumbnailUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={row.thumbnailUrl}
                                alt=""
                                className="h-16 w-10 rounded border border-bf-border object-cover"
                              />
                            ) : (
                              <span className="text-xs text-bf-steel">—</span>
                            )}
                            {row.caption ? (
                              <p className="mt-1 max-w-[160px] truncate text-xs text-bf-steel">
                                {row.caption}
                              </p>
                            ) : null}
                          </td>
                          <td className="px-3 py-2">
                            <p className="max-w-[220px] truncate text-xs text-bf-steel">
                              {row.originalUrl}
                            </p>
                            <p className="max-w-[220px] truncate text-xs text-primary/80">
                              {row.normalizedUrl}
                            </p>
                          </td>
                          <td className="px-3 py-2">
                            <p className="font-medium">
                              {row.creatorUsername
                                ? `@${row.creatorUsername}`
                                : "—"}
                            </p>
                            <p className="text-xs text-bf-steel">
                              {row.creatorDisplayName ?? "—"}
                            </p>
                            {row.creatorStatus === "manual_required" ? (
                              <select
                                className="mt-2 w-full max-w-[200px] rounded border border-bf-border bg-bf-bg px-2 py-1 text-xs text-bf-text outline-none focus:border-primary/60"
                                value={manualCreators[row.rowKey] ?? ""}
                                onChange={(event) =>
                                  setManualCreators((prev) => ({
                                    ...prev,
                                    [row.rowKey]: event.target.value,
                                  }))
                                }
                              >
                                <option value="">Creator seçin…</option>
                                {creatorOptions.map((creator) => (
                                  <option key={creator.id} value={creator.id}>
                                    @{creator.username}
                                    {creator.display_name
                                      ? ` — ${creator.display_name}`
                                      : ""}
                                  </option>
                                ))}
                              </select>
                            ) : null}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {
                              VIDEO_IMPORT_CREATOR_STATUS_LABELS[
                                row.creatorStatus
                              ]
                            }
                          </td>
                          <td className="px-3 py-2 text-xs">
                            <p>
                              {
                                VIDEO_IMPORT_VIDEO_STATUS_LABELS[
                                  row.videoStatus
                                ]
                              }
                            </p>
                            {row.message ? (
                              <p className="mt-1 text-bf-steel">{row.message}</p>
                            ) : null}
                            {row.videoStatus === "login_required_content" ? (
                              <p className="mt-1 text-[11px] text-amber-400/90">
                                {
                                  VIDEO_IMPORT_MESSAGES.login_required_content_detail
                                }
                              </p>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {step === "result" && commitResult?.summary ? (
              <div className="space-y-4">
                <div className="grid gap-2 text-sm text-bf-text/90 sm:grid-cols-2">
                  <p>Gönderilen: {commitResult.summary.totalSubmitted}</p>
                  <p>Eklenen video: {commitResult.summary.addedVideos}</p>
                  <p>
                    Atlanan tekrar: {commitResult.summary.skippedDuplicates}
                  </p>
                  <p>
                    Oluşturulan creator: {commitResult.summary.createdCreators}
                  </p>
                  <p>
                    Eşleşen creator: {commitResult.summary.matchedCreators}
                  </p>
                  <p>Başarısız: {commitResult.summary.failedRows}</p>
                </div>
                <ul className="max-h-64 space-y-1 overflow-y-auto text-sm">
                  {(commitResult.rows ?? []).map((row) => (
                    <li
                      key={row.rowKey}
                      className={
                        row.ok ? "text-emerald-400" : "text-red-300"
                      }
                    >
                      {row.message}{" "}
                      <span className="text-bf-steel">
                        ({row.normalizedUrl})
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      reset();
                      setStep("input");
                    }}
                  >
                    Yeni içe aktarma
                  </Button>
                  <a
                    href={`/campaigns/${campaignId}`}
                    className={cn(buttonVariants({ variant: "default" }))}
                    onClick={() => setOpen(false)}
                  >
                    Kampanyaya dön
                  </a>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
