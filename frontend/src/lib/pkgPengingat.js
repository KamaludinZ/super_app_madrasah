import { formatWIBPanjang } from '@/lib/datetime';
import { hariIniWIB } from '@/lib/tanggal';
import { berandaTiruan } from '@/lib/pkgDataTiruan';

// Pengingat tenggat PKG untuk Beranda PKG dan lonceng notifikasi.
// Bentuk item lonceng sama dengan GET /notifications (source 'pkg', sintetis seperti pengingat password).

// Pengingat masuk lonceng bila tenggatnya 0–14 hari lagi.
export const JENDELA_LONCENG_HARI = 14;

// Selisih hari dari hari ini (WIB) ke tanggal 'YYYY-MM-DD'.
export const sisaHari = (tanggal) => Math.round((new Date(`${tanggal}T00:00:00Z`) - new Date(`${hariIniWIB()}T00:00:00Z`)) / 86400000);

const keparahan = (sisa) => (sisa <= 3 ? 'critical' : sisa <= 7 ? 'warning' : 'info');

const teksSisa = (sisa) => (sisa === 0 ? 'hari ini' : `${sisa} hari lagi`);

export function pengingatKeNotifikasi(pengingat = []) {
  return pengingat
    .map((p) => ({ p, sisa: sisaHari(p.tanggal) }))
    .filter(({ sisa }) => sisa >= 0 && sisa <= JENDELA_LONCENG_HARI)
    .sort((a, b) => a.sisa - b.sisa)
    .map(({ p, sisa }) => ({
      id: `pkg_${p.id}`,
      source: 'pkg',
      source_id: p.id,
      title: `PKG: ${p.judul} — ${teksSisa(sisa)}`,
      body: `Tenggat ${formatWIBPanjang(p.tanggal, false)}. ${p.keterangan}`,
      severity: keparahan(sisa),
      is_pinned: false,
      is_read: false,
      created_at: new Date().toISOString(),
      link: '/pkg',
      icon: 'calendar-clock',
    }));
}

// Sementara (sebelum backend menyertakan source 'pkg' di GET /notifications): pengingat dari data tiruan,
// hanya di mode development agar lonceng pengguna produksi tidak memuat data palsu.
export function pengingatPkgLonceng() {
  if (process.env.NODE_ENV === 'production') return [];
  return pengingatKeNotifikasi(berandaTiruan().pengingat);
}
