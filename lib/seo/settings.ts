import { prisma } from "@/lib/db/prisma";

export const siteSettingKeys = {
  googleSiteVerification: "google_site_verification",
  bingSiteVerification: "bing_site_verification",
  gaMeasurementId: "ga_measurement_id",
} as const;

export type SeoSettings = {
  googleSiteVerification: string | null;
  bingSiteVerification: string | null;
  gaMeasurementId: string | null;
};

export async function getSeoSettings(): Promise<SeoSettings> {
  const rows = await prisma.siteSetting.findMany({
    where: {
      key: {
        in: [siteSettingKeys.googleSiteVerification, siteSettingKeys.bingSiteVerification, siteSettingKeys.gaMeasurementId],
      },
    },
    select: {
      key: true,
      value: true,
    },
  });

  const settingMap = new Map(rows.map((row) => [row.key, row.value]));

  return {
    googleSiteVerification: settingMap.get(siteSettingKeys.googleSiteVerification) || null,
    bingSiteVerification: settingMap.get(siteSettingKeys.bingSiteVerification) || null,
    gaMeasurementId: settingMap.get(siteSettingKeys.gaMeasurementId) || null,
  };
}
