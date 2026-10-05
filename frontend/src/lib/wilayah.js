/**
 * Master wilayah Indonesia (provinsi -> kabupaten/kota -> kecamatan -> desa/kelurahan + kode pos).
 * Kode mengikuti format Kemendagri bertitik: 35 / 35.73 / 35.73.05 / 35.73.05.1001.
 *
 * Data diambil dari server (GET /wilayah?tingkat=&induk=). Bila server belum menyediakan master
 * wilayah (404), dipakai DATA TIRUAN berlabel "Contoh" hanya untuk mencoba tampilan.
 */
import { api } from '@/lib/api';

export const TINGKAT_WILAYAH = [
  { key: 'provinsi', label: 'Provinsi', panjang: 1 },
  { key: 'kabupaten', label: 'Kabupaten/Kota', panjang: 2 },
  { key: 'kecamatan', label: 'Kecamatan', panjang: 3 },
  { key: 'desa', label: 'Desa/Kelurahan', panjang: 4 },
];

/** Tingkat dari kode bertitik: '35' -> provinsi, '35.73' -> kabupaten, dst. */
export const tingkatDariKode = (kode) => TINGKAT_WILAYAH[String(kode || '').split('.').length - 1]?.key || null;

/** Kode induk: '35.73.05' -> '35.73'; provinsi -> null. */
export const kodeInduk = (kode) => {
  const p = String(kode || '').split('.');
  return p.length > 1 ? p.slice(0, -1).join('.') : null;
};

// ---- DATA TIRUAN (bukan data resmi; hanya untuk mencoba alur dropdown) ----
const T = (kode, nama, extra = {}) => ({ kode, nama, tiruan: true, ...extra });
export const WILAYAH_TIRUAN = [
  T('91', 'Provinsi Contoh A'), T('92', 'Provinsi Contoh B'),
  T('91.01', 'Kabupaten Contoh A1'), T('91.71', 'Kota Contoh A2'), T('92.01', 'Kabupaten Contoh B1'),
  T('91.01.01', 'Kecamatan Contoh A1-1'), T('91.01.02', 'Kecamatan Contoh A1-2'), T('91.71.01', 'Kecamatan Contoh A2-1'), T('92.01.01', 'Kecamatan Contoh B1-1'),
  T('91.01.01.2001', 'Desa Contoh Satu', { kode_pos: '99111' }), T('91.01.01.2002', 'Desa Contoh Dua', { kode_pos: '99112' }),
  T('91.01.02.2001', 'Desa Contoh Tiga', { kode_pos: '99121' }), T('91.71.01.1001', 'Kelurahan Contoh Empat', { kode_pos: '99211' }),
  T('92.01.01.2001', 'Desa Contoh Lima', { kode_pos: '99311' }),
];

export function wilayahTiruan(tingkat, induk) {
  return WILAYAH_TIRUAN.filter((w) => tingkatDariKode(w.kode) === tingkat && (tingkat === 'provinsi' || kodeInduk(w.kode) === induk))
    .sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
}

let modeTiruan = null; // null = belum diketahui, true = server belum punya master wilayah
const cache = new Map(); // `${tingkat}|${induk}` -> items (data wilayah jarang berubah)

/** Daftar wilayah satu tingkat di bawah `induk` -> { items: [{kode, nama, kode_pos?}], tiruan, belumDimuat? }.
 * `belumDimuat`: master tingkat itu belum diisi admin (server punya master tingkat atas). */
export async function muatWilayah(tingkat, induk = null) {
  if (modeTiruan) return { items: wilayahTiruan(tingkat, induk), tiruan: true };
  const kunci = `${tingkat}|${induk || ''}`;
  if (cache.has(kunci)) return { items: cache.get(kunci), tiruan: false };
  try {
    const { data } = await api.get('/wilayah', { params: { tingkat, ...(induk ? { induk } : {}) } });
    modeTiruan = false;
    const items = Array.isArray(data) ? data : data.items || [];
    cache.set(kunci, items);
    return { items, tiruan: false };
  } catch (e) {
    if (e?.response?.status === 404) {
      if (modeTiruan === false) return { items: [], tiruan: false, belumDimuat: true };
      modeTiruan = true;
      return { items: wilayahTiruan(tingkat, induk), tiruan: true };
    }
    throw e;
  }
}

/** Untuk pengujian: atur ulang deteksi mode tiruan. */
export const resetModeWilayah = () => { modeTiruan = null; cache.clear(); };

