"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Genel Bakış", match: (path: string) => path === "/" },
  {
    href: "/campaigns",
    label: "Kampanyalar",
    match: (path: string) => path.startsWith("/campaigns"),
  },
  {
    href: "/creators",
    label: "İçerik Üreticileri",
    match: (path: string) =>
      path.startsWith("/creators") && !path.startsWith("/creator-lists"),
  },
  {
    href: "/creator-lists",
    label: "Creator Listeleri",
    match: (path: string) => path.startsWith("/creator-lists"),
  },
  {
    href: "/reports",
    label: "Raporlar",
    match: (path: string) => path === "/reports",
  },
  {
    href: "/settings",
    label: "Ayarlar",
    match: (path: string) =>
      path.startsWith("/settings") && !path.startsWith("/settings/sync"),
  },
  {
    href: "/settings/sync",
    label: "Senkron",
    match: (path: string) => path.startsWith("/settings/sync"),
  },
] as const;

export function ManagementNav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-zinc-800 bg-zinc-950/90">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-sm font-semibold text-white">
            BeFluencer
          </Link>
          <nav className="flex flex-wrap items-center gap-1" aria-label="Yönetim">
            {NAV_ITEMS.map((item) => {
              const active = item.match(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-zinc-900 text-white"
                      : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="rounded-md px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-white"
          >
            Çıkış
          </button>
        </form>
      </div>
    </header>
  );
}
