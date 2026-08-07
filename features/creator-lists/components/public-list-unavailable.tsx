import { PUBLIC_CREATOR_LIST_UNAVAILABLE_MESSAGE } from "@/features/creator-lists/errors";

export function PublicListUnavailable() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#09090B] px-6">
      <div className="max-w-md text-center">
        <p className="text-sm font-semibold tracking-wide text-orange-400">
          BeFluencer
        </p>
        <h1 className="mt-4 text-xl font-semibold text-white">
          Liste kullanılamıyor
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          {PUBLIC_CREATOR_LIST_UNAVAILABLE_MESSAGE}
        </p>
      </div>
    </div>
  );
}
