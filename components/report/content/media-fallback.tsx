"use client";

import { Play } from "lucide-react";

import {
  getAvatarTheme,
  getPosterTheme,
} from "@/lib/media-fallback-styles";
import { cn } from "@/lib/utils";

interface MediaFallbackProps {
  variant: "avatar" | "video" | "featured";
  seed: string;
  initials?: string;
  username?: string;
  title?: string;
  platform?: string;
  className?: string;
  /** Discreet note when a real CDN image failed (not for empty sources). */
  showUnavailableNotice?: boolean;
}

export function MediaFallback({
  variant,
  seed,
  initials,
  username,
  title,
  platform = "TikTok",
  className,
  showUnavailableNotice = false,
}: MediaFallbackProps) {
  if (variant === "avatar") {
    return <AvatarFallback seed={seed} initials={initials} className={className} />;
  }

  return (
    <VideoPosterFallback
      seed={seed}
      initials={initials}
      username={username}
      title={title}
      platform={platform}
      featured={variant === "featured"}
      className={className}
      showUnavailableNotice={showUnavailableNotice}
    />
  );
}

function AvatarFallback({
  seed,
  initials = "?",
  className,
}: {
  seed: string;
  initials?: string;
  className?: string;
}) {
  const theme = getAvatarTheme(seed);

  return (
    <div
      className={cn("absolute inset-0 overflow-hidden rounded-full", className)}
      aria-hidden
    >
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg, ${theme.from} 0%, ${theme.via} 55%, ${theme.to} 100%)`,
        }}
      />
      <div
        className="absolute inset-0 opacity-40"
        style={{
          background: `radial-gradient(circle at 30% 20%, ${theme.glow}55 0%, transparent 55%)`,
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[11px] font-bold tracking-[0.12em] text-white/90 uppercase">
          {initials}
        </span>
      </div>
    </div>
  );
}

function VideoPosterFallback({
  seed,
  initials,
  username,
  title,
  platform,
  featured = false,
  className,
  showUnavailableNotice = false,
}: {
  seed: string;
  initials?: string;
  username?: string;
  title?: string;
  platform?: string;
  featured?: boolean;
  className?: string;
  showUnavailableNotice?: boolean;
}) {
  const theme = getPosterTheme(seed);
  const shapeOffset = hashMod(seed, 360);
  const markInitial =
    initials && initials.length > 0
      ? initials.slice(0, 1)
      : username?.replace(/^@/, "").slice(0, 1).toUpperCase() || "B";

  return (
    <div
      className={cn("absolute inset-0 overflow-hidden", className)}
      aria-hidden
    >
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(160deg, ${theme.from} 0%, ${theme.via} 45%, ${theme.to} 100%)`,
        }}
      />

      <div
        className="absolute -top-8 -right-10 size-40 rounded-full blur-3xl opacity-50"
        style={{
          backgroundColor: featured ? "rgba(168, 212, 240, 0.55)" : theme.glow,
        }}
      />
      <div
        className="absolute bottom-16 -left-8 size-32 rounded-full blur-2xl opacity-35"
        style={{
          backgroundColor: theme.accent,
          transform: `rotate(${shapeOffset}deg)`,
        }}
      />
      <div
        className="absolute top-1/3 right-0 size-24 rounded-full blur-2xl opacity-30"
        style={{ backgroundColor: "rgba(107, 163, 199, 0.55)" }}
      />

      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 18px)",
        }}
      />

      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/35" />

      <div className="absolute top-3 left-3 flex items-center gap-1.5">
        <span className="rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-medium text-white ring-1 ring-white/15 backdrop-blur-sm">
          {platform}
        </span>
      </div>

      <div className="absolute top-3 right-3">
        <span className="rounded-full bg-black/45 px-2 py-0.5 text-[9px] font-semibold tracking-[0.14em] text-white/70 ring-1 ring-white/10 backdrop-blur-sm uppercase">
          BF
        </span>
      </div>

      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className={cn(
            "pointer-events-none absolute font-semibold tracking-wide text-white/12 select-none",
            featured ? "text-7xl" : "text-6xl"
          )}
        >
          {markInitial}
        </span>
        <div
          className={cn(
            "relative z-10 flex items-center justify-center rounded-full bg-black/35 ring-1 ring-white/20 backdrop-blur-sm",
            featured ? "size-16 shadow-[0_0_40px_rgba(255,90,0,0.35)]" : "size-14"
          )}
        >
          <Play
            className={cn(
              "fill-white text-white",
              featured ? "size-7" : "size-6"
            )}
          />
        </div>
      </div>

      {showUnavailableNotice && (
        <p className="absolute inset-x-0 top-1/2 z-10 mt-12 text-center text-[10px] tracking-wide text-white/50">
          Görsel kullanılamıyor
        </p>
      )}

      <div className="absolute right-3 bottom-3 left-3 space-y-1">
        {username && (
          <p className="truncate text-sm font-semibold text-white">{username}</p>
        )}
        {title && (
          <p className="line-clamp-2 text-xs leading-relaxed text-zinc-300/90">
            {title}
          </p>
        )}
      </div>
    </div>
  );
}

function hashMod(seed: string, mod: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % mod;
}
