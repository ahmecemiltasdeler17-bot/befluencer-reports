export type TikTokProviderErrorCode =
  | "invalid_url"
  | "unavailable_video"
  | "auth_failure"
  | "rate_limit"
  | "empty_result"
  | "malformed_result"
  | "unsupported_result"
  | "follower_count_unavailable"
  | "upstream_failure"
  | "not_configured"
  | "invalid_username"
  | "creator_not_found"
  | "private_profile"
  | "username_mismatch"
  | "invalid_sound_url"
  | "unsupported_sound_url"
  | "sound_not_found"
  | "sound_identity_mismatch"
  | "sound_usage_unavailable";

const TURKISH_MESSAGES: Record<TikTokProviderErrorCode, string> = {
  invalid_url: "Geçersiz TikTok video bağlantısı.",
  unavailable_video: "Video kullanılamıyor, gizli veya silinmiş olabilir.",
  auth_failure: "TikTok veri sağlayıcı kimlik doğrulaması başarısız.",
  rate_limit: "TikTok veri sağlayıcı istek limitine ulaşıldı. Lütfen sonra tekrar deneyin.",
  empty_result: "TikTok veri sağlayıcı sonuç döndürmedi.",
  malformed_result: "TikTok veri sağlayıcı yanıtı işlenemedi.",
  unsupported_result:
    "TikTok sağlayıcısının döndürdüğü profil biçimi desteklenmiyor.",
  follower_count_unavailable: "Profil bulundu ancak takipçi sayısı alınamadı.",

  upstream_failure: "TikTok veri sağlayıcı geçici olarak kullanılamıyor.",
  not_configured: "TikTok senkronizasyonu yapılandırılmamış.",
  invalid_username: "Geçersiz TikTok kullanıcı adı.",
  creator_not_found: "TikTok profili bulunamadı.",
  private_profile: "TikTok profili gizli veya kullanılamıyor.",
  username_mismatch:
    "Sağlayıcı farklı bir TikTok hesabı döndürdü. Kullanıcı adını kontrol edin.",
  invalid_sound_url: "Geçersiz TikTok ses bağlantısı.",
  unsupported_sound_url:
    "Bu bağlantı bir TikTok ses sayfası değil. Lütfen /music/ bağlantısı kullanın.",
  sound_not_found: "TikTok sesi bulunamadı veya kullanılamıyor.",
  sound_identity_mismatch:
    "Sağlayıcı farklı bir TikTok sesi döndürdü. Ses bağlantısını kontrol edin.",
  sound_usage_unavailable:
    "TikTok ses kullanım sayısı alınamadı. Sağlayıcı toplam kullanım değeri döndürmedi.",
};

export class TikTokProviderError extends Error {
  readonly code: TikTokProviderErrorCode;

  constructor(code: TikTokProviderErrorCode, message?: string) {
    super(message ?? TURKISH_MESSAGES[code]);
    this.name = "TikTokProviderError";
    this.code = code;
  }

  toUserMessage(): string {
    return this.message;
  }
}

export function toTurkishProviderMessage(error: unknown): string {
  if (error instanceof TikTokProviderError) {
    return error.toUserMessage();
  }

  return "TikTok verisi alınırken beklenmeyen bir hata oluştu.";
}

export function mapHttpStatusToProviderError(status: number): TikTokProviderError {
  if (status === 401 || status === 403) {
    return new TikTokProviderError("auth_failure");
  }

  if (status === 429) {
    return new TikTokProviderError("rate_limit");
  }

  if (status >= 500) {
    return new TikTokProviderError("upstream_failure");
  }

  return new TikTokProviderError("upstream_failure");
}
