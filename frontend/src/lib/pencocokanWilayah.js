/**
 * Pencocokan wilayah alamat hasil impor (ketikan bebas) ke master wilayah.
 *
 * Kontrak server:
 *   GET /wilayah/pencocokan?jenis=siswa|gtk|semua&status=tidak_cocok|sebagian|cocok|tanpa_alamat|semua&q=
 *     -> { ringkasan: { total, cocok, sebagian, tidak_cocok, tanpa_alamat }, items: [BarisPencocokan] }
 *   BarisPencocokan = { id, jenis: 'siswa'|'gtk', nama, keterangan, blok, label_blok,
 *     teks: { provinsi, kabupaten, kecamatan, desa }, tingkat_cocok: { provinsi, kabupaten, kecamatan, desa } (true/false/null),
 *     kode_wilayah, status, alasan,
 *     saran: [{ kode, nama, kode_pos, rantai, skor }] }
 *   (`blok`: 'alamat_siswa'|'alamat_ayah'|'alamat_ibu'|'alamat_wali' untuk siswa, 'tempat_tinggal' untuk GTK)
 *
 *   POST /wilayah/pencocokan/terapkan { items: [{ id, jenis, blok, kode_wilayah, kode_pos? }] }
 *     -> { berhasil, gagal, hasil: [{ id, blok, status: 'berhasil'|'gagal', pesan?, baris? }] }
 *     (baris = BarisPencocokan terbaru setelah diperbaiki)
 *
 * Bila server belum menyediakan endpoint (404) dipakai data contoh berlabel agar alur bisa dicoba.
 */
import { api } from '@/lib/api';

