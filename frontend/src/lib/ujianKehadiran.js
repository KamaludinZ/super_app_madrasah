/**
 * Ujian Madrasah — Daftar Hadir (sisi panitia): pantau kehadiran peserta per sesi per ruang, tandai izin/sakit/tanpa
 * keterangan, dan buka kunci kiriman peserta dengan alasan tercatat.
 *
 * Kontrak server (backend menyusul; koleksi `daftar_hadir`):
 *   GET /ujian/{ujian_id}/daftar-hadir?sesi_id=&ruang_id=
 *     -> { ujian, boleh_ubah, sesi: [Sesi], sesi_id, ruang: [{ id, nama_ruang, jenjang }],
 *          rekap: [{ ruang_id, nama_ruang, total, hadir, izin, sakit, alpa, belum, lengkap }],
 *          items: [Kehadiran] }   (items untuk ruang_id terpilih; admin, panitia, kepala madrasah & waka kurikulum)
 *   GET /ujian/{ujian_id}/daftar-hadir/{kehadiran_id}/ttd -> image/png
 *   POST /ujian/{ujian_id}/daftar-hadir/{kehadiran_id}/buka-kunci { alasan }
 *     -> { ok, peserta_id, riwayat_buka }   (admin; alasan wajib 5–300 karakter; kiriman lama dipindah ke arsip buka
 *        kunci — tidak dihapus permanen — sehingga peserta dapat mengirim ulang pada sesi itu; tercatat di audit)
 *   PUT /ujian/{ujian_id}/daftar-hadir/status { peserta_id, tanggal, status: 'izin'|'sakit'|'alpa'|null, catatan }
 *     -> { tanggal, status, sesi_diterapkan: n }   (admin; CUKUP SEKALI PER HARI: berlaku untuk semua sesi tanggal itu
 *        yang belum diisi hadir oleh peserta; catatan wajib untuk izin & sakit; null menghapus tanda; tercatat di audit)
 *
 *   Kehadiran = { id|null, peserta_id, nomor_peserta, nama, kelas, jenjang,
 *                 status: null|'hadir'|'izin'|'sakit'|'alpa', waktu_kirim, ada_ttd, catatan, ditandai_oleh_nama,
 *                 riwayat_buka: [{ oleh_nama, alasan, pada }] }
 *   Lengkap = setiap peserta ruang sudah berstatus (hadir/izin/sakit/alpa) pada sesi itu — syarat berita acara.
 */
import { api } from '@/lib/api';
import { denganTiruan } from '@/lib/ujian';
import { hariIniWIB } from '@/lib/tanggal';

export const HALAMAN_DAFTAR_HADIR = '/ujian/daftar-hadir';

