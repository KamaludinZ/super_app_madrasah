/**
 * Ujian Madrasah — tautan publik TANPA login: daftar hadir peserta & berita acara pengawas. Tetap terikat pada ujian,
 * ruang, dan sesi yang dibuka panitia (token tautan dari Pengaturan Formulir); backend memvalidasi semuanya.
 *
 * Kontrak server (backend menyusul):
 *   GET /publik/ujian/{token}
 *     -> { madrasah: { nama, logo_url }, ujian: { nama, jenis, tahun_pelajaran, mulai, selesai },
 *          formulir: { terbuka, alasan, pesan, jam_buka, jam_tutup }, tanggal, jam,
 *          sesi: Sesi|null (sesi aktif), sesi_hari_ini: [Sesi], ruang: [{ id, nama_ruang, jenjang: [7, 8] }] }
 *   GET /publik/ujian/{token}/ruang/{ruang_id}/peserta?sesi_id=
 *     -> { kelas: [{ kelas, jenjang, jumlah }], peserta: [{ id, nama, kelas, jenjang, nomor_peserta, sudah_hadir, status }] }
 *        (status: null | 'hadir' | 'izin' | 'sakit' pada sesi itu)
 *   POST /publik/ujian/{token}/daftar-hadir { sesi_id, ruang_id, peserta_id, ttd_png: 'data:image/png;base64,…' }
 *     -> { nama, kelas, nomor_peserta, ruang, sesi, waktu_kirim }
 *        403 formulir tertutup (pesan); 400 TTD kosong/bukan PNG;
 *        409 sudah mengisi sesi ini -> detail { alasan: 'sudah_mengisi', pesan, nama, waktu_kirim } (perlu buka kunci panitia)
 */
import axios from 'axios';
import { z } from 'zod';
import { hariIniWIB } from '@/lib/tanggal';

export const publik = axios.create({ baseURL: `${process.env.REACT_APP_BACKEND_URL || ''}/api` });

const endpointBelumAda = (e) => e?.response?.status === 404 && e.response.data?.detail === 'Not Found';

export const pesanGalatPublik = (e, cadangan) => {
  const d = e?.response?.data?.detail;
  if (d && typeof d === 'object' && d.pesan) return d.pesan;
  return typeof d === 'string' && d !== 'Not Found' ? d : cadangan;
};

/** Rincian penolakan kiriman ganda (409) -> { pesan, nama, waktu_kirim } atau null. */
export function rincianKirimanGanda(e) {
  if (e?.response?.status !== 409) return null;
  const d = e.response.data?.detail;
  if (d && typeof d === 'object') return { pesan: d.pesan, nama: d.nama, waktu_kirim: d.waktu_kirim };
  return { pesan: typeof d === 'string' ? d : 'Nama ini sudah mengisi daftar hadir pada sesi ini.' };
}

// ---- Data tiruan (sesi selalu "hari ini" agar alur bisa dicoba) ----
const contoh = { hadir: {} }; // { `${sesi_id}:${peserta_id}`: true }

const RUANG_CONTOH = [
  { id: 'contoh-r01', nama_ruang: '01', jenjang: [7, 8] },
  { id: 'contoh-r02', nama_ruang: '02', jenjang: [7, 8] },
  { id: 'contoh-r03', nama_ruang: '03', jenjang: [7, 9] },
];
const NAMA = ['Ahmad Fauzan', 'Aisyah Putri', 'Bagus Saputra', 'Citra Ramadhani', 'Dimas Hidayat', 'Fatimah Azzahra', 'Ghani Maulana',
  'Hana Khoirunnisa', 'Ilham Firmansyah', 'Jihan Nur Aini', 'Khalid Pratama', 'Laila Salsabila'];

export function infoTiruan() {
  const t = hariIniWIB();
  const sesi = { id: 'contoh-sesi-1', tanggal: t, sesi_ke: 1, jam_mulai: '07:30', jam_selesai: '09:30', mapel: { 7: 'Matematika', 8: 'IPA', 9: 'Bahasa Indonesia' } };
  return {
    madrasah: { nama: 'MTsN 2 Kota Malang (contoh)', logo_url: null },
    ujian: { nama: 'ASAS Ganjil 2026/2027 (contoh)', jenis: 'UAS', tahun_pelajaran: '2026/2027', mulai: t, selesai: t },
    formulir: { terbuka: true, alasan: null, pesan: 'Formulir dibuka.', jam_buka: '07:00', jam_tutup: '12:00' },
    tanggal: t, jam: '08:00', sesi, sesi_hari_ini: [sesi], ruang: RUANG_CONTOH,
  };
}