/**
 * Nilai baru setelah memilih satu tingkat: tingkat di bawahnya dikosongkan (kabupaten berganti ->
 * kecamatan & desa kosong). Mengembalikan { nilai, kode_wilayah, kode_pos }.
 * - nilai: { provinsi, kabupaten, kecamatan, desa } berisi { kode, nama } atau null
 * - kode_wilayah: kode tingkat terdalam yang terpilih; kode_pos: dari desa terpilih
 */
export function pilihWilayahBaru(nilai, tingkat, item) {
  const idx = TINGKAT_WILAYAH.findIndex((t) => t.key === tingkat);
  if (idx < 0) throw new Error(`tingkat tidak dikenal: ${tingkat}`);
  // Memilih ulang wilayah yang sama tidak mengosongkan tingkat di bawahnya.
  if (item && nilai?.[tingkat]?.kode === item.kode) {
    const tetap = { provinsi: null, kabupaten: null, kecamatan: null, desa: null, ...nilai };
    const dalam = [...TINGKAT_WILAYAH].reverse().find((t) => tetap[t.key]);
    return { nilai: tetap, kode_wilayah: dalam ? tetap[dalam.key].kode : '', kode_pos: tetap.desa ? (tingkat === 'desa' ? item.kode_pos || '' : null) : '' };
  }
  const baru = { provinsi: null, kabupaten: null, kecamatan: null, desa: null, ...nilai, [tingkat]: item ? { kode: item.kode, nama: item.nama } : null };
  TINGKAT_WILAYAH.slice(idx + 1).forEach((t) => { baru[t.key] = null; });
  const terdalam = [...TINGKAT_WILAYAH].reverse().find((t) => baru[t.key]);
  return {
    nilai: baru,
    kode_wilayah: terdalam ? baru[terdalam.key].kode : '',
    kode_pos: tingkat === 'desa' && item ? item.kode_pos || '' : '',
  };
}

/** Rantai {provinsi, kabupaten, kecamatan, desa} dari kode desa pada data tiruan. */
function rantaiTiruan(kode) {
  const r = { provinsi: null, kabupaten: null, kecamatan: null, desa: null };
  const p = String(kode).split('.');
  TINGKAT_WILAYAH.forEach((t, i) => {
    if (i < p.length) {
      const w = WILAYAH_TIRUAN.find((x) => x.kode === p.slice(0, i + 1).join('.'));
      r[t.key] = w ? { kode: w.kode, nama: w.nama } : null;
    }
  });
  return r;
}

/**
 * Cari desa/kelurahan lewat kode pos (5 digit) atau nama -> [{ kode, nama, kode_pos, rantai }].
 * `rantai` berisi nilai lengkap provinsi..desa untuk langsung mengisi dropdown bertingkat.
 * Server: GET /wilayah/cari?q= ; tiruan bila server belum punya master wilayah.
 */
export async function cariDesa(q) {
  const kunci = String(q || '').trim();
  if (kunci.length < 3) return { items: [], tiruan: !!modeTiruan };
  const dariTiruan = () => WILAYAH_TIRUAN
    .filter((w) => tingkatDariKode(w.kode) === 'desa'
      && (/^\d+$/.test(kunci) ? (w.kode_pos || '').startsWith(kunci) : w.nama.toLowerCase().includes(kunci.toLowerCase())))
    .slice(0, 20)
    .map((w) => ({ kode: w.kode, nama: w.nama, kode_pos: w.kode_pos, rantai: rantaiTiruan(w.kode) }));
  if (modeTiruan) return { items: dariTiruan(), tiruan: true };
  try {
    const { data } = await api.get('/wilayah/cari', { params: { q: kunci } });
    modeTiruan = false;
    return { items: data.items || data || [], tiruan: false };
  } catch (e) {
    if (e?.response?.status === 404) { modeTiruan = true; return { items: dariTiruan(), tiruan: true }; }
    throw e;
  }
}

/**
 * Nilai dropdown bertingkat dari field alamat tersimpan. Kode tiap tingkat diturunkan dari
 * `kode_wilayah` (kode terdalam) — '35.73.05.1001' -> provinsi 35, kab 35.73, kec 35.73.05, desa.
 * `kolom` memetakan nama field: { provinsi, kabupaten, kecamatan, desa } (mis. GTK memakai kab_kota).
 */
export const KOLOM_ALAMAT_SISWA = { provinsi: 'provinsi', kabupaten: 'kabupaten', kecamatan: 'kecamatan', desa: 'kelurahan' };
export const KOLOM_ALAMAT_GTK = { provinsi: 'provinsi', kabupaten: 'kab_kota', kecamatan: 'kecamatan', desa: 'kelurahan' };

