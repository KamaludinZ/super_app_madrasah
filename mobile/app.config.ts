/// <reference types="node" />
import type { ConfigContext, ExpoConfig } from 'expo/config';
import fs from 'fs';
import path from 'path';

/**
 * Konfigurasi dinamis: menambahkan `google-services.json` (Firebase Cloud Messaging) hanya bila
 * berkas itu ada, dan mengisi EAS projectId dari env `EAS_PROJECT_ID` bila belum diisi di app.json.
 * Nilai statis lainnya tetap di app.json agar `eas init` / `eas build` dapat membacanya.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const googleServices = path.join(__dirname, 'google-services.json');
  const hasGoogleServices = fs.existsSync(googleServices);
  const projectId = config.extra?.eas?.projectId || process.env.EAS_PROJECT_ID || undefined;

  return {
    ...config,
    name: config.name ?? 'Super Apps MATSANDATAMA',
    slug: config.slug ?? 'super-apps-matsandatama',
    android: {
      ...config.android,
      ...(hasGoogleServices ? { googleServicesFile: './google-services.json' } : {}),
    },
    extra: {
      ...config.extra,
      eas: projectId ? { projectId } : {},
      apiUrl: process.env.EXPO_PUBLIC_API_URL,
    },
  };
};
