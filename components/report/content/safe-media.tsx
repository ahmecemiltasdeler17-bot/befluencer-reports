"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

import { isValidImageSrc } from "@/lib/media-fallback-styles";
import type { Platform } from "@/lib/types";
import { cn } from "@/lib/utils";

import { MediaFallback } from "./media-fallback";

interface SafeAvatarProps {
  src?: string | null;
  name: string;
  seed?: string;
  className?: string;
  size?: number;
}

export function SafeAvatar({
  src,
  name,
  seed,
  className,
  size = 40,
}: SafeAvatarProps) {
  const [failed, setFailed] = useState(false);
  const fallbackSeed = seed ?? name;
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const shouldFallback = useMemo(
    () => failed || !isValidImageSrc(src),
    [failed, src]
  );

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full ring-1 ring-white/10",
        className
      )}
      style={{ width: size, height: size }}
    >
      {shouldFallback ? (
        <MediaFallback
          variant="avatar"
          seed={fallbackSeed}
          initials={initials}
        />
      ) : (
        <Image
          src={src as string}
          alt=""
          fill
          className="object-cover"
          sizes={`${size}px`}
          onError={() => setFailed(true)}
          unoptimized
        />
      )}
    </div>
  );
}

interface SafeThumbnailProps {
  src?: string | null;
  seed: string;
  name: string;
  username?: string;
  title?: string;
  platform?: Platform | string;
  featured?: boolean;
  className?: string;
  sizes?: string;
}

export function SafeThumbnail({
  src,
  seed,
  name,
  username,
  title,
  platform = "TikTok",
  featured = false,
  className,
  sizes = "330px",
}: SafeThumbnailProps) {
  const [failed, setFailed] = useState(false);

  const shouldFallback = useMemo(
    () => failed || !isValidImageSrc(src),
    [failed, src]
  );

  return (
    <div className={cn("relative h-full w-full overflow-hidden", className)}>
      {shouldFallback ? (
        <MediaFallback
          variant={featured ? "featured" : "video"}
          seed={seed}
          initials={name
            .split(" ")
            .map((part) => part[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()}
          username={username}
          title={title}
          platform={
            platform === "tiktok"
              ? "TikTok"
              : platform === "instagram"
                ? "Instagram"
                : platform === "youtube"
                  ? "YouTube"
                  : platform
          }
        />
      ) : (
        <Image
          src={src as string}
          alt=""
          fill
          className="object-cover"
          sizes={sizes}
          onError={() => setFailed(true)}
          unoptimized
        />
      )}
    </div>
  );
}
