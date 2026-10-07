/** Lokasi untuk validasi GPS jurnal (akurasi tinggi, batas waktu, cadangan lokasi terakhir). */
import * as Location from 'expo-location';
import type { GeoFix } from '@/store/journalDraft';

export async function getLocation(timeoutMs = 12_000): Promise<{ fix: GeoFix; error?: string }> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return { fix: null, error: 'Izin lokasi ditolak. Aktifkan lokasi agar jurnal bisa divalidasi.' };
    const pos = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise<null>((r) => setTimeout(() => r(null), timeoutMs)),
    ]);
    const p = pos ?? (await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000 }));
    if (!p) return { fix: null, error: 'Lokasi belum didapat. Pastikan GPS aktif lalu coba lagi.' };
    return {
      fix: { lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy ?? null, time: new Date(p.timestamp).toISOString() },
    };
  } catch (e: any) {
    return { fix: null, error: e?.message || 'Gagal membaca lokasi. Pastikan GPS aktif.' };
  }
}
