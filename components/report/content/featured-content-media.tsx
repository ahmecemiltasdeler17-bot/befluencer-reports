"use client";

import { ExternalLink, Loader2, Pause, Play } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { shouldArmHoverPreview } from "@/components/report/content/featured-preview-interaction";
import { ReportVideoLink } from "@/components/report/links/report-video-link";
import { ReportVideoThumbnail } from "@/components/report/media/report-video-thumbnail";
import { PLATFORM_LABELS } from "@/lib/content-helpers";
import { isHttpPreviewUrl } from "@/features/videos/preview-media";
import { resolveVideoLink } from "@/lib/report-links/resolve-report-links";
import type { Video } from "@/lib/types";
import { cn } from "@/lib/utils";

const HOVER_INTENT_MS = 250;

interface FeaturedContentMediaProps {
  video: Video;
}

function useIsPdfDocument(nodeRef: React.RefObject<HTMLElement | null>) {
  const [isPdf, setIsPdf] = useState(false);

  useEffect(() => {
    setIsPdf(Boolean(nodeRef.current?.closest(".pdf-document")));
  }, [nodeRef]);

  return isPdf;
}

/**
 * Featured media: poster by default.
 * - Desktop (mouse + fine hover): ~250ms hover-intent plays muted looping MP4.
 * - Touch / coarse pointer: explicit ▶ Önizle control; no autoplay.
 * - PDF: poster only — video never mounts inside .pdf-document capture.
 */
