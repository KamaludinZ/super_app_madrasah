/**
 * Utilitas impor pelengkapan data master (Siswa / GTK) di browser:
 * membaca berkas .xlsx, memeriksa baris judul terhadap skema kolom baku, dan
 * mengubah tiap baris menjadi { baris, data: { key: teks } } siap dikirim ke server.
 * Aturan pengecekan judul sama dengan backend `cek_header` (data_master_excel.py).
 */

export const PENANDA_KETERANGAN = '[Keterangan]';
export const MAKS_UKURAN_BERKAS = 5 * 1024 * 1024; // 5 MB
export const EKSTENSI_DITERIMA = ['.xlsx'];

const teksSel = (v) => {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
};

/** Masalah susunan judul kolom (kosong = cocok persis). */
export function cekHeader(header, kolom) {
  const got = header.map(teksSel);
  while (got.length && got[got.length - 1] === '') got.pop();
  const want = kolom.map((k) => k.label);
  if (got.length === want.length && got.every((h, i) => h === want[i])) return [];
  const masalah = [];
  const hilang = want.filter((l) => !got.includes(l));
  const asing = got.filter((l) => l && !want.includes(l));
  const ringkas = (arr) => arr.slice(0, 10).join(', ') + (arr.length > 10 ? ' dst.' : '');
  if (hilang.length) masalah.push(`Kolom tidak ditemukan: ${ringkas(hilang)}`);
  if (asing.length) masalah.push(`Kolom tidak dikenal: ${ringkas(asing)}`);
  if (!hilang.length && !asing.length) masalah.push('Urutan kolom berbeda dari template; gunakan template atau unduhan terbaru');
  return masalah;
}

export const adalahBarisKeterangan = (row) => typeof row?.[0] === 'string' && row[0].trim().startsWith(PENANDA_KETERANGAN);

/** Validasi berkas sebelum dibaca: ekstensi & ukuran. Mengembalikan pesan galat atau null. */
export function validasiBerkas(file) {
  if (!file) return 'Pilih berkas terlebih dahulu';
  const nama = file.name.toLowerCase();
  if (!EKSTENSI_DITERIMA.some((e) => nama.endsWith(e))) return 'Berkas harus berformat Excel .xlsx (unduhan atau template dari aplikasi)';
  if (file.size > MAKS_UKURAN_BERKAS) return 'Ukuran berkas maksimal 5 MB';
  if (file.size === 0) return 'Berkas kosong';
  return null;
}

/**
 * Baca berkas impor. Mengembalikan
 * { sheet, masalahHeader: string[], baris: [{ baris, data }], dilewati: { kosong, keterangan } }.
 * `baris` = nomor baris Excel (mulai 2) agar lokasi kesalahan mudah ditemukan.
 */
export async function bacaBerkasImpor(file, kolom, sheet) {
  const XLSX = await import('xlsx');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const nama = wb.SheetNames.includes(sheet) ? sheet : wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[nama], { header: 1, raw: false, defval: '', blankrows: true });
  const header = rows[0] || [];
  const masalahHeader = cekHeader(header, kolom);
  const hasil = { sheet: nama, masalahHeader, baris: [], dilewati: { kosong: 0, keterangan: 0 } };
  if (masalahHeader.length) return hasil;
  rows.slice(1).forEach((row, i) => {
    const nomor = i + 2;
    if (adalahBarisKeterangan(row)) { hasil.dilewati.keterangan += 1; return; }
    const sel = kolom.map((_, c) => teksSel(row[c]));
    if (sel.every((v) => v === '')) { hasil.dilewati.kosong += 1; return; }
    hasil.baris.push({ baris: nomor, data: Object.fromEntries(kolom.map((k, c) => [k.key, sel[c]])) });
  });
  return hasil;
}

export const UKURAN_BATCH = 25;

/**
 * Unggah berkas ke `${endpoint}/unggah` untuk divalidasi server dan membuat sesi impor.
 * Mengembalikan { impor_id, total, ... } atau null bila endpoint belum tersedia (404).
 * Galat lain (judul kolom salah 422, ukuran 413, izin 403, dll.) dilempar ke pemanggil.
 */
