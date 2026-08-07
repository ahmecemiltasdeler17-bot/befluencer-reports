import { redirect } from "next/navigation";

import { LoginForm } from "@/app/login/login-form";
import { getVerifiedAuth } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export default async function LoginPage() {
  const supabase = await createClient();
  const auth = await getVerifiedAuth(supabase);

  if (auth) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#09090B] px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            BeFluencer Reports
          </h1>
          <p className="mt-2 text-sm text-zinc-400">İç panele giriş</p>
        </div>

        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-6 shadow-2xl shadow-black/40 backdrop-blur-sm min-[480px]:p-8">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
