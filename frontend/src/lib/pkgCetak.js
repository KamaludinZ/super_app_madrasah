import { api } from '@/lib/api';

// Cetak dokumen resmi PKG dari template (Excel) dan konversi PDF.
//
// TIRUAN SEMENTARA: meniru kontrak yang direncanakan; saat endpoint backend tersedia ganti dengan `api`:
//   POST /pkg/cetak { jenis: 'rekap' | 'guru', format: 'xlsx' | 'pdf', periode_id, guru_id? } -> berkas (blob)
//        header: Content-Disposition (nama berkas), X-PKG-Mesin: 'openpyxl' | 'libreoffice' | 'reportlab'
//        (PDF memakai LibreOffice; bila tidak tersedia, cadangan ReportLab dengan penanda "bukan salinan identik")
// Setiap unduhan tercatat di riwayat unduhan & jejak audit:
//   GET /pkg/rekap/unduhan?periode_id= -> [{ id, jenis, format, periode_id, nama_berkas, versi_template,
//        checksum_template, aktor_id, aktor_nama, timestamp }]  (kepala madrasah, terbaru dulu)

export const JENIS_DOKUMEN = {
  rekap: { judul: 'Rekap Hasil PKG', keterangan: 'Seluruh guru dalam cakupan Anda (format rekap_hasil_pkg_v2026)' },
  guru: { judul: 'Laporan PKG per Guru', keterangan: 'Rekapitulasi hasil penilaian satu guru (format 04-RKAP-PKG)' },
};

export const MESIN_LABEL = {
  openpyxl: 'Excel dari template resmi',
  libreoffice: 'PDF identik (LibreOffice)',
  reportlab: 'PDF cadangan (ReportLab) — bukan salinan identik Excel',
};

const nama = (dasar, format) => `${dasar.replace(/[^A-Za-z0-9_-]+/g, '_')}.${format}`;

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

const jeda = (ms) => new Promise((r) => { setTimeout(r, ms); });

// Tiruan: ?cetak=cadangan (development) -> PDF via ReportLab; ?cetak=tolak -> 403.
const skenarioTiruan = () => (process.env.NODE_ENV !== 'production' ? new URLSearchParams(window.location.search).get('cetak') : null);

// `onTahap(kunci)` dipanggil setiap tahap dimulai (umpan balik proses).
export async function unduhDokumen({ jenis, format, periode, guru = null, onTahap = () => {} }) {
  const skenario = skenarioTiruan();
  onTahap('template');
  await jeda(400);
  if (skenario === 'tolak') {
    throw new GalatCetak('Guru ini tidak termasuk dalam cakupan Anda.', { alasan: 'bukan_penugasan', pesan: 'Laporan guru ini tidak termasuk dalam cakupan Anda.' });
  }
  onTahap('isi');
  await jeda(400);
  if (format === 'pdf') {
    onTahap('pdf');
    await jeda(500);
  }
  const dasar = jenis === 'guru' ? `Laporan_PKG_${guru?.nama || 'guru'}_${periode?.nama_periode || ''}` : `Rekap_Hasil_PKG_${periode?.nama_periode || ''}`;
  const isi = `Berkas tiruan ${JENIS_DOKUMEN[jenis].judul} (${format.toUpperCase()})\nPeriode: ${periode?.nama_periode || '-'}\n${guru ? `Guru: ${guru.nama}\n` : ''}`;
  return {
    blob: new Blob([isi], { type: 'text/plain' }),
    namaBerkas: nama(dasar, format),
    mesin: format === 'pdf' ? (skenario === 'cadangan' ? 'reportlab' : 'libreoffice') : 'openpyxl',
  };
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