export function nilaiDariAlamat(alamat = {}, kolom = KOLOM_ALAMAT_SISWA) {
  const parts = String(alamat.kode_wilayah || '').split('.').filter(Boolean);
  const hasil = {};
  TINGKAT_WILAYAH.forEach((t, i) => {
    const nama = alamat[kolom[t.key]];
    const kode = parts.length > i ? parts.slice(0, i + 1).join('.') : '';
    // Tanpa kode (data lama ketikan bebas) tingkat itu ditampilkan kosong agar dipilih ulang dari master.
    hasil[t.key] = kode ? { kode, nama: nama || kode } : null;
  });
  if (hasil.desa && alamat.kode_pos) hasil.desa.kode_pos = alamat.kode_pos;
  return hasil;
}

/** Field alamat untuk disimpan dari nilai dropdown + info { kode_wilayah, kode_pos }. */
export function alamatDariNilai(nilai, info = {}, kolom = KOLOM_ALAMAT_SISWA) {
  const hasil = {};
  TINGKAT_WILAYAH.forEach((t) => { hasil[kolom[t.key]] = nilai[t.key]?.nama || ''; });
  hasil.kode_wilayah = info.kode_wilayah || '';
  // Kode pos mengikuti desa: terisi dari desa terpilih, dikosongkan bila desa ikut terkosongkan.
  // null = tidak berubah (pilih ulang tingkat atas yang sama saat desa tetap).
  if (info.kode_pos !== null && info.kode_pos !== undefined) hasil.kode_pos = info.kode_pos;
  else if (!nilai.desa) hasil.kode_pos = '';
  return hasil;
}

/** Teks alamat lengkap tersimpan: "Jl. X, RT 1/RW 2, Desa, Kecamatan, Kab/Kota, Provinsi 65141". */
export function ringkasAlamat(alamat = {}, kolom = KOLOM_ALAMAT_SISWA) {
  const rtrw = alamat.rt || alamat.rw ? `RT ${alamat.rt || '-'}/RW ${alamat.rw || '-'}` : '';
  const wilayah = [kolom.desa, kolom.kecamatan, kolom.kabupaten, kolom.provinsi].map((k) => alamat[k]).filter(Boolean);
  const teks = [alamat.alamat || alamat.address, rtrw, ...wilayah].filter(Boolean).join(', ');
  return alamat.kode_pos ? `${teks}${teks ? ' ' : ''}${alamat.kode_pos}` : teks;
}

// ------------------------------------------------------------
// PAKET DATA WILAYAH (unggah admin)
// ------------------------------------------------------------
/** Pola kode wilayah Kemendagri: 2 digit / 2.2 / 2.2.2 / 2.2.2.4 */
export const POLA_KODE_WILAYAH = /^\d{2}(\.\d{2}(\.\d{2}(\.\d{4})?)?)?$/;

/**
 * Pratinjau paket wilayah (.csv atau .xlsx) di browser. Kolom: kode, nama, kode_pos (opsional,
 * untuk desa). Baris judul boleh ada atau tidak. Mengembalikan
 * { total, perTingkat: {provinsi, kabupaten, kecamatan, desa}, salah: [{baris, pesan}], contoh: [...] }.
 */
export async function pratinjauPaketWilayah(file) {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', raw: true });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' });
  const hasil = { total: 0, perTingkat: { provinsi: 0, kabupaten: 0, kecamatan: 0, desa: 0 }, salah: [], contoh: [] };
  const kodeAda = new Set();
  rows.forEach((row, i) => {
    const kode = String(row[0] ?? '').trim();
    const nama = String(row[1] ?? '').trim();
    const kodePos = String(row[2] ?? '').trim();
    if (!kode && !nama) return;
    if (i === 0 && !POLA_KODE_WILAYAH.test(kode)) return; // baris judul
    const nomor = i + 1;
    if (!POLA_KODE_WILAYAH.test(kode)) { hasil.salah.push({ baris: nomor, pesan: `Kode "${kode}" tidak sesuai format (mis. 35, 35.73, 35.73.05, 35.73.05.1001)` }); return; }
    if (!nama) { hasil.salah.push({ baris: nomor, pesan: `Nama untuk kode ${kode} kosong` }); return; }
    if (kodePos && !/^\d{5}$/.test(kodePos)) { hasil.salah.push({ baris: nomor, pesan: `Kode pos "${kodePos}" harus 5 digit` }); return; }
    if (kodeAda.has(kode)) { hasil.salah.push({ baris: nomor, pesan: `Kode ${kode} ganda` }); return; }
    kodeAda.add(kode);
    hasil.total += 1;
    hasil.perTingkat[tingkatDariKode(kode)] += 1;
    if (hasil.contoh.length < 5) hasil.contoh.push({ kode, nama, kode_pos: kodePos });
  });
  return hasil;
}