export const STATUS_HADIR = {
  hadir: { label: 'Hadir', kelas: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  izin: { label: 'Izin', kelas: 'bg-sky-100 text-sky-800 border-sky-200' },
  sakit: { label: 'Sakit', kelas: 'bg-amber-100 text-amber-800 border-amber-200' },
  alpa: { label: 'Tanpa keterangan', kelas: 'bg-rose-100 text-rose-800 border-rose-200' },
  belum: { label: 'Belum mengisi', kelas: 'bg-slate-100 text-slate-600 border-slate-200' },
};

// ---- Data tiruan ----
const contoh = { status: {} }; // { `${sesi}:${peserta}`: { status, catatan, ditandai_oleh_nama } }
const NAMA = ['Ahmad Fauzan', 'Aisyah Putri', 'Bagus Saputra', 'Citra Ramadhani', 'Dimas Hidayat', 'Fatimah Azzahra', 'Ghani Maulana',
  'Hana Khoirunnisa', 'Ilham Firmansyah', 'Jihan Nur Aini', 'Khalid Pratama', 'Laila Salsabila'];
const RUANG = [{ id: 'contoh-r01', nama_ruang: '01', jenjang: [7, 8] }, { id: 'contoh-r02', nama_ruang: '02', jenjang: [9] }];

function sesiContoh() {
  const t = hariIniWIB();
  return [
    { id: 'contoh-sesi-1', tanggal: t, sesi_ke: 1, jam_mulai: '07:30', jam_selesai: '09:30', mapel: { 7: 'Matematika', 8: 'IPA', 9: 'Bahasa Indonesia' } },
    { id: 'contoh-sesi-2', tanggal: t, sesi_ke: 2, jam_mulai: '10:00', jam_selesai: '12:00', mapel: { 7: 'IPS', 8: 'Bahasa Arab', 9: 'Matematika' } },
  ];
}

function pesertaRuang(ruang) {
  return ruang.jenjang.flatMap((j, ji) => Array.from({ length: 6 }, (_, i) => {
    const n = ji * 6 + i;
    return { peserta_id: `contoh-p-${ruang.id}-${n}`, nomor_peserta: `${ruang.nama_ruang}-${String(n + 1).padStart(3, '0')}`,
      nama: `${NAMA[n % NAMA.length]} (contoh)`, kelas: `${j}${i < 3 ? 'A' : 'B'}`, jenjang: j };
  }));
}

function statusContoh(sesiId, p, i) {
  const k = contoh.status[`${sesiId}:${p.peserta_id}`];
  if (k) return k;
  if (i % 6 === 5) return { status: null };
  if (i === 4) return { status: 'sakit', catatan: 'Demam, surat dari orang tua', ditandai_oleh_nama: 'Administrator (contoh)' };
  return { status: 'hadir', waktu_kirim: `${hariIniWIB()}T07:${String(20 + i).padStart(2, '0')}:00+07:00`, ada_ttd: true };
}

export function daftarHadirTiruan(sesiId, ruangId) {
  const sesi = sesiContoh();
  const sid = sesiId || sesi[0].id;
  const rekap = RUANG.map((r) => {
    const st = pesertaRuang(r).map((p, i) => statusContoh(sid, p, i).status);
    const hitung = (s) => st.filter((x) => x === s).length;
    return { ruang_id: r.id, nama_ruang: r.nama_ruang, total: st.length, hadir: hitung('hadir'), izin: hitung('izin'), sakit: hitung('sakit'),
      alpa: hitung('alpa'), belum: st.filter((x) => !x).length, lengkap: st.every(Boolean) };
  });
  const ruang = RUANG.find((r) => r.id === ruangId) || RUANG[0];
  const items = pesertaRuang(ruang).map((p, i) => ({
    id: `contoh-dh-${sid}-${p.peserta_id}`, ...p, ada_ttd: false, waktu_kirim: null, catatan: '', riwayat_buka: [], ...statusContoh(sid, p, i),
  }));
  return { boleh_ubah: true, sesi, sesi_id: sid, ruang: RUANG, ruang_id: ruang.id, rekap, items };
}

export function ubahStatusContoh(sesiId, pesertaId, isi) {
  contoh.status[`${sesiId}:${pesertaId}`] = isi;
}

/** Daftar hadir satu sesi & ruang -> { boleh_ubah, sesi, sesi_id, ruang, rekap, items, tiruan }. */
export const muatDaftarHadir = (ujianId, { sesiId, ruangId } = {}) => denganTiruan(
  async () => (await api.get(`/ujian/${ujianId}/daftar-hadir`, { params: { sesi_id: sesiId || undefined, ruang_id: ruangId || undefined } })).data,
  () => daftarHadirTiruan(sesiId, ruangId),
);

/** URL objek PNG tanda tangan satu kehadiran (panggil URL.revokeObjectURL setelah dipakai). */
export async function urlTtdKehadiran(ujianId, kehadiranId) {
  const { data } = await api.get(`/ujian/${ujianId}/daftar-hadir/${kehadiranId}/ttd`, { responseType: 'blob' });
  return URL.createObjectURL(data);
}

export const STATUS_TANDA = ['izin', 'sakit', 'alpa'];
export const CATATAN_MIN = 3;
export const CATATAN_MAKS = 200;

/** Tandai izin/sakit/tanpa keterangan untuk satu peserta pada satu tanggal (semua sesi hari itu) -> { sesi_diterapkan, tiruan }. */
export const tandaiStatus = (ujianId, isi) => denganTiruan(
  async () => (await api.put(`/ujian/${ujianId}/daftar-hadir/status`, isi)).data,
  () => {
    const sesi = daftarHadirTiruan().sesi.filter((s) => s.tanggal === isi.tanggal);
    sesi.forEach((s) => ubahStatusContoh(s.id, isi.peserta_id, isi.status
      ? { status: isi.status, catatan: isi.catatan, ditandai_oleh_nama: 'Anda (contoh)' } : { status: null }));
    return { tanggal: isi.tanggal, status: isi.status, sesi_diterapkan: sesi.length };
  },
);

export const ALASAN_BUKA_MIN = 5;
export const ALASAN_BUKA_MAKS = 300;

/** Buka kunci kiriman peserta (kiriman lama diarsipkan) -> { ok, riwayat_buka, tiruan }. */
export const bukaKunci = (ujianId, item, sesiId, alasan) => denganTiruan(
  async () => (await api.post(`/ujian/${ujianId}/daftar-hadir/${item.id}/buka-kunci`, { alasan })).data,
  () => {
    const riwayat = [...(item.riwayat_buka || []), { oleh_nama: 'Anda (contoh)', alasan, pada: new Date().toISOString() }];
    ubahStatusContoh(sesiId, item.peserta_id, { status: null, riwayat_buka: riwayat });
    return { ok: true, peserta_id: item.peserta_id, riwayat_buka: riwayat };
  },
);
