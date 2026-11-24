/**
 * Ujian Madrasah — menu Info Ujian (ber-login; key `info_ujian`): admin mengisi konten halaman publik Info Ujian siswa
 * per ujian — tata tertib, tautan video & keterangan panduan CBT, dan PDF panduan CBT. Kepala madrasah, waka kurikulum,
 * serta ketua & sekretaris panitia melihat (boleh_ubah = false). Halaman siswa: /publik/info-ujian/:token.
 *
 * Kontrak server (routers/ujian_info_konten.py; koleksi `ujian_info_konten`):
 *   GET    /ujian/{ujian_id}/info-konten
 *     -> { ujian, boleh_ubah, konten: Konten, tautan_info: Tautan (lihat ujianTautanPublik.js) }
 *   PUT    /ujian/{ujian_id}/info-konten { tata_tertib, panduan_video_url, panduan_keterangan, versi } -> { konten }   (admin)
 *        `versi` = konten.versi yang dimuat; 409 bila admin lain sudah menyimpan; 422 isian tidak sah (pesan jelas).
 *        PDF panduan tidak tersentuh.
 *   POST   /ujian/{ujian_id}/info-konten/panduan-pdf (multipart `berkas`, PDF ≤ 10 MB) -> { konten }   (admin; menimpa)
 *   DELETE /ujian/{ujian_id}/info-konten/panduan-pdf -> { konten }   (admin)
 *   GET    /ujian/{ujian_id}/info-konten/panduan-pdf -> PDF inline (pratinjau admin & pemantau; bukan unduhan siswa)
 *   Konten = { tata_tertib, panduan_video_url, panduan_keterangan,
 *              panduan_pdf: { nama_file, ukuran_byte, diunggah_pada, diunggah_oleh_nama, ada_di_disk } | null,
 *              diperbarui_pada, diperbarui_oleh_nama, versi }
 */
import { api } from '@/lib/api';
import { denganTiruan } from '@/lib/ujian';
import { galatBerkas, galatIsiBerkas } from '@/lib/ujianBerkas';
import { bukaPanduanContoh, urlVideoAman } from '@/lib/ujianInfoPublik';

export const HALAMAN_INFO_UJIAN = '/ujian/info-ujian';
// Batas sama dengan backend/ujian_info.py (TATA_TERTIB_MAKS, PANDUAN_KETERANGAN_MAKS, URL_VIDEO_MAKS).
export const TATA_TERTIB_MAKS = 10000;
export const PANDUAN_KETERANGAN_MAKS = 300;
export const URL_VIDEO_MAKS = 500;

export const isianDariKonten = (k) => ({
  tata_tertib: k?.tata_tertib || '',
  panduan_video_url: k?.panduan_video_url || '',
  panduan_keterangan: k?.panduan_keterangan || '',
});

/** Rapikan seperti server: CRLF -> LF, spasi di ujung baris dibuang, maksimal satu baris kosong berurutan. */
export const rapikanTataTertib = (v) => String(v || '').replace(/\r\n?/g, '\n').split('\n').map((b) => b.trimEnd()).join('\n')
  .replace(/\n{3,}/g, '\n\n').trim();

/** Galat isian per field -> { tata_tertib?, panduan_video_url?, panduan_keterangan? } (kosong = sah). */
export function galatIsianInfo(isi) {
  const g = {};
  if (rapikanTataTertib(isi.tata_tertib).length > TATA_TERTIB_MAKS) g.tata_tertib = `Tata tertib maksimal ${TATA_TERTIB_MAKS.toLocaleString('id-ID')} karakter.`;
  const url = String(isi.panduan_video_url || '').trim();
  if (url && (url.length > URL_VIDEO_MAKS || !urlVideoAman(url))) g.panduan_video_url = 'Tautan video harus diawali http:// atau https://, mis. tautan YouTube.';
  if (String(isi.panduan_keterangan || '').trim().length > PANDUAN_KETERANGAN_MAKS) g.panduan_keterangan = `Keterangan maksimal ${PANDUAN_KETERANGAN_MAKS} karakter.`;
  return g;
}

/** Sama dengan yang tersimpan (setelah dirapikan)? Dipakai untuk menandai perubahan belum disimpan. */
export const isianSama = (a, b) => rapikanTataTertib(a.tata_tertib) === rapikanTataTertib(b.tata_tertib)
  && String(a.panduan_video_url || '').trim() === String(b.panduan_video_url || '').trim()
  && String(a.panduan_keterangan || '').split(/\s+/).join(' ').trim() === String(b.panduan_keterangan || '').split(/\s+/).join(' ').trim();

