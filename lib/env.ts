import { z } from "zod";

const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string({
      error: "NEXT_PUBLIC_SUPABASE_URL is required.",
    })
    .url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL."),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string({
      error: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required.",
    })
    .min(1, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY cannot be empty."),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;

function formatEnvErrors(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.join(".") || "environment";
      return `  - ${path}: ${issue.message}`;
    })
    .join("\n");
}

/**
 * Validates public Supabase environment variables.
 * Server-only variables (Apify) are validated in lib/env.server.ts.
 * Throws with a readable message in development when configuration is invalid.
 */
export function getClientEnv(): ClientEnv {
  const parsed = clientEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });

  if (!parsed.success) {
    const details = formatEnvErrors(parsed.error);
    const message = [
      "BeFluencer Reports — Supabase environment configuration is invalid.",
      "",
      "Add the following variables to .env.local:",
      "  NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co",
      "  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key",
      "",
      "Validation errors:",
      details,
    ].join("\n");

    throw new Error(message);
  }

  return parsed.data;
}

/**
 * Lazily cached env for modules that read configuration frequently.
 */
let cachedEnv: ClientEnv | null = null;

export function env(): ClientEnv {
  if (!cachedEnv) {
    cachedEnv = getClientEnv();
  }
  return cachedEnv;
}
