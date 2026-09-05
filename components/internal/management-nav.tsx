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
    href: "/clients",
    label: "Müşteri Erişimi",
    match: (path: string) => path.startsWith("/clients"),
  },
  {
    href: "/leads",
    label: "Gelen Talepler",
    match: (path: string) => path.startsWith("/leads"),
  },
  {
    href: "/finance",
    label: "Kişisel Finans",
    match: (path: string) => path.startsWith("/finance"),
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
    <header className="sticky top-0 z-50 border-b border-[var(--bf-border)] bg-[color-mix(in_srgb,var(--bf-bg)_92%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-4 lg:gap-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 text-sm font-semibold tracking-tight text-[var(--bf-text)]"
          >
            <span
              className="flex size-6 shrink-0 items-center justify-center rounded-[5px] bg-[var(--bf-accent)] text-[9px] font-semibold tracking-tight text-[var(--bf-bg)]"
              aria-hidden="true"
            >
              BF
            </span>
            <span className="tracking-[0.14em] uppercase">BeFluencer</span>
          </Link>
          <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Yönetim">
            {NAV_ITEMS.map((item) => {
              const active = item.match(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative shrink-0 rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-[color-mix(in_srgb,var(--bf-accent)_12%,transparent)] text-[var(--bf-accent)] before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-[var(--bf-accent)]"
                      : "text-[var(--bf-text-secondary)] hover:bg-[var(--bf-surface)] hover:text-[var(--bf-text)]"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <form action="/auth/signout" method="post" className="shrink-0">
          <button
            type="submit"
            className="rounded-md px-3 py-1.5 text-sm text-[var(--bf-text-secondary)] transition-colors hover:bg-[var(--bf-surface)] hover:text-[var(--bf-text)]"
          >
            Çıkış
          </button>
        </form>
      </div>
    </header>
  );
}
