"use client";

import { useState } from "react";

import {
  getCreatorAvatarSeed,
  getCreatorInitials,
} from "@/features/creators/get-creator-initials";
import { cn } from "@/lib/utils";

const GRADIENTS = [
  "from-zinc-700 to-zinc-900",
  "from-orange-900/80 to-zinc-900",
  "from-amber-900/70 to-zinc-900",
  "from-stone-700 to-zinc-900",
] as const;

export function CreatorAvatar({
  username,
  displayName,
  avatarUrl,
  size = "md",
  className,
}: {
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  // Starts false on server and on the client's first paint so SSR markup matches
  // hydration. Image load/error may change the overlay only after hydration.
  const [failed, setFailed] = useState(false);

  const initials = getCreatorInitials(displayName ?? null, username);
  const gradient =
    GRADIENTS[getCreatorAvatarSeed(username) % GRADIENTS.length];

  const sizeClasses = {
    sm: "size-8 text-[10px]",
    md: "size-10 text-xs",
    lg: "size-16 text-sm",
  }[size];

  const showImage = Boolean(avatarUrl) && !failed;

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full ring-1 ring-zinc-800",
        sizeClasses,
        className
      )}
    >
      <div
        className={cn(
          "flex size-full items-center justify-center bg-gradient-to-br font-medium text-zinc-200",
          gradient
        )}
        aria-hidden={showImage ? true : undefined}
        data-creator-initials={initials}
      >
        {initials}
      </div>
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl as string}
          alt=""
          className="absolute inset-0 size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : null}
    </div>
  );
}
