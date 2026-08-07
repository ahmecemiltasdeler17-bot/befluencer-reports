export type ScheduledSyncErrorCode =
  | "unauthorized"
  | "not_configured"
  | "lock_unavailable"
  | "orchestrator_failure";

const TURKISH_MESSAGES: Record<ScheduledSyncErrorCode, string> = {
  unauthorized: "Yetkisiz istek.",
  not_configured: "Zamanlanmış senkronizasyon yapılandırılmamış.",
  lock_unavailable: "Başka bir senkronizasyon çalışıyor.",
  orchestrator_failure: "Zamanlanmış senkronizasyon başarısız oldu.",
};

export class ScheduledSyncError extends Error {
  readonly code: ScheduledSyncErrorCode;

  constructor(code: ScheduledSyncErrorCode, message?: string) {
    super(message ?? TURKISH_MESSAGES[code]);
    this.name = "ScheduledSyncError";
    this.code = code;
  }

  toUserMessage(): string {
    return this.message;
  }
}

export function scheduledSyncErrorMessage(
  code: ScheduledSyncErrorCode
): string {
  return TURKISH_MESSAGES[code];
}