export async function unggahBerkasImpor({ api, endpoint, file, mode }) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('mode', mode);
  if (mode === 'timpa') fd.append('konfirmasi_timpa', 'true'); // dikirim hanya setelah admin mencentang persetujuan
  try {
    const { data } = await api.post(`${endpoint}/unggah`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    return data;
  } catch (e) {
    if (e?.response?.status === 404) return null;
    throw e;
  }
}

/** Pesan galat dari respons server (detail bisa string atau { pesan, masalah }). */
export function pesanGalatServer(e, cadangan = 'Terjadi kesalahan') {
  const d = e?.response?.data?.detail;
  if (typeof d === 'string') return d;
  if (d?.pesan) return [d.pesan, ...(d.masalah || [])].join(' — ');
  return cadangan;
}

const jeda = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Proses impor baris demi baris dalam batch ke server:
 * POST `endpoint` { mode, baris: [{ baris, data }] } -> { hasil: [{ baris, identitas, status, pesan, ... }] }.
 * `onProgress({ selesai, total, barisSaatIni, hasil })` dipanggil setelah tiap batch.
 * `batal()` mengembalikan true untuk menghentikan sebelum batch berikutnya.
 * Bila endpoint belum ada (404), memakai `cadangan(batch, mode)` (hasil tiruan) per batch.
 */
export async function prosesImporBatch({ api, endpoint, mode, imporId, baris, onProgress, batal, cadangan, ukuranBatch = UKURAN_BATCH }) {
  const semua = [];
  let pakaiCadangan = !imporId && !!cadangan; // tanpa sesi server (endpoint unggah belum ada) -> tiruan
  let dibatalkan = false;
  for (let i = 0; i < baris.length; i += ukuranBatch) {
    if (batal?.()) { dibatalkan = true; break; }
    const batch = baris.slice(i, i + ukuranBatch);
    let hasil;
    if (!pakaiCadangan) {
      try {
        const { data } = await api.post(endpoint, { impor_id: imporId, mode, baris: batch, terakhir: i + batch.length >= baris.length });
        hasil = data?.hasil || [];
      } catch (e) {
        const st = e?.response?.status;
        if (st === 401 || st === 403 || st === 413 || st === 422) throw e; // sesi/izin/format salah: hentikan seluruh impor
        if (st === 404 && cadangan) {
          pakaiCadangan = true;
        } else {
          // Batch gagal total (jaringan/server): tandai barisnya gagal, lanjut ke batch berikutnya.
          const pesan = e?.response?.data?.detail;
          hasil = batch.map((b) => ({ baris: b.baris, identitas: '-', status: 'gagal', pesan: typeof pesan === 'string' ? pesan : 'Gagal menghubungi server' }));
        }
      }
    }
    if (pakaiCadangan) {
      await jeda(150); // tiruan: beri waktu agar progres terlihat
      hasil = cadangan(batch, mode);
    }
    semua.push(...hasil);
    onProgress?.({ selesai: Math.min(i + batch.length, baris.length), total: baris.length, barisSaatIni: batch[batch.length - 1].baris, hasil: [...semua] });
  }
  const hitung = (st) => semua.filter((h) => h.status === st).length;
  // Server dapat menandai tiap baris dengan hasil pencocokan alamatnya ke master wilayah
  // (`wilayah`: 'cocok' | 'sebagian' | 'tidak_cocok'); diringkas bila ada.
  const wilayah = { cocok: 0, sebagian: 0, tidak_cocok: 0 };
  semua.forEach((h) => { if (wilayah[h.wilayah] !== undefined) wilayah[h.wilayah] += 1; });
  const adaWilayah = wilayah.cocok + wilayah.sebagian + wilayah.tidak_cocok > 0;
  return {
    mode,
    imporId,
    tiruan: pakaiCadangan,
    dibatalkan,
    ringkasan: { total: baris.length, diproses: semua.length, berhasil: hitung('berhasil'), tanpa_perubahan: hitung('tanpa_perubahan'), gagal: hitung('gagal') },
    ...(adaWilayah ? { wilayah } : {}),
    hasil: semua,
  };
}
