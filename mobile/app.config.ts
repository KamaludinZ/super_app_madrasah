/// <reference types="node" />
import type { ConfigContext, ExpoConfig } from 'expo/config';
import fs from 'fs';
import path from 'path';

/**
 * Konfigurasi dinamis: menambahkan `google-services.json` (Firebase Cloud Messaging) dari variabel berkas
 * EAS `GOOGLE_SERVICES_JSON` (build di server EAS; berkas rahasia tidak masuk Git) atau berkas lokal bila ada,
 * dan mengisi EAS projectId dari env `EAS_PROJECT_ID` bila belum diisi di app.json.
 * Nilai statis lainnya tetap di app.json agar `eas init` / `eas build` dapat membacanya.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const googleServices = process.env.GOOGLE_SERVICES_JSON
    || (fs.existsSync(path.join(__dirname, 'google-services.json')) ? './google-services.json' : undefined);
  const projectId = config.extra?.eas?.projectId || process.env.EAS_PROJECT_ID || undefined;

  return {
    ...config,
    name: config.name ?? 'Super Apps MATSANDATAMA',
    slug: config.slug ?? 'matsandatama-dev',
    android: {
      ...config.android,
      ...(googleServices ? { googleServicesFile: googleServices } : {}),
    },
    extra: {
      ...config.extra,
      eas: projectId ? { projectId } : {},
      apiUrl: process.env.EXPO_PUBLIC_API_URL,
    },
  };
};
