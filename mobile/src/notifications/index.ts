/**
 * Notifikasi: channel Android, izin, token Expo Push, registrasi perangkat ke backend,
 * pengingat mengajar lokal (jalan saat offline), dan penanganan ketukan notifikasi.
 */
import { Platform } from 'react-native';
import type * as ExpoNotifications from 'expo-notifications';
import { getNotifications } from './native';
import * as Device from 'expo-device';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { api } from '@/api/endpoints';
import { APP_VERSION, EAS_PROJECT_ID, REMINDER_DAYS_AHEAD } from '@/config';
import { usePrefs } from '@/store/prefs';
import { listAllPermits, StoredPermit } from '@/offline/permits';
import { todayISO, wibInstant } from '@/utils/time';
import { routeForPath } from '@/menu/routes';

export const CHANNELS = {
  reminder: 'pengingat-mengajar',
  announcement: 'pengumuman',
  substitute: 'guru-pengganti',
  sync: 'sinkron',
  general: 'umum',
} as const;

// Null di Expo Go Android/web (lihat ./native); semua fungsi di bawah dijaga `isNative`.
const Notifications = getNotifications() as typeof ExpoNotifications;
const isNative = Platform.OS !== 'web' && getNotifications() !== null;

/** Buat channel Android (idempoten). Dipanggil di module scope root layout. */
export async function ensureChannels() {
  if (Platform.OS !== 'android' || !isNative) return;
  await Promise.all([
    Notifications.setNotificationChannelAsync(CHANNELS.reminder, {
      name: 'Pengingat Mengajar', importance: Notifications.AndroidImportance.HIGH, sound: 'default',
      vibrationPattern: [0, 300, 200, 300], lightColor: '#006837', description: 'Pengingat 10 menit sebelum & saat jam mengajar dimulai.',
    }),
    Notifications.setNotificationChannelAsync(CHANNELS.announcement, {
      name: 'Pengumuman', importance: Notifications.AndroidImportance.DEFAULT, sound: 'default', description: 'Pengumuman dari madrasah.',
    }),
    Notifications.setNotificationChannelAsync(CHANNELS.substitute, {
      name: 'Guru Pengganti', importance: Notifications.AndroidImportance.HIGH, sound: 'default', description: 'Penugasan sebagai guru pengganti.',
    }),
    Notifications.setNotificationChannelAsync(CHANNELS.general, {
      name: 'Notifikasi Umum', importance: Notifications.AndroidImportance.DEFAULT, sound: 'default',
      description: 'Tugas & materi kelas, tugas titipan, tata tertib, verval, prestasi, sarpras, BK, dan lainnya.',
    }),
    Notifications.setNotificationChannelAsync(CHANNELS.sync, {
      name: 'Sinkronisasi', importance: Notifications.AndroidImportance.LOW, description: 'Status pengiriman jurnal offline.',
    }),
  ]).catch(() => {});
}

export async function getPermissionStatus(): Promise<{ granted: boolean; canAskAgain: boolean; status: string }> {
  if (!isNative) return { granted: false, canAskAgain: false, status: 'unavailable' };
  const p = await Notifications.getPermissionsAsync();
  return { granted: p.granted, canAskAgain: p.canAskAgain, status: p.status };
}

export async function requestPermission(): Promise<boolean> {
  if (!isNative) return false;
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  if (!cur.canAskAgain) return false;
  const r = await Notifications.requestPermissionsAsync();
  return r.granted;
}

const DEVICE_ID_KEY = 'device_id_v1';

export async function getDeviceId(): Promise<string> {
  if (!isNative) return 'web-preview-device-000000';
  let id = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (!id) {
    id = Crypto.randomUUID();
    await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
  }
  return id;
}

/** Token Expo Push (butuh EAS projectId & perangkat fisik; null di Expo Go/web/emulator). */
export async function getExpoPushToken(): Promise<string | null> {
  if (!isNative || !Device.isDevice) return null;
  try {
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return null;
    const t = await Notifications.getExpoPushTokenAsync(EAS_PROJECT_ID ? { projectId: EAS_PROJECT_ID } : undefined);
    return t.data ?? null;
  } catch {
    return null;
  }
}

/** Daftarkan perangkat ke backend (POST /mobile/devices). Aman dipanggil berulang. */
export async function registerDevice(): Promise<{ ok: boolean; token: string | null }> {
  if (!isNative) return { ok: false, token: null };
  const token = await getExpoPushToken();
  usePrefs.getState().setPushToken(token);
  try {
    const device_id = await getDeviceId();
    await api.mobile.registerDevice({
      device_id, expo_push_token: token, platform: Platform.OS === 'ios' ? 'ios' : 'android', app_version: APP_VERSION, local_reminders: true,
    });
    return { ok: true, token };
  } catch {
    return { ok: false, token };
  }
}

export async function unregisterDevice() {
  if (!isNative) return;
  try {
    const device_id = await getDeviceId();
    await api.mobile.unregisterDevice(device_id);
  } catch { /* offline: abaikan */ }
}

// ---------------------------------------------------------------------------
// Pengingat lokal
// ---------------------------------------------------------------------------
const reminderId = (scheduleId: string, date: string, minute: number) => `${scheduleId}-${date}-${minute}`;

function slotLabel(p: StoredPermit) {
  const jam = p.start_time && p.end_time ? `${p.start_time}–${p.end_time}` : '';
  return `${p.subject_name ?? 'Mengajar'} · ${jam}${p.room_name ? ` · Ruang ${p.room_name}` : ''}`;
}

