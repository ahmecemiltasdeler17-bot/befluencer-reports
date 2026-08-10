export type TikTokProviderErrorCode =
  | "invalid_url"
  | "unavailable_video"
  | "login_required_content"
  | "auth_failure"
  | "rate_limit"
  | "payment_required"
  | "actor_not_found"
  | "empty_result"
  | "malformed_result"
  | "unsupported_result"
  | "follower_count_unavailable"
  | "upstream_failure"
  | "actor_run_failed"
  | "actor_run_aborted"
  | "provider_timeout"
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
  login_required_content:
    "TikTok bu videoyu giriş yapılmadan görüntülemeye izin vermiyor.",
  auth_failure: "TikTok veri sağlayıcı kimlik doğrulaması başarısız.",
  rate_limit: "TikTok veri sağlayıcı istek limitine ulaşıldı. Lütfen sonra tekrar deneyin.",
  payment_required:
    "TikTok veri sağlayıcı kullanım kotası doldu. Apify hesabınızı veya planınızı kontrol edin.",
  actor_not_found: "TikTok veri sağlayıcı aktörü bulunamadı.",
  empty_result: "TikTok veri sağlayıcı sonuç döndürmedi.",
  malformed_result: "TikTok veri sağlayıcı yanıtı işlenemedi.",
  unsupported_result:
    "TikTok sağlayıcısının döndürdüğü profil biçimi desteklenmiyor.",
  follower_count_unavailable: "Profil bulundu ancak takipçi sayısı alınamadı.",
  upstream_failure: "TikTok veri sağlayıcı geçici olarak kullanılamıyor.",
  actor_run_failed: "TikTok veri sağlayıcı çalışması başarısız oldu.",
  actor_run_aborted: "TikTok veri sağlayıcı çalışması iptal edildi.",
  provider_timeout: "TikTok veri sağlayıcı isteği zaman aşımına uğradı.",
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

/** Secondary UI explanation — not used for deleted/malformed/temporary failures. */
export const LOGIN_REQUIRED_CONTENT_DETAIL =
  "Video hassas/yaş kısıtlı veya oturum gerektiren içerik olabilir.";

export class TikTokProviderError extends Error {
  readonly code: TikTokProviderErrorCode;
  /** Optional machine-safe detail (e.g. unavailable reason). Never shown raw in UI. */
  readonly detail?: string;

  constructor(
    code: TikTokProviderErrorCode,
    message?: string,
    detail?: string
  ) {
    super(message ?? TURKISH_MESSAGES[code]);
    this.name = "TikTokProviderError";
    this.code = code;
    this.detail = detail;
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

/**
 * Map a persisted Turkish sync_jobs.error_message back to a provider code.
 *
 * IMPORTANT: Do NOT treat bare "kullanılamıyor" as unavailable_video —
 * transient `upstream_failure` is "…geçici olarak kullanılamıyor." and must
 * remain retryable.
 */
export function inferProviderErrorCodeFromUserMessage(
  message: string | null | undefined
): TikTokProviderErrorCode | null {
  if (!message) {
    return null;
  }

  const trimmed = message.trim();
  if (!trimmed) {
    return null;
  }

  for (const [code, catalogMessage] of Object.entries(TURKISH_MESSAGES) as [
    TikTokProviderErrorCode,
    string,
  ][]) {
    if (trimmed === catalogMessage) {
      return code;
    }
  }

  const normalized = trimmed.toLowerCase();

  if (normalized.includes("giriş yapılmadan")) {
    return "login_required_content";
  }
  if (normalized.includes("geçersiz tiktok video")) {
    return "invalid_url";
  }
  if (normalized.includes("farklı bir tiktok videosu")) {
    return "malformed_result";
  }
  // Definitive deleted/private — require this phrase, not bare "kullanılamıyor".
  if (normalized.includes("gizli veya silinmiş")) {
    return "unavailable_video";
  }
  if (
    normalized.includes("video kullanılamıyor") &&
    !normalized.includes("geçici")
  ) {
    return "unavailable_video";
  }
  if (normalized.includes("zaman aşımına")) {
    return "provider_timeout";
  }
  if (normalized.includes("sonuç döndürmedi")) {
    return "empty_result";
  }
  if (
    normalized.includes("geçici olarak kullanılamıyor") ||
    normalized.includes("geçici olarak")
  ) {
    return "upstream_failure";
  }

  return null;
}

/**
 * Map HTTP status (+ optional Apify error type) to a distinct provider error.
 * Never embeds the raw body into the message.
 */
export function mapHttpStatusToProviderError(
  status: number,
  apifyErrorType?: string | null
): TikTokProviderError {
  const type = (apifyErrorType ?? "").toLowerCase();

  if (
    status === 402 ||
    type.includes("not-enough-usage") ||
    type.includes("payment") ||
    type.includes("monthly-usage")
  ) {
    return new TikTokProviderError("payment_required");
  }

  if (status === 401 || status === 403) {
    return new TikTokProviderError("auth_failure");
  }

  if (status === 404) {
    return new TikTokProviderError("actor_not_found");
  }

  if (status === 429) {
    return new TikTokProviderError("rate_limit");
  }

  if (status >= 500) {
    return new TikTokProviderError("upstream_failure");
  }

  return new TikTokProviderError("upstream_failure");
}

/** Best-effort extract of Apify `error.type` without retaining the body. */
export function readApifyErrorType(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const error = (payload as { error?: { type?: unknown } }).error;
  if (!error || typeof error !== "object") {
    return null;
  }

  return typeof error.type === "string" ? error.type : null;
}

export function mapActorTerminalStatus(
  status: string | null
): TikTokProviderError | null {
  if (!status || status === "SUCCEEDED") {
    return null;
  }

  if (status === "FAILED" || status === "TIMED-OUT") {
    return new TikTokProviderError("actor_run_failed");
  }

  if (status === "ABORTED") {
    return new TikTokProviderError("actor_run_aborted");
  }

  return new TikTokProviderError("upstream_failure");
}
