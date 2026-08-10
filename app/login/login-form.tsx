"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { login, type LoginState } from "@/app/login/actions";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <label
          htmlFor="email"
          className="text-sm font-medium text-zinc-300"
        >
          E-posta
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={isPending}
          className="h-11 w-full rounded-lg border border-[var(--bf-border)] bg-[color-mix(in_srgb,var(--bf-bg)_80%,transparent)] px-3 text-sm text-[var(--bf-text)] outline-none transition-colors placeholder:text-[var(--bf-text-muted)] focus:border-primary/60 focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
          placeholder="ornek@befluencer.com"
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="password"
          className="text-sm font-medium text-zinc-300"
        >
          Parola
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={isPending}
          className="h-11 w-full rounded-lg border border-[var(--bf-border)] bg-[color-mix(in_srgb,var(--bf-bg)_80%,transparent)] px-3 text-sm text-[var(--bf-text)] outline-none transition-colors placeholder:text-[var(--bf-text-muted)] focus:border-primary/60 focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
          placeholder="••••••••"
        />
      </div>

      {state.error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
        >
          {state.error}
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={isPending}
        className="h-11 w-full bg-primary text-primary-foreground hover:bg-primary/90"
      >
        {isPending ? "Giriş yapılıyor…" : "Giriş Yap"}
      </Button>
    </form>
  );
}
