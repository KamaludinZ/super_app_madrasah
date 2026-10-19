// Info berkas template resmi PKG (Excel instrumen & rekap) beserta versi dan checksum.
//
// TIRUAN SEMENTARA: meniru kontrak GET /pkg/template/info. Saat endpoint backend tersedia, ganti isi
// ambilInfoTemplate() dengan panggilan `api` berbentuk sama:
//   { versi_template, diperiksa_pada, berkas: [{ jenis, nama_berkas, judul, versi, ukuran,
//     checksum, checksum_resmi, status: 'cocok' | 'berbeda' | 'hilang' }] }
// Checksum = SHA-256 isi berkas; `status` membandingkan checksum berkas di server dengan checksum resmi.

const TIRUAN = {
  versi_template: '2026',
  diperiksa_pada: '2026-10-19T07:30:00+07:00',
  berkas: [
    {
      jenis: 'instrumen', nama_berkas: 'pkg_template_v2026.xlsx', judul: 'Instrumen PKG Tahun 2026', versi: '2026',
      ukuran: 2595694,
      checksum: 'e4e768b7b5dfbdbc1a32a1b88d9a731bcceac2c1ffd2af9801aa8a994f637da5',
      checksum_resmi: 'e4e768b7b5dfbdbc1a32a1b88d9a731bcceac2c1ffd2af9801aa8a994f637da5',
      status: 'cocok',
    },
    {
      jenis: 'rekap', nama_berkas: 'rekap_hasil_pkg_v2026.xlsx', judul: 'Rekap Hasil PKG 2026', versi: '2026',
      ukuran: 13558,
      checksum: '5a8d72c523c82869b3a874679eb6392d2e365660af3d81628e750b89376a775e',
      checksum_resmi: '5a8d72c523c82869b3a874679eb6392d2e365660af3d81628e750b89376a775e',
      status: 'cocok',
    },
  ],
};

export const ambilInfoTemplate = () => new Promise((r) => { setTimeout(() => r(JSON.parse(JSON.stringify(TIRUAN))), 150); });

export function formatUkuran(byte) {
  if (byte == null) return '-';
  if (byte < 1024) return `${byte} B`;
  if (byte < 1024 * 1024) return `${(byte / 1024).toFixed(1)} KB`;
  return `${(byte / (1024 * 1024)).toFixed(2)} MB`;
}
