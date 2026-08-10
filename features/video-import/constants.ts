/** Max TikTok video URLs accepted per preview/import batch. */
export const VIDEO_IMPORT_MAX_URLS = 100;

/** Provider fetch concurrency for preview (matches campaign sync). */
export const VIDEO_IMPORT_PROVIDER_CONCURRENCY = 2;

export const VIDEO_IMPORT_CREATOR_STATUS_LABELS = {
  matched_existing: "Mevcut creator eşleşti",
  will_create: "Yeni creator oluşturulacak",
  manual_required: "Manuel eşleştirme gerekli",
  none: "—",
} as const;

export const VIDEO_IMPORT_VIDEO_STATUS_LABELS = {
  importable: "Eklenebilir",
  already_in_campaign: "Zaten kampanyada",
  exists_elsewhere: "Sistemde mevcut (kampanyaya bağlanamaz)",
  invalid_url: "Geçersiz bağlantı",
  provider_empty: "Sağlayıcı sonucu alınamadı",
  login_required_content: "Giriş gerekli içerik",
  creator_unverified: "Creator kimliği doğrulanamadı",
} as const;

export const VIDEO_IMPORT_MESSAGES = {
  invalid_url: "Geçersiz TikTok video bağlantısı.",
  already_in_campaign: "Video zaten bu kampanyada bulunuyor.",
  exists_elsewhere: "Video sistemde başka bir kayıtta mevcut; kampanyaya bağlanamaz.",
  creator_unverified: "Video bulundu ancak creator bilgisi doğrulanamadı.",
  provider_empty: "TikTok sağlayıcısı bu bağlantı için sonuç döndürmedi.",
  login_required_content:
    "TikTok bu videoyu giriş yapılmadan görüntülemeye izin vermiyor.",
  login_required_content_detail:
    "Video hassas/yaş kısıtlı veya oturum gerektiren içerik olabilir.",
  manual_required: "Creator eşleştirmesi gerekli.",
  added: "Video başarıyla eklendi.",
  linked: "Mevcut video kampanyaya bağlandı.",
  batch_limit: `En fazla ${VIDEO_IMPORT_MAX_URLS} video bağlantısı kontrol edilebilir.`,
  not_authenticated: "Oturum açmanız gerekiyor.",
  campaign_not_found: "Kampanya bulunamadı.",
  sync_not_configured: "TikTok senkronizasyonu yapılandırılmamış.",
  nothing_selected: "İçe aktarılacak satır seçilmedi.",
} as const;
