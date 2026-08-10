"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import {
  ariaSortValue,
  creatorDirectorySortButtonLabelTr,
  type CreatorDirectorySortKey,
  type CreatorDirectorySortState,
} from "@/features/creators/directory-sort";
import { cn } from "@/lib/utils";

export function CreatorDirectorySortHeader({
  column,
  label,
  state,
  onSort,
  className,
}: {
  column: CreatorDirectorySortKey;
  label: string;
  state: CreatorDirectorySortState;
  onSort: (column: CreatorDirectorySortKey) => void;
  className?: string;
}) {
  const active = state.sort === column && state.direction !== null;
  const sortValue = ariaSortValue(column, state);
  const buttonLabel = creatorDirectorySortButtonLabelTr(column, state);

  return (
    <th
      scope="col"
      aria-sort={sortValue}
      className={cn("px-4 py-3 font-medium", className)}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        aria-label={buttonLabel}
        className={cn(
          "group inline-flex min-h-9 items-center gap-1.5 rounded-md px-1 py-1 text-left",
          "outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950",
          active ? "text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
        )}
      >
        <span>{label}</span>
        <span
          className="inline-flex h-4 w-4 shrink-0 items-center justify-center"
          aria-hidden="true"
        >
          {state.sort === column && state.direction === "asc" ? (
            <ArrowUp className="h-3.5 w-3.5" />
          ) : state.sort === column && state.direction === "desc" ? (
            <ArrowDown className="h-3.5 w-3.5" />
          ) : (
            <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
          )}
        </span>
      </button>
    </th>
  );
}
