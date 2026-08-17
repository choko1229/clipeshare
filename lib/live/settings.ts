import { prisma } from "@/lib/db/prisma";

export const liveSettingKeys = {
  offlineGraceSeconds: "live_offline_grace_seconds",
  webBitrateKbpsMax: "live_web_bitrate_kbps_max",
  vrchatVideoBitrateKbpsMax: "live_vrchat_video_bitrate_kbps_max",
  vrchatAudioBitrateKbpsMax: "live_vrchat_audio_bitrate_kbps_max",
  maxConcurrentStreams: "live_max_concurrent_streams",
} as const;

export const liveSettingDefaults = {
  offlineGraceSeconds: 45,
  webBitrateKbpsMax: 8_000,
  vrchatVideoBitrateKbpsMax: 2_000,
  vrchatAudioBitrateKbpsMax: 320,
  maxConcurrentStreams: 4,
};

export type LiveSettings = {
  offlineGraceSeconds: number;
  webBitrateKbpsMax: number;
  vrchatVideoBitrateKbpsMax: number;
  vrchatAudioBitrateKbpsMax: number;
  maxConcurrentStreams: number;
};

export async function getLiveSettings(): Promise<LiveSettings> {
  const rows = await prisma.siteSetting.findMany({
    where: {
      key: {
        in: Object.values(liveSettingKeys),
      },
    },
    select: {
      key: true,
      value: true,
    },
  });

  const settingMap = new Map(rows.map((row) => [row.key, row.value]));

  return {
    offlineGraceSeconds: parsePositiveInt(settingMap.get(liveSettingKeys.offlineGraceSeconds), liveSettingDefaults.offlineGraceSeconds),
    webBitrateKbpsMax: parsePositiveInt(settingMap.get(liveSettingKeys.webBitrateKbpsMax), liveSettingDefaults.webBitrateKbpsMax),
    vrchatVideoBitrateKbpsMax: parsePositiveInt(
      settingMap.get(liveSettingKeys.vrchatVideoBitrateKbpsMax),
      liveSettingDefaults.vrchatVideoBitrateKbpsMax,
    ),
    vrchatAudioBitrateKbpsMax: parsePositiveInt(
      settingMap.get(liveSettingKeys.vrchatAudioBitrateKbpsMax),
      liveSettingDefaults.vrchatAudioBitrateKbpsMax,
    ),
    maxConcurrentStreams: parsePositiveInt(settingMap.get(liveSettingKeys.maxConcurrentStreams), liveSettingDefaults.maxConcurrentStreams),
  };
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}
