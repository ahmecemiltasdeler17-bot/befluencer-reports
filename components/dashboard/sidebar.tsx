"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { APP_NAME, NAV_ITEMS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navContent = (
    <>
      <div className="flex h-14 items-center gap-2.5 px-5">
        <div className="flex size-7 items-center justify-center rounded-lg bg-white text-xs font-bold text-zinc-950">
          BF
        </div>
        <span className="text-sm font-semibold tracking-tight text-white">
          {APP_NAME}
        </span>
      </div>

      <Separator className="bg-white/8" />

      <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.label}
              href={item.disabled ? "#" : item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-white/10 text-white"
                  : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200",
                item.disabled && "pointer-events-none opacity-40"
              )}
            >
              <Icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-white/8 p-4">
        <div className="rounded-lg bg-white/5 px-3 py-3">
          <p className="text-xs font-medium text-zinc-300">Campaign Report</p>
          <p className="mt-0.5 text-xs text-zinc-500">Midnight Drive · Active</p>
        </div>
      </div>
    </>
  );

  return (
    <>
      <div className="fixed top-0 right-0 left-0 z-40 flex h-14 items-center justify-between border-b border-white/8 bg-[#09090B] px-4 lg:hidden">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-lg bg-white text-xs font-bold text-zinc-950">
            BF
          </div>
          <span className="text-sm font-semibold text-white">{APP_NAME}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </Button>
      </div>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed top-0 left-0 z-40 flex h-full w-[240px] flex-col border-r border-white/8 bg-[#09090B] transition-transform duration-200 lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {navContent}
      </aside>
    </>
  );
}
