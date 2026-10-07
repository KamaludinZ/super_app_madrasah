/** Preferensi ringan (bukan data rahasia) — disimpan di AsyncStorage. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { DEFAULT_REMINDER_MINUTES } from '@/config';

const KEY = 'prefs.v1';

type Prefs = {
  hydrated: boolean;
  onboardingDone: boolean;
  reminderMinutes: 5 | 10 | 15;
  lastSyncAt: string | null;
  pushToken: string | null;
  pendingCount: number;
  failedCount: number;
  setOnboardingDone: (v: boolean) => void;
  setReminderMinutes: (m: 5 | 10 | 15) => void;
  setLastSyncAt: (iso: string | null) => void;
  setPushToken: (t: string | null) => void;
  setQueueCounts: (pending: number, failed: number) => void;
  hydrate: () => Promise<void>;
};

const persistKeys = ['onboardingDone', 'reminderMinutes', 'lastSyncAt', 'pushToken'] as const;

export const usePrefs = create<Prefs>((set, get) => {
  const save = () => {
    const s = get();
    const out: Record<string, unknown> = {};
    persistKeys.forEach((k) => { out[k] = s[k]; });
    AsyncStorage.setItem(KEY, JSON.stringify(out)).catch(() => {});
  };
  return {
    hydrated: false,
    onboardingDone: false,
    reminderMinutes: DEFAULT_REMINDER_MINUTES as 10,
    lastSyncAt: null,
    pushToken: null,
    pendingCount: 0,
    failedCount: 0,
    setOnboardingDone: (v) => { set({ onboardingDone: v }); save(); },
    setReminderMinutes: (m) => { set({ reminderMinutes: m }); save(); },
    setLastSyncAt: (iso) => { set({ lastSyncAt: iso }); save(); },
    setPushToken: (t) => { set({ pushToken: t }); save(); },
    setQueueCounts: (pendingCount, failedCount) => set({ pendingCount, failedCount }),
    hydrate: async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) {
          const p = JSON.parse(raw);
          set({
            onboardingDone: !!p.onboardingDone,
            reminderMinutes: [5, 10, 15].includes(p.reminderMinutes) ? p.reminderMinutes : DEFAULT_REMINDER_MINUTES,
            lastSyncAt: p.lastSyncAt ?? null,
            pushToken: p.pushToken ?? null,
          });
        }
      } finally {
        set({ hydrated: true });
      }
    },
  };
});
