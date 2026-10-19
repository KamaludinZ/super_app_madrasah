import { api } from '@/lib/api';

// Info berkas template resmi PKG (Excel instrumen & rekap) beserta versi dan checksum (GET /pkg/template/info):
//   { versi_template, diperiksa_pada, utuh, berkas: [{ jenis, nama_berkas, judul, versi, ukuran,
//     checksum, checksum_resmi, status: 'cocok' | 'berbeda' | 'hilang' }] }
// Checksum = SHA-256 isi berkas; `status` membandingkan berkas di server dengan checksum resmi.
// `periksaUlang` hanya berlaku untuk kepala madrasah (server mengabaikannya untuk peran lain).

export async function ambilInfoTemplate({ periksaUlang = false } = {}) {
  const { data } = await api.get('/pkg/template/info', { params: periksaUlang ? { periksa_ulang: true } : {} });
  return data;
}

export function formatUkuran(byte) {
  if (byte == null) return '-';
  if (byte < 1024) return `${byte} B`;
  if (byte < 1024 * 1024) return `${(byte / 1024).toFixed(1)} KB`;
  return `${(byte / (1024 * 1024)).toFixed(2)} MB`;
}