export function FeaturedContentMedia({ video }: FeaturedContentMediaProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playGenerationRef = useRef(0);
  const isPdf = useIsPdfDocument(rootRef);

  const previewUrl = isHttpPreviewUrl(video.previewMediaUrl)
    ? video.previewMediaUrl
    : null;
  const canPreview = Boolean(previewUrl) && !isPdf;

  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [armed, setArmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const previewFailed = Boolean(previewUrl && failedUrl === previewUrl);

  const videoLink = resolveVideoLink({
    videoUrl: video.url,
    platform: video.platform,
  });

  const clearHoverTimer = useCallback(() => {
    if (hoverTimerRef.current !== null) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }, []);

  const stopPreview = useCallback(() => {
    clearHoverTimer();
    playGenerationRef.current += 1;
    const el = videoRef.current;
    if (el) {
      el.pause();
      try {
        el.currentTime = 0;
      } catch {
        // Ignore seek errors on unloaded media.
      }
    }
    setPlaying(false);
    setArmed(false);
    setLoading(false);
  }, [clearHoverTimer]);

  const startPreview = useCallback(async () => {
    const el = videoRef.current;
    if (!el || previewFailed || !previewUrl) return;

    const generation = ++playGenerationRef.current;
    setArmed(true);
    setLoading(true);

    try {
      el.muted = true;
      el.defaultMuted = true;
      el.playsInline = true;
      const playPromise = el.play();
      if (playPromise !== undefined) {
        await playPromise;
      }
      if (generation !== playGenerationRef.current) return;
      setPlaying(true);
    } catch {
      // iOS/Safari may reject play() — stay on poster, no global error.
      if (generation !== playGenerationRef.current) return;
      setPlaying(false);
      setArmed(false);
    } finally {
      if (generation === playGenerationRef.current) {
        setLoading(false);
      }
    }
  }, [previewFailed, previewUrl]);

  useEffect(() => () => clearHoverTimer(), [clearHoverTimer]);

  function handlePointerEnter(event: ReactPointerEvent<HTMLDivElement>) {
    if (!canPreview || previewFailed) return;
    if (typeof window === "undefined") return;
    if (!shouldArmHoverPreview(event.pointerType, window.matchMedia.bind(window))) {
      return;
    }
    // Decorative hover autoplay respects reduced motion; tap control still works.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    clearHoverTimer();
    hoverTimerRef.current = setTimeout(() => {
      hoverTimerRef.current = null;
      void startPreview();
    }, HOVER_INTENT_MS);
  }

  function handlePointerLeave(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse") return;
    stopPreview();
  }

  function handlePreviewToggle(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!canPreview || previewFailed || loading) return;

    if (playing) {
      stopPreview();
      return;
    }
    void startPreview();
  }

  const showVideoLayer = canPreview && !previewFailed && (playing || armed);

  return (
    <div
      ref={rootRef}
      className="relative mx-auto aspect-[9/16] w-full max-w-[330px] overflow-hidden rounded-[18px] bg-[var(--report-surface-elevated)] ring-1 ring-inset ring-[var(--report-border)] min-[800px]:mx-0"
      data-featured-preview={canPreview && !previewFailed ? "ready" : "poster"}
      data-featured-playing={playing ? "true" : "false"}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      <div
        className={cn(
          "absolute inset-0 motion-safe:transition-opacity motion-safe:duration-200",
          showVideoLayer ? "opacity-0" : "opacity-100"
        )}
      >
        <ReportVideoThumbnail
          src={video.thumbnail}
          seed={video.id}
          name={video.creatorName}
          username={video.creatorHandle}
          title={video.title}
          platform={video.platform}
          featured
          showUnavailableNotice
          sizes="330px"
        />
      </div>

      {canPreview && !previewFailed ? (
        <video
          ref={videoRef}
          className={cn(
            "featured-preview-video absolute inset-0 size-full object-cover motion-safe:transition-opacity motion-safe:duration-200",
            showVideoLayer ? "opacity-100" : "opacity-0"
          )}
          src={previewUrl ?? undefined}
          poster={video.thumbnail || undefined}
          muted
          playsInline
          loop
          preload="metadata"
          controls={false}
          disablePictureInPicture
          onError={() => {
            if (previewUrl) setFailedUrl(previewUrl);
            setPlaying(false);
            setArmed(false);
            setLoading(false);
          }}
          aria-label="Öne çıkan içerik önizlemesi"
        />
      ) : null}

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/20" />

      <div className="pointer-events-none absolute top-4 left-4 flex flex-col gap-2">
        <span className="rounded-full bg-[var(--report-accent-strong)] px-2.5 py-1 text-[10px] font-semibold tracking-wide text-[var(--report-bg)] uppercase">
          En Yüksek Erişim
        </span>
        {canPreview && !previewFailed ? (
          <span className="w-fit rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-medium tracking-wide text-white ring-1 ring-white/15 backdrop-blur-sm">
            Önizleme
          </span>
        ) : null}
      </div>

      {!canPreview || previewFailed ? (
        <div className="pointer-events-none absolute top-4 right-4">
          <div className="flex size-9 items-center justify-center rounded-full bg-black/50 ring-1 ring-white/20 backdrop-blur-sm">
            <Play className="size-4 fill-white text-white" />
          </div>
        </div>
      ) : null}

      {canPreview && !previewFailed ? (
        <div className="featured-preview-touch-ui absolute z-40 flex">
          <button
            type="button"
            className="featured-preview-toggle pointer-events-auto inline-flex items-center gap-2 rounded-full bg-black/60 px-3.5 py-2 text-[12px] font-medium text-white ring-1 ring-white/20 backdrop-blur-md"
            aria-label={
              playing
                ? "Video önizlemesini durdur"
                : "Video önizlemesini oynat"
            }
            data-featured-preview-toggle=""
            disabled={loading}
            onClick={handlePreviewToggle}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
          >
            {loading ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : playing ? (
              <Pause className="size-3.5 fill-white text-white" aria-hidden />
            ) : (
              <Play className="size-3.5 fill-white text-white" aria-hidden />
            )}
            <span className="featured-preview-toggle__label">
              {playing ? "Duraklat" : "Önizle"}
            </span>
          </button>
        </div>
      ) : null}

      {loading ? (
        <div
          className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center"
          data-featured-preview-loading=""
          aria-hidden
        >
          <div className="flex size-11 items-center justify-center rounded-full bg-black/45 ring-1 ring-white/15 backdrop-blur-sm">
            <Loader2 className="size-5 animate-spin text-white" />
          </div>
        </div>
      ) : null}

      <div className="absolute bottom-4 left-4 z-40 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-medium text-white ring-1 ring-white/15 backdrop-blur-sm">
          {PLATFORM_LABELS[video.platform]}
        </span>

        {canPreview && !previewFailed && videoLink ? (
          <a
            href={videoLink.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={videoLink.label}
            data-featured-open-content=""
            className="featured-preview-open-link inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white ring-1 ring-white/20 backdrop-blur-sm"
            onClick={(event) => event.stopPropagation()}
          >
            <ExternalLink className="size-3 opacity-90" aria-hidden />
            İçeriği aç
          </a>
        ) : null}
      </div>

      {/*
        Full-bleed open:
        - Poster-only cards: always.
        - Preview cards: desktop hover path; CSS disables pointer-events on
          coarse/no-hover. Hidden while playing so taps don't steal TikTok open.
      */}
      {videoLink && !playing ? (
        <ReportVideoLink
          link={videoLink}
          className={
            canPreview && !previewFailed
              ? "featured-preview-bleed-link"
              : undefined
          }
        />
      ) : null}
    </div>
  );
}