/** Validasi PDF panduan di browser (server memeriksa ulang, termasuk konten aktif) -> pesan atau null. */
export async function galatPdfPanduan(file) {
  const pesan = galatBerkas('kisi_kisi', file) || await galatIsiBerkas('kisi_kisi', file);
  return pesan ? pesan.replace(/^Kisi-kisi harus/, 'Panduan CBT harus') : null;
}

// ---- Data tiruan (selama endpoint belum ada; hanya tersimpan di memori tab ini) ----
const contoh = {};
function kontenContoh(ujianId) {
  if (!contoh[ujianId]) {
    contoh[ujianId] = { tata_tertib: '', panduan_video_url: '', panduan_keterangan: '', panduan_pdf: null, diperbarui_pada: null,
      diperbarui_oleh_nama: null, versi: null };
  }
  return contoh[ujianId];
}

export const muatInfoKonten = (ujianId) => denganTiruan(
  async () => (await api.get(`/ujian/${ujianId}/info-konten`)).data,
  () => ({ boleh_ubah: true, konten: { ...kontenContoh(ujianId) },
    tautan_info: { jenis: 'info', jalur: '/publik/info-ujian/contoh', aktif: true, berlaku: true, alasan: 'ok' } }),
);

const galat = (status, detail) => { const e = new Error(String(status)); e.response = { status, data: { detail } }; return e; };

export const simpanInfoKonten = (ujianId, isi, versi) => denganTiruan(
  async () => (await api.put(`/ujian/${ujianId}/info-konten`, { ...isi, versi: versi || null })).data,
  () => {
    const pesan = Object.values(galatIsianInfo(isi))[0];
    if (pesan) throw galat(422, pesan);
    const k = kontenContoh(ujianId);
    const waktu = new Date().toISOString();
    Object.assign(k, { tata_tertib: rapikanTataTertib(isi.tata_tertib), panduan_video_url: String(isi.panduan_video_url || '').trim(),
      panduan_keterangan: String(isi.panduan_keterangan || '').split(/\s+/).join(' ').trim(), diperbarui_pada: waktu,
      diperbarui_oleh_nama: 'Administrator (contoh)', versi: waktu });
    return { konten: { ...k } };
  },
);

export const unggahPanduanPdf = (ujianId, file, onProgres = () => {}) => denganTiruan(
  async () => {
    const form = new FormData();
    form.append('berkas', file);
    return (await api.post(`/ujian/${ujianId}/info-konten/panduan-pdf`, form, {
      // Wajib: instance `api` ber-header JSON; tanpa ini axios mengubah FormData menjadi JSON dan berkasnya hilang (422).
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => { if (e.total) onProgres(Math.round((e.loaded / e.total) * 100)); },
    })).data;
  },
  () => {
    onProgres(100);
    const k = kontenContoh(ujianId);
    k.panduan_pdf = { nama_file: file.name, ukuran_byte: file.size, diunggah_pada: new Date().toISOString(),
      diunggah_oleh_nama: 'Administrator (contoh)', ada_di_disk: true };
    return { konten: { ...k } };
  },
);

export const hapusPanduanPdf = (ujianId) => denganTiruan(
  async () => (await api.delete(`/ujian/${ujianId}/info-konten/panduan-pdf`)).data,
  () => {
    const k = kontenContoh(ujianId);
    k.panduan_pdf = null;
    return { konten: { ...k } };
  },
);

/**
 * Pratinjau PDF panduan di tab baru (ber-login, tanpa token publik). Tab dibuka lebih dulu (sinkron dengan klik) agar
 * tidak diblokir peramban, lalu diarahkan ke PDF setelah selesai dimuat. `tiruan` = buka PDF contoh.
 */
export async function bukaPanduanPdfAdmin(ujianId, tiruan = false) {
  if (tiruan) { bukaPanduanContoh(); return; }
  const tab = window.open('', '_blank');
  try {
    const r = await api.get(`/ujian/${ujianId}/info-konten/panduan-pdf`, { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
    if (tab) tab.location.href = url; else window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 5 * 60000);
  } catch (e) {
    if (tab) tab.close();
    let detail = 'PDF panduan tidak dapat dibuka.';
    try { detail = JSON.parse(await e?.response?.data?.text?.())?.detail || detail; } catch { /* blob bukan JSON */ }
    throw galat(e?.response?.status || 0, detail);
  }
}