/**
 * Jadwalkan pengingat 7 hari ke depan dari izin offline tersimpan (jadwal reguler + slot pengganti).
 * Identifier "{schedule_id}-{tanggal}-{menit}" agar tidak ganda; semua pengingat lama dibatalkan dulu.
 */
export async function scheduleReminders(userId: string, minutesBefore: number): Promise<number> {
  if (!isNative) return 0;
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) return 0;
  await cancelAllReminders();
  const permits = await listAllPermits(userId);
  const today = todayISO();
  const now = Date.now();
  const horizon = now + REMINDER_DAYS_AHEAD * 86_400_000;
  let n = 0;
  for (const p of permits) {
    if (p.date < today || (p as any).holiday) continue;
    const start = wibInstant(p.date, p.start_time);
    const end = wibInstant(p.date, p.end_time);
    if (Number.isNaN(start) || start > horizon) continue;
    const kelas = p.class_name ?? '';
    const route = `/jurnal/isi?schedule_id=${encodeURIComponent(p.schedule_id)}&date=${p.date}${p.is_substitute ? `&assignment_id=${p.assignment_id ?? ''}&mode=substitute` : '&mode=slot'}`;
    const data = { type: 'teaching_reminder_local', schedule_id: p.schedule_id, date: p.date, route };
    const entries: { when: number; id: string; title: string; body: string }[] = [
      {
        when: start - minutesBefore * 60_000,
        id: reminderId(p.schedule_id, p.date, minutesBefore),
        title: p.is_substitute ? `⏰ ${minutesBefore} menit lagi menggantikan ${p.original_teacher_name ?? 'guru'} — ${kelas}` : `⏰ ${minutesBefore} menit lagi mengajar — ${kelas}`,
        body: `${slotLabel(p)}. Ketuk untuk scan QR & isi jurnal.`,
      },
      {
        when: start,
        id: reminderId(p.schedule_id, p.date, 0),
        title: `🔔 Saatnya mengajar — ${kelas} (${p.start_time})`,
        body: `${slotLabel(p)}. Ketuk untuk isi jurnal.`,
      },
      {
        when: end + 15 * 60_000,
        id: reminderId(p.schedule_id, p.date, -15),
        title: `📝 Jurnal ${kelas} belum diisi?`,
        body: 'Isi sekarang agar tidak terlewat. Ketuk untuk membuka jurnal.',
      },
    ];
    for (const e of entries) {
      if (e.when <= now + 5_000) continue;
      try {
        await Notifications.scheduleNotificationAsync({
          identifier: e.id,
          content: { title: e.title, body: e.body, sound: 'default', data, ...(Platform.OS === 'android' ? { channelId: CHANNELS.reminder } : {}) } as any,
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(e.when), ...(Platform.OS === 'android' ? { channelId: CHANNELS.reminder } : {}) } as any,
        });
        n++;
      } catch { /* lanjut */ }
    }
  }
  return n;
}

/** Batalkan pengingat jurnal-belum-diisi untuk slot yang jurnalnya sudah ada. */
export async function cancelFollowUpReminder(scheduleId: string, date: string) {
  if (!isNative) return;
  try { await Notifications.cancelScheduledNotificationAsync(reminderId(scheduleId, date, -15)); } catch { /* abaikan */ }
}

export async function cancelAllReminders() {
  if (!isNative) return;
  try { await Notifications.cancelAllScheduledNotificationsAsync(); } catch { /* abaikan */ }
}

export async function countScheduledReminders(): Promise<number> {
  if (!isNative) return 0;
  try { return (await Notifications.getAllScheduledNotificationsAsync()).length; } catch { return 0; }
}

/** Notifikasi lokal status sinkron (channel "sinkron"). */
export async function notifySync(title: string, body: string) {
  if (!isNative) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, ...(Platform.OS === 'android' ? { channelId: CHANNELS.sync } : {}) } as any,
      trigger: null,
    });
  } catch { /* abaikan */ }
}

export async function setBadge(count: number) {
  if (!isNative) return;
  try { await Notifications.setBadgeCountAsync(count); } catch { /* abaikan */ }
}

/**
 * Rute tujuan dari payload data notifikasi (server & lokal). Jenis yang punya layar native
 * diarahkan langsung; notifikasi pribadi lain membawa `route` = path web → layar native bila ada
 * (mis. /piket/tugas → Tugas Piket), selain itu modul web (sudah masuk).
 */
export function routeForNotification(data: Record<string, any> | undefined, role?: string | null): string | null {
  if (!data) return '/(app)/(tabs)/pengumuman';
  switch (data.type) {
    case 'announcement':
      return data.announcement_id ? `/pengumuman/${data.announcement_id}` : '/(app)/(tabs)/pengumuman';
    case 'substitute_assignment':
    case 'substitute_assignment_cancelled':
      return '/(app)/(tabs)';
    case 'class_material_new':
      if (role === 'siswa' && data.materi_id) return `/siswa/materi/${data.materi_id}`;
      return typeof data.route === 'string' ? routeForPath(data.route, role) : '/(app)/(tabs)';
    case 'class_task_new':
      if (role === 'siswa' && data.tugas_id) return `/siswa/tugas/${data.tugas_id}`;
      return typeof data.route === 'string' ? routeForPath(data.route, role) : '/(app)/(tabs)';
    case 'teaching_reminder':
      return data.schedule_id ? `/jurnal/isi?schedule_id=${data.schedule_id}&mode=slot` : '/(app)/(tabs)';
    default:
      if (typeof data.route === 'string' && data.route.startsWith('/')) return routeForPath(data.route, role);
      return '/(app)/(tabs)/pengumuman';
  }
}
