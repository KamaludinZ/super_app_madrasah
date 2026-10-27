/**
 * Asal input jurnal (sama dengan web lib/jurnalAsal & backend jurnal_asal):
 *  'jurnal_presisi' = isi tepat waktu lewat scan QR / token kelas (juga data lama tanpa penanda)
 *  'catat_jurnal'   = tombol Catat Jurnal: diisi di luar jam setelah pelajaran selesai, berlaku s.d. 24.00 WIB.
 */
import type { Journal, ScheduleItem } from '@/api/types';

export const ASAL_CATAT = 'catat_jurnal';

export const isCatatJurnal = (j: Pick<Journal, 'asal_input'>) => j.asal_input === ASAL_CATAT;

/**
 * Tombol Catat Jurnal tampil bila jendela dari server (GET /schedules/my-today) sedang terbuka menurut jam
 * sekarang, jurnal belum diisi, dan slot bukan slot pengganti / slot yang sedang digantikan.
 * Server tetap memeriksa ulang saat jurnal dikirim.
 */
export function bisaCatatJurnal(slot: ScheduleItem, now = Date.now()): boolean {
  const c = slot.catat_jurnal;
  if (!c || slot.journal_filled || slot.is_substitute || slot.substitute) return false;
  if (!c.dibuka_pada || !c.berakhir_pada) return false;
  return now > new Date(c.dibuka_pada).getTime() && now < new Date(c.berakhir_pada).getTime();
}
