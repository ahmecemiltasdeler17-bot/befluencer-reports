"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z
    .string({ error: "E-posta gereklidir." })
    .trim()
    .min(1, "E-posta gereklidir.")
    .email("Geçerli bir e-posta adresi girin."),
  password: z
    .string({ error: "Parola gereklidir." })
    .min(1, "Parola gereklidir."),
});

export type LoginState = {
  error?: string;
};

function mapAuthError(message: string): string {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("invalid login credentials") ||
    normalized.includes("invalid credentials")
  ) {
    return "E-posta veya parola hatalı.";
  }

  if (normalized.includes("email not confirmed")) {
    return "E-posta adresiniz henüz doğrulanmamış.";
  }

  return "Giriş yapılamadı. Lütfen tekrar deneyin.";
}

export async function login(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Geçersiz giriş bilgileri.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: mapAuthError(error.message) };
  }

  redirect("/");
}
