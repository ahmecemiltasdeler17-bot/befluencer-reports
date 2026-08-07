import Link from "next/link";

import { CreatorImportForm } from "@/features/creator-import/components/creator-import-form";

export default function CreatorImportPage() {
  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/creators"
          className="text-sm text-zinc-400 transition-colors hover:text-white"
        >
          ← İçerik üreticilerine dön
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-white">
          Toplu Creator Ekle
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          TikTok profil bağlantılarını yapıştırın veya CSV yükleyin. İçe aktarma
          sırasında sağlayıcı çağrılmaz; kimlik alanları oluşturulur.
        </p>
      </div>

      <CreatorImportForm />
    </div>
  );
}