export function pesertaTiruan(ruangId, sesiId) {
  const ruang = RUANG_CONTOH.find((r) => r.id === ruangId) || RUANG_CONTOH[0];
  const peserta = [];
  ruang.jenjang.forEach((j, ji) => {
    for (let i = 0; i < 6; i += 1) {
      const n = ji * 6 + i;
      const id = `contoh-p-${ruang.id}-${j}-${i}`;
      const kunci = `${sesiId}:${id}`;
      const status = contoh.hadir[kunci] ? 'hadir' : (i === 5 ? 'izin' : null);
      peserta.push({
        id, nama: `${NAMA[n % NAMA.length]} (contoh)`, kelas: `${j}${i < 3 ? 'A' : 'B'}`, jenjang: j,
        nomor_peserta: `${ruang.nama_ruang}-${String(n + 1).padStart(3, '0')}`, sudah_hadir: status === 'hadir', status,
      });
    }
  });
  const kelas = [...new Set(peserta.map((p) => p.kelas))].sort().map((k) => ({
    kelas: k, jenjang: Number(k[0]), jumlah: peserta.filter((p) => p.kelas === k).length,
  }));
  return { kelas, peserta };
}

export async function denganTiruan(fn, tiruan) {
  try {
    return { ...(await fn()), tiruan: false };
  } catch (e) {
    if (endpointBelumAda(e)) return { ...(await tiruan()), tiruan: true };
    throw e;
  }
}

/** Info tautan publik: ujian, status formulir, sesi aktif, daftar ruang. */
export const muatInfoPublik = (token) => denganTiruan(
  async () => (await publik.get(`/publik/ujian/${token}`)).data,
  infoTiruan,
);

/** Kelas & peserta satu ruang beserta status hadir pada sesi. */
export const muatPesertaPublik = (token, ruangId, sesiId) => denganTiruan(
  async () => (await publik.get(`/publik/ujian/${token}/ruang/${ruangId}/peserta`, { params: { sesi_id: sesiId } })).data,
  () => pesertaTiruan(ruangId, sesiId),
);

/** Kirim daftar hadir satu peserta (sekali per sesi). */
export const kirimDaftarHadir = (token, isi) => denganTiruan(
  async () => (await publik.post(`/publik/ujian/${token}/daftar-hadir`, isi)).data,
  () => {
    const kunci = `${isi.sesi_id}:${isi.peserta_id}`;
    if (contoh.hadir[kunci]) {
      const e = new Error('sudah');
      e.response = { status: 409, data: { detail: {
        alasan: 'sudah_mengisi', pesan: 'Nama ini sudah mengisi daftar hadir pada sesi ini.', nama: 'Peserta (contoh)', waktu_kirim: new Date().toISOString(),
      } } };
      throw e;
    }
    contoh.hadir[kunci] = true;
    const { peserta } = pesertaTiruan(isi.ruang_id, isi.sesi_id);
    const p = peserta.find((x) => x.id === isi.peserta_id) || {};
    return { nama: p.nama, kelas: p.kelas, nomor_peserta: p.nomor_peserta, ruang: RUANG_CONTOH.find((r) => r.id === isi.ruang_id)?.nama_ruang,
      sesi: infoTiruan().sesi, waktu_kirim: new Date().toISOString() };
  },
);

// ---- Validasi formulir daftar hadir (sama dengan DaftarHadirIn di backend/ujian_kehadiran.py) ----
export const TTD_MAKS_BITA = 400 * 1024; // data URL tanda tangan maksimal ±400 KB
export const skemaDaftarHadir = z.object({
  sesi_id: z.string().min(1, 'Belum ada sesi ujian aktif'),
  ruang_id: z.string().min(1, 'Pilih ruangan terlebih dahulu'),
  peserta_id: z.string().min(1, 'Pilih nama Anda dari daftar'),
  ttd_png: z.string({ required_error: 'Tanda tangan wajib diisi', invalid_type_error: 'Tanda tangan wajib diisi' })
    .startsWith('data:image/png;base64,', 'Tanda tangan wajib diisi')
    .max(TTD_MAKS_BITA, 'Tanda tangan terlalu besar; ulangi dengan goresan lebih sederhana'),
});

/** Galat pertama skema -> pesan, atau null bila sah. */
export function galatDaftarHadir(isi) {
  const h = skemaDaftarHadir.safeParse(isi);
  return h.success ? null : h.error.issues[0]?.message || 'Isian belum lengkap';
}

/** Arti galat kirim untuk alur: 'tertutup' (403), 'sudah' (409), 'koneksi' (tanpa respons), 'lain'. */
export function jenisGalatKirim(e) {
  if (!e?.response) return 'koneksi';
  if (e.response.status === 403) return 'tertutup';
  if (e.response.status === 409) return 'sudah';
  return 'lain';
}

