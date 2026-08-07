"use client";

import type { FormEvent, ReactNode } from "react";

/**
 * GET filter form that preserves the current URL sort state on submit.
 * Sort clicks update the query via history.replaceState (no remount), so
 * static hidden inputs would go stale — we sync from the live URL instead.
 */
export function CreatorDirectoryFilterForm({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const live = new URLSearchParams(window.location.search);

    for (const key of ["sort", "direction"] as const) {
      form.querySelectorAll(`input[name="${key}"]`).forEach((node) => {
        node.remove();
      });

      const value = live.get(key);
      if (!value) {
        continue;
      }

      const input = document.createElement("input");
      input.type = "hidden";
      input.name = key;
      input.value = value;
      form.appendChild(input);
    }
  }

  return (
    <form method="get" className={className} onSubmit={handleSubmit}>
      {children}
    </form>
  );
}