export const STATUS_PENCOCOKAN = {
  cocok: { label: 'Cocok', kelas: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  sebagian: { label: 'Cocok Sebagian', kelas: 'bg-amber-50 text-amber-700 border-amber-200' },
  tidak_cocok: { label: 'Tidak Cocok', kelas: 'bg-rose-50 text-rose-700 border-rose-200' },
  tanpa_alamat: { label: 'Tanpa Alamat', kelas: 'bg-slate-50 text-slate-600 border-slate-200' },
};

export const FILTER_STATUS = [
  { value: 'perlu', label: 'Perlu diperbaiki (tidak cocok + sebagian)' },
  { value: 'tidak_cocok', label: 'Tidak cocok' },
  { value: 'sebagian', label: 'Cocok sebagian' },
  { value: 'cocok', label: 'Cocok' },
  { value: 'tanpa_alamat', label: 'Tanpa alamat' },
  { value: 'semua', label: 'Semua' },
];

export const LABEL_TINGKAT_TEKS = [['desa', 'Desa/Kel.'], ['kecamatan', 'Kec.'], ['kabupaten', 'Kab/Kota'], ['provinsi', 'Prov.']];

/** Ukuran halaman daftar baris pencocokan. */
export const UKURAN_HALAMAN = 50;

/** Teks alamat asli (ketikan impor) -> "Desa X, Kec. Y, Kab/Kota Z, Prov. W". */
export const teksAlamatAsli = (teks = {}) => LABEL_TINGKAT_TEKS
  .filter(([k]) => teks[k]).map(([k, l]) => `${l} ${teks[k]}`).join(', ');

/** Teks rantai wilayah saran: "Desa, Kecamatan, Kab/Kota, Provinsi". */
export const teksRantai = (rantai = {}) => ['desa', 'kecamatan', 'kabupaten', 'provinsi']
  .map((k) => rantai?.[k]?.nama).filter(Boolean).join(', ');

/** Saring baris di sisi klien (dipakai juga untuk data contoh). */
export function saringPencocokan(items, { jenis = 'semua', status = 'perlu', q = '' } = {}) {
  const kunci = String(q || '').trim().toLowerCase();
  return items.filter((it) => (jenis === 'semua' || it.jenis === jenis)
    && (status === 'semua' || (status === 'perlu' ? ['tidak_cocok', 'sebagian'].includes(it.status) : it.status === status))
    && (!kunci || [it.nama, it.keterangan, teksAlamatAsli(it.teks)].join(' ').toLowerCase().includes(kunci)));
}

export function hitungRingkasan(items) {
  const r = { total: items.length, cocok: 0, sebagian: 0, tidak_cocok: 0, tanpa_alamat: 0 };
  items.forEach((it) => { if (r[it.status] !== undefined) r[it.status] += 1; });
  return r;
}

// ---- DATA CONTOH (bukan data asli; hanya saat server belum menyediakan pencocokan) ----
const R = (p, k, c, d) => ({ provinsi: p, kabupaten: k, kecamatan: c, desa: d });
const RANTAI_SATU = R({ kode: '91', nama: 'Provinsi Contoh A' }, { kode: '91.01', nama: 'Kabupaten Contoh A1' },
  { kode: '91.01.01', nama: 'Kecamatan Contoh A1-1' }, { kode: '91.01.01.2001', nama: 'Desa Contoh Satu' });
const RANTAI_DUA = R({ kode: '91', nama: 'Provinsi Contoh A' }, { kode: '91.01', nama: 'Kabupaten Contoh A1' },
  { kode: '91.01.01', nama: 'Kecamatan Contoh A1-1' }, { kode: '91.01.01.2002', nama: 'Desa Contoh Dua' });
export const PENCOCOKAN_TIRUAN = [
  { id: 'contoh-1', jenis: 'siswa', nama: 'Siswa Contoh 1', keterangan: 'Kelas 7A', blok: 'alamat_ayah', label_blok: 'Alamat Ayah',
    teks: { provinsi: 'Prov Contoh A', kabupaten: 'Kab. Contoh A1', kecamatan: 'Kec Contoh A1-1', desa: 'Ds Contoh Satu' },
    tingkat_cocok: { provinsi: true, kabupaten: true, kecamatan: true, desa: true },
    kode_wilayah: '91.01.01.2001', status: 'cocok', alasan: 'Semua tingkat cocok', saran: [] },
  { id: 'contoh-2', jenis: 'siswa', nama: 'Siswa Contoh 2', keterangan: 'Kelas 8B', blok: 'alamat_ayah', label_blok: 'Alamat Ayah',
    teks: { provinsi: 'Provinsi Contoh A', kabupaten: 'Kabupaten Contoh A1', kecamatan: 'Kecamatan Contoh A1-1', desa: 'Contoh Satuu' },
    tingkat_cocok: { provinsi: true, kabupaten: true, kecamatan: true, desa: false },
    kode_wilayah: '91.01.01', status: 'sebagian', alasan: 'Desa/Kelurahan "Contoh Satuu" tidak ditemukan di Kecamatan Contoh A1-1',
    saran: [{ kode: '91.01.01.2001', nama: 'Desa Contoh Satu', kode_pos: '99111', rantai: RANTAI_SATU, skor: 0.92 },
      { kode: '91.01.01.2002', nama: 'Desa Contoh Dua', kode_pos: '99112', rantai: RANTAI_DUA, skor: 0.61 }] },
  { id: 'contoh-3', jenis: 'gtk', nama: 'GTK Contoh 1', keterangan: 'Guru', blok: 'tempat_tinggal', label_blok: 'Tempat Tinggal',
    teks: { provinsi: 'Jawa Tim', kabupaten: 'Malang Raya', kecamatan: '', desa: 'Contoh Dua' },
    tingkat_cocok: { provinsi: false, kabupaten: null, kecamatan: null, desa: null },
    kode_wilayah: '', status: 'tidak_cocok', alasan: 'Provinsi "Jawa Tim" tidak ditemukan',
    saran: [{ kode: '91.01.01.2002', nama: 'Desa Contoh Dua', kode_pos: '99112', rantai: RANTAI_DUA, skor: 0.55 }] },
  { id: 'contoh-4', jenis: 'gtk', nama: 'GTK Contoh 2', keterangan: 'Tendik', blok: 'tempat_tinggal', label_blok: 'Tempat Tinggal',
    teks: { provinsi: '', kabupaten: '', kecamatan: '', desa: '' }, kode_wilayah: '', status: 'tanpa_alamat', alasan: 'Alamat belum diisi', saran: [] },
];

/** Muat laporan pencocokan -> { ringkasan, items, tiruan }. */
export async function muatPencocokan(params = {}) {
  try {
    const { data } = await api.get('/wilayah/pencocokan', { params });
    return { ringkasan: data.ringkasan, items: data.items || [], tiruan: false };
  } catch (e) {
    if (e?.response?.status === 404) {
      const semua = saringPencocokan(PENCOCOKAN_TIRUAN, { jenis: params.jenis, status: 'semua' });
      return { ringkasan: hitungRingkasan(semua), items: saringPencocokan(PENCOCOKAN_TIRUAN, params), tiruan: true };
    }
    throw e;
  }
}

/** Baris setelah diperbaiki manual (dipakai saat server belum ada / sebagai pembaruan optimistis). */
export function barisDiperbaiki(baris, { kode_wilayah: kode, rantai }) {
  const n = String(kode || '').split('.').length;
  const cocok = {};
  ['provinsi', 'kabupaten', 'kecamatan', 'desa'].forEach((k, i) => { cocok[k] = i < n ? true : null; });
  const teks = {};
  ['provinsi', 'kabupaten', 'kecamatan', 'desa'].forEach((k) => { teks[k] = rantai?.[k]?.nama || ''; });
  return { ...baris, teks, tingkat_cocok: cocok, kode_wilayah: kode, status: n === 4 ? 'cocok' : 'sebagian',
    alasan: n === 4 ? 'Diperbaiki manual' : 'Diperbaiki manual (belum sampai desa/kelurahan)', saran: [] };
}

/** Simpan perbaikan satu/lebih baris -> { hasil, tiruan }. */
export async function terapkanPerbaikan(items) {
  try {
    const { data } = await api.post('/wilayah/pencocokan/terapkan', {
      items: items.map(({ baris, kode_wilayah, kode_pos }) => ({ id: baris.id, jenis: baris.jenis, blok: baris.blok, kode_wilayah, ...(kode_pos ? { kode_pos } : {}) })),
    });
    return { hasil: data.hasil || [], tiruan: false };
  } catch (e) {
    if (e?.response?.status === 404) {
      return { hasil: items.map(({ baris, ...p }) => ({ id: baris.id, blok: baris.blok, status: 'berhasil', baris: barisDiperbaiki(baris, p) })), tiruan: true };
    }
    throw e;
  }
}

/** Ambang kemiripan saran yang boleh diterapkan sekali klik / massal. */
export const SKOR_SARAN_YAKIN = 0.85;
export const saranYakin = (baris) => (baris?.status !== 'cocok' && baris?.saran?.[0]?.skor >= SKOR_SARAN_YAKIN ? baris.saran[0] : null);

/** Ganti baris lama dengan baris hasil perbaikan & sesuaikan ringkasan (status lama -1, status baru +1). */
export function gantiBaris(data, pasangan) {
  const ringkasan = data.ringkasan ? { ...data.ringkasan } : null;
  const peta = new Map(pasangan.map(([lama, baru]) => [lama, baru]));
  const items = data.items.map((x) => {
    const baru = peta.get(x);
    if (!baru) return x;
    if (ringkasan && x.status !== baru.status) {
      ringkasan[x.status] = (ringkasan[x.status] || 0) - 1;
      ringkasan[baru.status] = (ringkasan[baru.status] || 0) + 1;
    }
    return { ...baru, _diperbaiki: true };
  });
  return { ...data, items, ringkasan: ringkasan || hitungRingkasan(items) };
}
