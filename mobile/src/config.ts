import * as Application from 'expo-application';
import Constants from 'expo-constants';

const trimSlash = (s: string) => s.replace(/\/+$/, '');

/** Alamat API (termasuk akhiran /api). Diset lewat EXPO_PUBLIC_API_URL (lihat README). */
export const API_URL = trimSlash(
  process.env.EXPO_PUBLIC_API_URL || 'https://api.super.mtsn2kotamalang.sch.id/api',
);
export const WEB_URL = trimSlash(process.env.EXPO_PUBLIC_WEB_URL || 'https://super.mtsn2kotamalang.sch.id');
export const APP_NAME = 'Super Apps MATSANDATAMA';
export const SCHOOL_NAME = 'MTsN 2 Kota Malang';
/** Versi + nomor build (versionCode) agar APK yang terpasang mudah dicocokkan dengan build EAS. */
export const APP_VERSION: string = [
  Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '1.0.0',
  Application.nativeBuildVersion ? `(build ${Application.nativeBuildVersion})` : '',
].filter(Boolean).join(' ');
export const ANDROID_PACKAGE = 'id.sch.mtsn2kotamalang.superapps';
export const EAS_PROJECT_ID: string | undefined = Constants.expoConfig?.extra?.eas?.projectId || undefined;
export const REQUEST_TIMEOUT_MS = 15_000;
export const CACHE_MAX_AGE_DAYS = 14;
export const QUEUE_MAX_ATTEMPTS = 10;
/** Jeda retry antrean (menit): 1, 5, 15, lalu 60 untuk percobaan berikutnya. */
export const QUEUE_BACKOFF_MINUTES = [1, 5, 15, 60];
export const BACKGROUND_SYNC_MINUTES = 15;
export const REMINDER_DAYS_AHEAD = 7;
export const DEFAULT_REMINDER_MINUTES = 10;
