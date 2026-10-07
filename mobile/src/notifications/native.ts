/**
 * Pemuat kondisional `expo-notifications`.
 *
 * Expo Go Android (SDK 53+) tidak lagi menyertakan fungsi notifikasi push; mengimpor modul itu di
 * Expo Go memicu galat dan membuat rute gagal dimuat. Di Expo Go Android & web modul dilewati
 * (null) — notifikasi berfungsi penuh di development build dan APK.
 */
import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import type * as ExpoNotifications from 'expo-notifications';

export const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let mod: typeof ExpoNotifications | null | undefined;

export function getNotifications(): typeof ExpoNotifications | null {
  if (mod !== undefined) return mod;
  if (Platform.OS === 'web' || (isExpoGo && Platform.OS === 'android')) {
    mod = null;
    return mod;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  mod = require('expo-notifications') as typeof ExpoNotifications;
  // Tampilkan notifikasi juga saat aplikasi sedang dibuka (banner + suara + badge).
  mod.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
  return mod;
}

/** true bila notifikasi tersedia di lingkungan ini (bukan Expo Go Android/web). */
export const notificationsAvailable = () => getNotifications() !== null;
