import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { SoundMetricSummaryPanel } from "@/features/sound-sync/components/sound-metric-summary";
import { SoundSnapshotHistory } from "@/features/sound-sync/components/sound-snapshot-history";
import { SoundUrlForm } from "@/features/sound-sync/components/sound-url-form";
import { SyncSoundButton } from "@/features/sound-sync/components/sync-sound-button";
import type {
  CampaignSoundConfiguration,
  SoundMetricSnapshot,
  SoundMetricSummary,
} from "@/features/sound-sync/types";
import { isTikTokSoundUrl } from "@/lib/providers/tiktok/sound-url";
import { cn } from "@/lib/utils";

function buildQualityMessages(
  configuration: CampaignSoundConfiguration,
  summary: SoundMetricSummary
): string[] {
  const messages: string[] = [];

  if (!configuration.soundUrl) {
    messages.push("Senkronizasyon için TikTok ses bağlantısı ekleyin.");
    return messages;
  }

  if (!isTikTokSoundUrl(configuration.soundUrl)) {
    messages.push("Kayıtlı ses bağlantısı geçersiz veya desteklenmiyor.");
  } else if (!configuration.soundId) {
    messages.push(
      "Ses kimliği URL’den çözümlenemedi. Senkronizasyon sağlayıcı doğrulamasına güvenebilir."
    );
  }

  if (configuration.syncStatus === "failed") {
    messages.push("Son ses senkronizasyonu başarısız oldu.");
  }

  if (summary.snapshotCount === 0) {
    messages.push("Henüz başarılı bir ses kullanım kaydı yok.");
  }

  return messages;
}

export function CampaignSoundTrackingSection({
  campaignId,
  configuration,
  summary,
  history,
  syncConfigured,
}: {
  campaignId: string;
  configuration: CampaignSoundConfiguration;
  summary: SoundMetricSummary;
  history: SoundMetricSnapshot[];
  syncConfigured: boolean;
}) {
  const qualityMessages = buildQualityMessages(configuration, summary);

  return (
    <section
      id="sound-tracking"
      className="scroll-mt-24 space-y-6 rounded-xl border border-zinc-800 bg-zinc-950/40 p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium text-white">TikTok Ses Takibi</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Ses kullanım sayısı TikTok üzerindeki toplam video adedidir; erişim
            veya kampanya video sayısı değildir.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/campaigns/${campaignId}/sound-metrics/new`}
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Manuel Kayıt Ekle
          </Link>
          <SyncSoundButton
            campaignId={campaignId}
            hasSoundUrl={Boolean(configuration.soundUrl)}
            syncConfigured={syncConfigured}
          />
        </div>
      </div>

      <SoundUrlForm
        campaignId={campaignId}
        initialSoundUrl={configuration.soundUrl}
      />

      <SoundMetricSummaryPanel
        configuration={configuration}
        summary={summary}
        qualityMessages={qualityMessages}
      />

      <SoundSnapshotHistory rows={history} />
    </section>
  );
}
