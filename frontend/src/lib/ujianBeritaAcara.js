/**
 * Ujian Madrasah — Berita Acara (sisi panitia): pantau berita acara pengawas per sesi per ruang.
 *   GET /ujian/{ujian_id}/berita-acara?tanggal=
 *     -> { items: [{ sesi, terisi, total, ruang: [{ ruang_id, nama_ruang, jenjang, dh_lengkap,
 *          berita_acara: null | { id, pengawas_nama, pengawas_nip, waktu_kirim, catatan, jumlah_hadir, jumlah_izin, ada_ttd, rekap } }] }] }
 *   GET /ujian/{ujian_id}/berita-acara/{id}/ttd -> image/png
 */
import { api } from '@/lib/api';
import { denganTiruan } from '@/lib/ujian';
import { hariIniWIB } from '@/lib/tanggal';

export const HALAMAN_BERITA_ACARA = '/ujian/berita-acara';

export function beritaAcaraTiruan() {
  const t = hariIniWIB();
  const sesi = { id: 'contoh-sesi-1', tanggal: t, sesi_ke: 1, jam_mulai: '07:30', jam_selesai: '09:30', mapel: { 7: 'Matematika', 8: 'IPA' } };
  return {
    items: [{
      sesi, terisi: 1, total: 2,
      ruang: [
        { ruang_id: 'contoh-r01', nama_ruang: '01', jenjang: [7, 8], dh_lengkap: true, berita_acara: {
          id: 'contoh-ba1', pengawas_nama: 'Siti Aminah, S.Pd. (contoh)', pengawas_nip: '198104052006042011', waktu_kirim: `${t}T09:40:00+07:00`,
          catatan: 'Ujian berjalan tertib.', jumlah_hadir: 30, jumlah_izin: 2, ada_ttd: true } },
        { ruang_id: 'contoh-r02', nama_ruang: '02', jenjang: [9], dh_lengkap: false, berita_acara: null },
      ],
    }],
  };
}

/** Berita acara per sesi per ruang -> { items, tiruan }. */
export const muatBeritaAcara = (ujianId, tanggal) => denganTiruan(
  async () => (await api.get(`/ujian/${ujianId}/berita-acara`, { params: tanggal ? { tanggal } : {} })).data,
  beritaAcaraTiruan,
);
