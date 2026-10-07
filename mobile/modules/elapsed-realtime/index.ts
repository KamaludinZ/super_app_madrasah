import { Platform } from 'react-native';

/**
 * Jam monoton (ms). Di APK Android memakai modul native `SystemClock.elapsedRealtime()`
 * (sejak boot, tahan terhadap perubahan jam oleh pengguna). Di Expo Go/web memakai
 * `performance.now()` (sejak aplikasi dibuka) — dianggap kurang kuat (`source: 'js'`).
 */
let nativeFn: (() => number) | null | undefined;

function resolveNative(): (() => number) | null {
  if (nativeFn !== undefined) return nativeFn;
  nativeFn = null;
  if (Platform.OS === 'android') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { requireOptionalNativeModule } = require('expo-modules-core');
      const mod = requireOptionalNativeModule?.('ElapsedRealtime');
      if (mod?.elapsedRealtimeMs) nativeFn = () => Number(mod.elapsedRealtimeMs());
    } catch {
      nativeFn = null;
    }
  }
  return nativeFn;
}

export type MonotonicReading = { ms: number; source: 'native' | 'js' };

export function monotonicNow(): MonotonicReading {
  const fn = resolveNative();
  if (fn) return { ms: fn(), source: 'native' };
  const perf = (globalThis as any).performance;
  return { ms: perf?.now ? perf.now() : Date.now(), source: 'js' };
}
