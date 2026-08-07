export type SoundSyncErrorCode =
  | "campaign_not_found"
  | "sound_url_missing"
  | "invalid_sound_url"
  | "unsupported_sound_url"
  | "provider_not_configured"
  | "sound_not_found"
  | "malformed_provider_result"
  | "sound_identity_mismatch"
  | "usage_count_unavailable"
  | "provider_timeout"
  | "snapshot_insert_failure"
  | "campaign_update_failure"
  | "sync_job_failure";

const TURKISH_MESSAGES: Record<SoundSyncErrorCode, string> = {
  campaign_not_found: "Kampanya bulunamadı.",
  sound_url_missing: "Senkronizasyon için TikTok ses bağlantısı ekleyin.",
  invalid_sound_url: "Geçersiz TikTok ses bağlantısı.",
  unsupported_sound_url:
    "Bu bağlantı bir TikTok ses sayfası değil. Lütfen /music/ bağlantısı kullanın.",
  provider_not_configured:
    "TikTok ses senkronizasyonu yapılandırılmamış. APIFY_API_TOKEN ve APIFY_TIKTOK_ACTOR_ID değerlerini .env.local dosyasına ekleyin.",
  sound_not_found: "TikTok sesi bulunamadı veya kullanılamıyor.",
  malformed_provider_result: "TikTok veri sağlayıcı yanıtı işlenemedi.",
  sound_identity_mismatch:
    "Sağlayıcı farklı bir TikTok sesi döndürdü. Ses bağlantısını kontrol edin.",
  usage_count_unavailable:
    "TikTok ses kullanım sayısı alınamadı. Sağlayıcı toplam kullanım değeri döndürmedi.",
  provider_timeout: "TikTok ses senkronizasyonu zaman aşımına uğradı.",
  snapshot_insert_failure: "Ses kullanım kaydı oluşturulamadı.",
  campaign_update_failure: "Kampanya ses bilgileri güncellenemedi.",
  sync_job_failure: "Senkronizasyon kaydı oluşturulamadı.",
};

export class SoundSyncError extends Error {
  readonly code: SoundSyncErrorCode;

  constructor(code: SoundSyncErrorCode, message?: string) {
    super(message ?? TURKISH_MESSAGES[code]);
    this.name = "SoundSyncError";
    this.code = code;
  }

  toUserMessage(): string {
    return this.message;
  }
}

export function soundSyncErrorMessage(code: SoundSyncErrorCode): string {
  return TURKISH_MESSAGES[code];
}
