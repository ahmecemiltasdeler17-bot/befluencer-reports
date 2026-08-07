export type CreatorListErrorCode =
  | "list_not_found"
  | "invalid_creator_ids"
  | "duplicate_item"
  | "selection_limit"
  | "share_invalid"
  | "share_expired"
  | "share_revoked"
  | "csv_disabled"
  | "campaign_not_found"
  | "assignment_failure"
  | "validation_failed"
  | "database_failure"
  | "migration_missing"
  | "rls_denied"
  | "list_insert_failure"
  | "item_insert_failure"
  | "partial_create_failure"
  | "not_authenticated"
  | "app_origin_invalid";

const TURKISH: Record<CreatorListErrorCode, string> = {
  list_not_found: "Creator listesi bulunamadı.",
  invalid_creator_ids: "Geçersiz creator seçimi.",
  duplicate_item: "Bu creator zaten listede.",
  selection_limit: "En fazla 500 creator seçebilirsiniz.",
  share_invalid: "Paylaşım bağlantısı geçersiz.",
  share_expired: "Paylaşım bağlantısının süresi dolmuş.",
  share_revoked: "Paylaşım bağlantısı iptal edilmiş.",
  csv_disabled: "Bu paylaşım için CSV indirme kapalı.",
  campaign_not_found: "Kampanya bulunamadı.",
  assignment_failure: "Kampanyaya ekleme tamamlanamadı.",
  validation_failed: "Girilen bilgiler geçersiz.",
  database_failure: "Veritabanı hatası oluştu. Lütfen tekrar deneyin.",
  migration_missing:
    "Creator listeleri veritabanı tabloları henüz uygulanmamış. Migration 20260805310000 gerekli.",
  rls_denied: "Bu işlem için yetkiniz yok.",
  list_insert_failure: "Liste kaydı oluşturulamadı.",
  item_insert_failure: "Liste creatorları kaydedilemedi.",
  partial_create_failure:
    "Liste oluşturuldu ancak creatorlar eklenemedi. Liste temizlendi; tekrar deneyin.",
  not_authenticated: "Oturum açmanız gerekiyor.",
  app_origin_invalid: "Paylaşım adresi yapılandırması geçersiz.",
};

/** Production UI stays generic for infrastructure failures. */
const PRODUCTION_GENERIC = new Set<CreatorListErrorCode>([
  "migration_missing",
  "rls_denied",
  "list_insert_failure",
  "item_insert_failure",
  "partial_create_failure",
  "database_failure",
]);

export const PUBLIC_CREATOR_LIST_UNAVAILABLE_MESSAGE =
  "Bu creator listesi kullanılamıyor.";

export function resolveCreatorListUserMessage(
  code: CreatorListErrorCode,
  nodeEnv: string | undefined = process.env.NODE_ENV
): string {
  if (nodeEnv === "production" && PRODUCTION_GENERIC.has(code)) {
    return TURKISH.database_failure;
  }

  return TURKISH[code];
}

export class CreatorListError extends Error {
  readonly code: CreatorListErrorCode;

  constructor(code: CreatorListErrorCode, message?: string) {
    super(message ?? TURKISH[code]);
    this.name = "CreatorListError";
    this.code = code;
  }

  toUserMessage(): string {
    return resolveCreatorListUserMessage(this.code);
  }
}

export function toCreatorListUserMessage(error: unknown): string {
  if (error instanceof CreatorListError) {
    return error.toUserMessage();
  }

  return TURKISH.database_failure;
}

export function creatorListErrorMessage(code: CreatorListErrorCode): string {
  return TURKISH[code];
}