// ---- Berita acara pengawas (tanpa login) ----
//   GET  /publik/ujian/{token}/pengawas -> { items: [{ id, nama }] }   (master guru pengawas yang aktif)
//   GET  /publik/ujian/{token}/berita-acara/ruang/{ruang_id}?sesi_id=
//     -> { ruang: { id, nama_ruang, jenjang }, kelengkapan: { lengkap, belum, pesan },
//          rekap: [{ jenjang, mapel, total, hadir, izin, sakit, alpa, belum, nomor_hadir, nomor_tidak_hadir }],
//          sudah_diisi: null | { pengawas_nama, waktu_kirim } }
//        (jumlah hadir & izin diambil otomatis dari daftar hadir sesi itu, bukan diisi manual)
//   POST /publik/ujian/{token}/berita-acara { sesi_id, ruang_id, pengawas_id, catatan, ttd_png }
//     -> { ruang, sesi, pengawas_nama, waktu_kirim, rekap }
//        403 tertutup / daftar hadir belum lengkap; 409 berita acara ruang & sesi ini sudah diisi
const contohBa = {};
const PENGAWAS_CONTOH = [
  { id: 'contoh-pengawas-1', nama: 'Siti Aminah, S.Pd. (contoh)' }, { id: 'contoh-pengawas-2', nama: 'Muhammad Rizal, S.Kom. (contoh)' },
  { id: 'contoh-pengawas-3', nama: 'Drs. Hadi Purnomo (contoh)' },
];

export function rekapBaTiruan(ruangId, sesiId) {
  const ruang = RUANG_CONTOH.find((r) => r.id === ruangId) || RUANG_CONTOH[0];
  const { peserta } = pesertaTiruan(ruang.id, sesiId);
  const sesi = infoTiruan().sesi;
  const rekap = ruang.jenjang.map((j) => {
    const anggota = peserta.filter((p) => p.jenjang === j);
    const hadir = anggota.filter((p) => p.status === 'hadir' || (!p.status && p.nama.startsWith('A')));
    const tidak = anggota.filter((p) => p.status === 'izin' || p.status === 'sakit');
    return { jenjang: j, mapel: sesi.mapel[j], total: anggota.length, hadir: hadir.length, izin: tidak.length, sakit: 0, alpa: 0,
      belum: anggota.length - hadir.length - tidak.length, nomor_hadir: hadir.map((p) => p.nomor_peserta), nomor_tidak_hadir: tidak.map((p) => p.nomor_peserta) };
  });
  const belum = rekap.reduce((a, r) => a + r.belum, 0);
  const lengkap = ruang.id !== 'contoh-r02' || belum === 0; // ruang 02 contoh: daftar hadir belum lengkap
  return {
    ruang, rekap: lengkap ? rekap.map((r) => ({ ...r, hadir: r.hadir + r.belum, belum: 0 })) : rekap,
    kelengkapan: lengkap ? { lengkap: true, belum: 0, pesan: 'Daftar hadir lengkap.' }
      : { lengkap: false, belum, pesan: `Daftar hadir ruang ini belum lengkap: ${belum} peserta belum mengisi atau ditandai panitia.` },
    sudah_diisi: contohBa[`${sesiId}:${ruang.id}`] || null,
  };
}

/** Pengawas aktif (master) -> { items, tiruan }. */
export const muatPengawasPublik = (token) => denganTiruan(
  async () => (await publik.get(`/publik/ujian/${token}/pengawas`)).data,
  () => ({ items: PENGAWAS_CONTOH }),
);

/** Kelengkapan daftar hadir & rekap hadir/izin otomatis satu ruang pada sesi -> { ruang, kelengkapan, rekap, sudah_diisi, tiruan }. */
export const muatRekapBa = (token, ruangId, sesiId) => denganTiruan(
  async () => (await publik.get(`/publik/ujian/${token}/berita-acara/ruang/${ruangId}`, { params: { sesi_id: sesiId } })).data,
  () => rekapBaTiruan(ruangId, sesiId),
);

/** Kirim berita acara pengawas. */
export const kirimBeritaAcara = (token, isi) => denganTiruan(
  async () => (await publik.post(`/publik/ujian/${token}/berita-acara`, isi)).data,
  () => {
    const kunci = `${isi.sesi_id}:${isi.ruang_id}`;
    const r = rekapBaTiruan(isi.ruang_id, isi.sesi_id);
    if (!r.kelengkapan.lengkap) { const e = new Error('belum'); e.response = { status: 403, data: { detail: r.kelengkapan.pesan } }; throw e; }
    if (contohBa[kunci]) { const e = new Error('sudah'); e.response = { status: 409, data: { detail: 'Berita acara ruang ini untuk sesi ini sudah diisi.' } }; throw e; }
    const pengawas = PENGAWAS_CONTOH.find((p) => p.id === isi.pengawas_id);
    contohBa[kunci] = { pengawas_nama: pengawas?.nama, waktu_kirim: new Date().toISOString() };
    return { ruang: r.ruang.nama_ruang, sesi: infoTiruan().sesi, pengawas_nama: pengawas?.nama, waktu_kirim: contohBa[kunci].waktu_kirim, rekap: r.rekap };
  },
);

