/**
 * Utilitas impor CKG hasil template di browser: baca berkas .xlsx, cek judul kolom terhadap
 * susunan template CKG (16 kolom baku + kolom bantu), dan ubah baris menjadi { baris, data }.
 */
import { kolomTemplateCkg } from '@/lib/ckgKolom';
import { cekHeader, validasiBerkas } from '@/lib/imporDataMaster';

export { validasiBerkas };

export const SHEET_TEMPLATE_CKG = 'Template CKG';

const teksSel = (v) => {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
};

/** Judul kolom pertama template CKG versi lama (sebelum kolom baku). */
const JUDUL_TEMPLATE_LAMA = 'ID (jangan diubah)';

/**
 * Validasi berkas sebelum dibaca: ekstensi .xlsx, ukuran (maks 5 MB, tidak kosong), dan isi
 * benar-benar Excel .xlsx (diawali tanda arsip ZIP "PK"), bukan berkas lain yang diganti namanya.
 * Mengembalikan pesan galat atau null.
 */
export async function validasiFormatExcel(file) {
  const err = validasiBerkas(file);
  if (err) return err;
  try {
    const kepala = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    if (!(kepala[0] === 0x50 && kepala[1] === 0x4b)) {
      return 'Isi berkas bukan Excel .xlsx (mungkin .xls lama, CSV, atau berkas lain yang diganti namanya). Simpan ulang sebagai .xlsx.';
    }
  } catch (e) {
    return 'Berkas tidak bisa dibaca';
  }
  return null;
}

/** Kolom hasil pemeriksaan (bukan identitas/bantu) — baris tanpa isian ini dianggap belum diperiksa. */
export const KOLOM_HASIL_CKG = ['bb', 'tb', 'td', 'jumlah_karies', 'visus_mata', 'kesehatan_kulit', 'fungsi_pendengaran', 'hemoglobin', 'gds'];

/**
 * Baca berkas impor CKG. Mengembalikan
 * { sheet, masalahHeader, baris: [{ baris, data }], dilewati: { kosong, belumDiperiksa } }.
 * Baris yang kolom hasil pemeriksaannya kosong semua dilewati (pasien belum diperiksa).
 */
export async function bacaBerkasCkg(file) {
  const kolom = kolomTemplateCkg();
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  const nama = wb.SheetNames.includes(SHEET_TEMPLATE_CKG) ? SHEET_TEMPLATE_CKG : wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[nama], { header: 1, raw: false, defval: '', blankrows: true });
  const header = rows[0] || [];
  const hasil = { sheet: nama, masalahHeader: cekHeader(header, kolom), baris: [], dilewati: { kosong: 0, belumDiperiksa: 0 }, templateLama: false };
  if (String(header[0] || '').trim() === JUDUL_TEMPLATE_LAMA) {
    hasil.templateLama = true;
    hasil.masalahHeader = ['Berkas memakai template CKG versi lama. Unduh template baru (tombol Template) lalu salin hasil pemeriksaan ke sana.'];
  }
  if (hasil.masalahHeader.length) return hasil;
  rows.slice(1).forEach((row, i) => {
    const sel = kolom.map((_, c) => teksSel(row[c]));
    if (sel.every((v) => v === '')) { hasil.dilewati.kosong += 1; return; }
    const data = Object.fromEntries(kolom.map((k, c) => [k.key, sel[c]]));
    if (KOLOM_HASIL_CKG.every((k) => data[k] === '')) { hasil.dilewati.belumDiperiksa += 1; return; }
    hasil.baris.push({ baris: i + 2, data });
  });
  return hasil;
}

/**
 * Batas nilai kolom angka CKG (sama dengan validasi backend). [min, max]
 */
export const BATAS_ANGKA_CKG = {
  bb: ['BB', 1, 300], tb: ['TB', 30, 250], jumlah_karies: ['Jumlah Karies', 0, 32],
  hemoglobin: ['Hemoglobin', 0, 30], gds: ['GDS', 0, 1000],
};

const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;
const POLA_TD = /^\d{2,3}\s*\/\s*\d{2,3}$/;

/** Tanggal YYYY-MM-DD yang benar-benar ada (Date.parse menerima 2026-02-30 dengan menggesernya ke Maret). */
export function tanggalValid(t) {
  if (!POLA_TANGGAL.test(t)) return false;
  const [y, m, d] = t.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Validasi satu baris impor CKG: [{ kolom, pesan }] (kosong = baris valid). */
export function validasiBarisCkg(data) {
  const salah = [];
  if (!data.pasien_id && !data.nik) salah.push({ kolom: 'ID Pasien / NIK', pesan: 'Identitas pasien kosong; isi ID Pasien (dari template) atau NIK' });
  if (data.nik && !/^\d{16}$/.test(data.nik.replace(/\D/g, '')) ) salah.push({ kolom: 'NIK', pesan: 'NIK harus 16 digit angka' });
  if (!data.tanggal) salah.push({ kolom: 'Tanggal Periksa', pesan: 'Tanggal pemeriksaan wajib diisi' });
  else if (!tanggalValid(data.tanggal)) salah.push({ kolom: 'Tanggal Periksa', pesan: 'Format tanggal harus TAHUN-BULAN-TANGGAL (mis. 2026-09-01)' });
  else if (data.tanggal > new Date().toISOString().slice(0, 10)) salah.push({ kolom: 'Tanggal Periksa', pesan: 'Tanggal pemeriksaan tidak boleh di masa depan' });
  Object.entries(BATAS_ANGKA_CKG).forEach(([key, [label, min, max]]) => {
    const v = data[key];
    if (v === '' || v == null) return;
    const n = Number(String(v).replace(',', '.'));
    if (Number.isNaN(n)) salah.push({ kolom: label, pesan: `${label} harus berupa angka` });
    else if (n < min || n > max) salah.push({ kolom: label, pesan: `${label} di luar batas wajar (${min}-${max})` });
  });
  if (data.td && !POLA_TD.test(data.td)) salah.push({ kolom: 'TD', pesan: 'Tekanan darah harus berformat sistolik/diastolik, mis. 110/70' });
  return salah;
}
