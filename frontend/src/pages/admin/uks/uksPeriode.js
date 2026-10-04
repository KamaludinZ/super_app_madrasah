// Helper periode laporan UKS (bulanan/tahunan), berbasis tanggal WIB.

export const BULAN_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export const todayWib = () => new Date(Date.now() + 7 * 3600000);

export const defaultPeriode = () => {
  const t = todayWib();
  return { mode: 'bulanan', tahun: String(t.getUTCFullYear()), bulan: String(t.getUTCMonth() + 1).padStart(2, '0') };
};

// Rentang tanggal (YYYY-MM-DD) untuk periode terpilih.
export const rentangPeriode = ({ mode, tahun, bulan }) => {
  if (mode === 'tahunan') return { start: `${tahun}-01-01`, end: `${tahun}-12-31` };
  const last = new Date(Date.UTC(Number(tahun), Number(bulan), 0)).getUTCDate();
  return { start: `${tahun}-${bulan}-01`, end: `${tahun}-${bulan}-${String(last).padStart(2, '0')}` };
};

export const labelPeriode = ({ mode, tahun, bulan }) => (
  mode === 'tahunan' ? `Tahun ${tahun}` : `${BULAN_ID[Number(bulan) - 1]} ${tahun}`
);

// Parameter query yang dikirim ke endpoint laporan.
export const paramsPeriode = (p) => (p.mode === 'tahunan'
  ? { periode: 'tahunan', tahun: p.tahun }
  : { periode: 'bulanan', tahun: p.tahun, bulan: p.bulan });

export const tahunOptions = (mundur = 5) => {
  const now = todayWib().getUTCFullYear();
  return Array.from({ length: mundur + 1 }, (_, i) => String(now - i));
};
