import { PUBLIC_SHARE_UNAVAILABLE_MESSAGE } from "@/features/public-reports/errors";

export function PublicShareUnavailable() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#09090B] px-6 font-sans">
      <div className="max-w-md text-center">
        <p className="text-[11px] tracking-[0.18em] text-zinc-500 uppercase">
          BeFluencer Reports
        </p>
        <h1 className="mt-4 text-xl font-semibold text-white">
          Bağlantı kullanılamıyor
        </h1>
        <p className="mt-3 text-sm text-zinc-500">
          {PUBLIC_SHARE_UNAVAILABLE_MESSAGE}
        </p>
      </div>
    </div>
  );
}