// ---- Validasi formulir berita acara (sama dengan BeritaAcaraIn di backend/ujian_berita_acara.py) ----
export const CATATAN_BA_MAKS = 1000;
export const skemaBeritaAcara = z.object({
  sesi_id: z.string().min(1, 'Belum ada sesi ujian aktif'),
  ruang_id: z.string().min(1, 'Pilih ruangan terlebih dahulu'),
  pengawas_id: z.string().min(1, 'Pilih nama pengawas'),
  catatan: z.string().max(CATATAN_BA_MAKS, `Catatan maksimal ${CATATAN_BA_MAKS} karakter`),
  ttd_png: z.string({ required_error: 'Tanda tangan pengawas wajib diisi', invalid_type_error: 'Tanda tangan pengawas wajib diisi' })
    .startsWith('data:image/png;base64,', 'Tanda tangan pengawas wajib diisi')
    .max(TTD_MAKS_BITA, 'Tanda tangan terlalu besar; ulangi dengan goresan lebih sederhana'),
});

/** Galat isian berita acara per field -> { field: pesan } (kosong bila sah). */
export function galatBeritaAcara(isi) {
  const h = skemaBeritaAcara.safeParse(isi);
  if (h.success) return {};
  return Object.fromEntries(h.error.issues.map((i) => [i.path[0], i.message]));
}

// Riwayat berita acara hari ini (tanpa login): ruang mana yang sudah dilaporkan pengawas pada tiap sesi.
//   GET /publik/ujian/{token}/berita-acara/riwayat
//     -> { tanggal, items: [{ ruang_id, nama_ruang, sesi_id, sesi_ke, pengawas_nama, waktu_kirim }] }
//   ?sesi_id= -> riwayat satu sesi (mis. sesi hari sebelumnya yang dipilih).
export const muatRiwayatBa = (token, sesiId = '') => denganTiruan(
  async () => (await publik.get(`/publik/ujian/${token}/berita-acara/riwayat`, { params: sesiId ? { sesi_id: sesiId } : {} })).data,
  () => {
    const sesi = infoTiruan().sesi;
    return {
      tanggal: sesi.tanggal,
      items: Object.entries(contohBa).map(([kunci, v]) => {
        const ruangId = kunci.split(':')[1];
        return { ruang_id: ruangId, nama_ruang: RUANG_CONTOH.find((r) => r.id === ruangId)?.nama_ruang, sesi_id: sesi.id, sesi_ke: sesi.sesi_ke, ...v };
      }),
    };
  },
);

// Pilihan sesi (tanpa login): sesi aktif tetap dipilih otomatis menurut jam server; sesi lain hari ini & hari
// sebelumnya yang BELUM LENGKAP boleh dipilih; sesi lengkap & hari berikutnya tidak.
//   GET /publik/ujian/{token}/sesi?untuk=daftar_hadir|berita_acara
//     -> { tanggal, aktif_id, berikutnya: 'YYYY-MM-DD'|null,
//          items: [{ id, tanggal, sesi_ke, jam_mulai, jam_selesai, mapel, status, boleh_dipilih, terisi, total, lengkap }] }
//        status: 'aktif' | 'terbuka' (belum lengkap) | 'lengkap' | 'belum_waktunya'; terisi/total = peserta (daftar hadir)
//        atau ruang (berita acara). Urut: hari ini dulu, lalu hari-hari sebelumnya.
export const muatSesiPublik = (token, untuk) => denganTiruan(
  async () => (await publik.get(`/publik/ujian/${token}/sesi`, { params: { untuk } })).data,
  () => {
    const sesi = infoTiruan().sesi;
    return { tanggal: sesi.tanggal, aktif_id: sesi.id, berikutnya: null,
      items: [{ ...sesi, status: 'aktif', boleh_dipilih: true, terisi: 0, total: 0, lengkap: false }] };
  },
);

/** Sesi yang dipakai halaman: pilihan pengguna bila masih boleh dipilih, selain itu sesi aktif otomatis. */
export function sesiTerpakai(info, pilihan, terpilihId) {
  const pilih = terpilihId && pilihan?.items?.find((s) => s.id === terpilihId && s.boleh_dipilih);
  return pilih || info?.sesi || null;
}

/** Ada sesi selain sesi aktif yang boleh dipilih? */
export const adaSesiLain = (pilihan, aktifId) => (pilihan?.items || []).some((s) => s.boleh_dipilih && s.id !== aktifId);
