import { api } from '@/lib/api';

// Cetak dokumen resmi PKG dari template (Excel) dan konversi PDF.
//   POST /pkg/cetak { jenis: 'rekap' | 'guru', format: 'xlsx' | 'pdf', periode_id, guru_id?, lembar?: 'lengkap' | 'rekap' }
//        -> berkas (blob); `lembar` hanya untuk PDF laporan per guru (lengkap: COVER s.d. ORTU; rekap: 04-RKAP-PKG)
//        header: Content-Disposition (nama berkas), X-PKG-Mesin: 'openpyxl' | 'libreoffice' | 'reportlab'
//        (PDF memakai LibreOffice; bila tidak tersedia, cadangan ReportLab dengan penanda "bukan salinan identik"
//        dan header X-PKG-Cadangan berisi alasannya). 403 {alasan, pesan} di luar cakupan, 409/503 pesan teks.
// Setiap unduhan tercatat di riwayat unduhan & jejak audit:
//   GET /pkg/rekap/unduhan?periode_id= -> [{ id, jenis, format, periode_id, nama_berkas, versi_template,
//        checksum_template, aktor_id, aktor_nama, timestamp }]  (kepala madrasah, terbaru dulu)

export const JENIS_DOKUMEN = {
  rekap: { judul: 'Rekap Hasil PKG', keterangan: 'Seluruh guru dalam cakupan Anda (format rekap_hasil_pkg_v2026)' },
  guru: { judul: 'Laporan PKG per Guru', keterangan: 'Berkas hasil PKG satu guru: cover, laporan, identitas, kompetensi, rekap, 360°, dan kehadiran' },
  angket: { judul: 'Angket 360°', keterangan: 'Angket kertas sejawat, peserta didik, atau orang tua/wali' },
  form: { judul: 'Form Isian Kosong', keterangan: 'Form cetak offline untuk diisi tim penilai lalu diinput ke aplikasi' },
};

// Jenis form isian kosong (POST /pkg/cetak/form).
export const JENIS_FORM = {
  instrumen: { judul: 'Instrumen Penilaian Kinerja', keterangan: 'Indikator Level 1–5 per sub-kompetensi dengan kotak centang' },
  kehadiran: { judul: 'Kehadiran', keterangan: 'Rekap per bulan semester (terlambat, pulang cepat, tanpa keterangan, hadir, izin, sakit)' },
  pkb: { judul: 'Rekomendasi PKB', keterangan: 'Opsi PKB dan fokus kompetensi tinggal dicentang' },
  paket: { judul: 'Paket Lengkap', keterangan: 'Instrumen, kehadiran, dan rekomendasi PKB dalam satu PDF' },
};

export const MESIN_LABEL = {
  openpyxl: 'Excel dari template resmi',
  libreoffice: 'PDF identik (LibreOffice)',
  reportlab: 'PDF cadangan (ReportLab) — bukan salinan identik Excel',
};

// Galat cetak; `penolakan` = { alasan, pesan } bila server menolak 403.
export class GalatCetak extends Error {
  constructor(pesan, penolakan = null) {
    super(pesan);
    this.penolakan = penolakan;
  }
}

// Tahap proses cetak untuk umpan balik di layar (PDF menambah tahap konversi).
export const TAHAP_CETAK = [
  { kunci: 'template', label: 'Membaca template resmi' },
  { kunci: 'isi', label: 'Mengisi data penilaian' },
  { kunci: 'pdf', label: 'Mengonversi ke PDF', hanyaPdf: true },
];

// Nama berkas dari Content-Disposition (utamakan filename* UTF-8).
export function namaDariHeader(cd, cadangan) {
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(cd || '');
  if (utf8) {
    try { return decodeURIComponent(utf8[1]); } catch { /* pakai filename biasa */ }
  }
  const biasa = /filename="?([^";]+)"?/i.exec(cd || '');
  return biasa ? biasa[1] : cadangan;
}

// Galat dari respons blob: detail JSON server dibaca dari isi blob.
export async function galatDariRespons(e) {
  let detail = e?.response?.data;
  if (detail instanceof Blob) {
    try { detail = JSON.parse(await detail.text())?.detail; } catch { detail = null; }
  } else {
    detail = detail?.detail;
  }
  if (e?.response?.status === 403 && detail && typeof detail === 'object') return new GalatCetak(detail.pesan || 'Akses ditolak.', detail);
  if (typeof detail === 'string') return new GalatCetak(detail);
  if (Array.isArray(detail)) return new GalatCetak('Permintaan cetak tidak valid.');
  return new GalatCetak(e?.response ? 'Gagal menyiapkan berkas.' : 'Tidak dapat terhubung ke server.');
}

// `onTahap(kunci)` dipanggil setiap tahap dimulai (umpan balik proses). Server mengerjakan semuanya dalam satu
// permintaan, jadi tahap berikutnya ditampilkan bertahap selama menunggu respons.
export async function unduhDokumen({ jenis, format, periode, guru = null, lembar = 'lengkap', onTahap = () => {} }) {
  onTahap('template');
  const urutan = TAHAP_CETAK.filter((t) => !t.hanyaPdf || format === 'pdf').map((t) => t.kunci);
  const pewaktu = urutan.slice(1).map((kunci, i) => setTimeout(() => onTahap(kunci), 700 * (i + 1)));
  try {
    const res = await api.post('/pkg/cetak', {
      jenis, format, periode_id: periode?.id || undefined, guru_id: jenis === 'guru' ? guru?.guru_id : undefined,
      lembar: jenis === 'guru' ? lembar : undefined,
    }, { responseType: 'blob' });
    const mesin = res.headers?.['x-pkg-mesin'] || (format === 'pdf' ? 'libreoffice' : 'openpyxl');
    return {
      blob: res.data,
      namaBerkas: namaDariHeader(res.headers?.['content-disposition'], `PKG.${format}`),
      mesin,
      alasanCadangan: res.headers?.['x-pkg-cadangan'] || null,
    };
  } catch (e) {
    throw await galatDariRespons(e);
  } finally {
    pewaktu.forEach(clearTimeout);
  }
}

// Form isian kosong untuk dicetak dan diisi offline (PDF): POST /pkg/cetak/form
//   { jenis: 'instrumen' | 'kehadiran' | 'pkb' | 'paket', periode_id?, guru_id?, semua_guru? } -> PDF (blob).
// guru_id mengisi identitas guru & memakai instrumen lembarnya; semua_guru = satu PDF berisi form setiap guru dalam cakupan.
export async function cetakFormKosong({ jenis, periodeId, guruId, semuaGuru = false }) {
  try {
    const res = await api.post('/pkg/cetak/form', {
      jenis, periode_id: periodeId || undefined, guru_id: guruId || undefined, semua_guru: semuaGuru || undefined,
    }, { responseType: 'blob' });
    return {
      blob: res.data,
      namaBerkas: namaDariHeader(res.headers?.['content-disposition'], `Form_PKG_${jenis}.pdf`),
      mesin: res.headers?.['x-pkg-mesin'] || null,
    };
  } catch (e) {
    throw await galatDariRespons(e);
  }
}

// Simpan blob sebagai berkas unduhan di peramban.
export function simpanBerkas(blob, namaBerkas) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = namaBerkas;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function riwayatUnduhan(periodeId) {
  try {
    const { data } = await api.get('/pkg/rekap/unduhan', { params: periodeId ? { periode_id: periodeId } : {} });
    return data;
  } catch (e) {
    const d = e?.response?.data?.detail;
    throw new Error(typeof d === 'string' ? d : d?.pesan || 'Gagal memuat riwayat unduhan.');
  }
}
