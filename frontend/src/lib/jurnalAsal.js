import { api } from '@/lib/api';

// Asal input jurnal mengajar (backend/jurnal_asal.py):
//   'jurnal_presisi' = isi jurnal tepat waktu lewat alur awal (scan QR / token kelas); data lama tanpa penanda juga ini.
//   'catat_jurnal'   = tombol Catat Jurnal: isi jurnal di luar jam setelah pelajaran selesai (+ toleransi), s.d. 24.00 WIB.
//   POST /jurnal/catat { schedule_id, materi, indikator_id?, materi_id?, catatan?, attendance_details } -> jurnal
//   GET  /admin/jurnal/asal-input?bulan=YYYY-MM -> { bulan, label, guru: [{ teacher_id, teacher_name,
//        jurnal_presisi, catat_jurnal, total }], total }   (dashboard kepala madrasah)
// Jadwal hari ini (GET /schedules/my-today) membawa `catat_jurnal` { tersedia, dibuka_pada, berakhir_pada, alasan }.
// Monitoring publik tidak membedakan asal input (tetap "Jurnal Terisi").

export const ASAL_PRESISI = 'jurnal_presisi';
export const ASAL_CATAT = 'catat_jurnal';

// Warna seri grafik (divalidasi CVD & kontras): hijau brand untuk Presisi, oranye untuk Catat Jurnal.
export const ASAL_INPUT = {
  [ASAL_PRESISI]: {
    label: 'Jurnal Presisi', warna: '#006837',
    badge: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  },
  [ASAL_CATAT]: {
    label: 'Catat Jurnal', warna: '#eb6834',
    badge: 'bg-orange-50 text-orange-800 border-orange-300',
  },
};

export const asalInput = (jurnal) => (jurnal?.asal_input === ASAL_CATAT ? ASAL_CATAT : ASAL_PRESISI);

function pesanGalat(e, cadangan) {
  const d = e?.response?.data?.detail;
  if (typeof d === 'string') return d;
  if (Array.isArray(d) && d[0]?.msg) return `Isian tidak valid: ${d[0].msg}`;
  return d?.message || cadangan;
}

export async function catatJurnal(isi) {
  try {
    return (await api.post('/jurnal/catat', isi)).data;
  } catch (e) {
    throw new Error(pesanGalat(e, 'Gagal menyimpan jurnal'));
  }
}

export async function rekapAsalInput(bulan) {
  try {
    return (await api.get('/admin/jurnal/asal-input', { params: bulan ? { bulan } : {} })).data;
  } catch (e) {
    throw new Error(pesanGalat(e, 'Gagal memuat rekap pengisian jurnal'));
  }
}

const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

// `n` bulan terakhir termasuk bulan ini (terbaru dulu): [{ value: 'YYYY-MM', label: 'Oktober 2026' }].
export function daftarBulan(n = 12, dari = new Date()) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(dari.getFullYear(), dari.getMonth() - i, 1);
    return { value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: `${NAMA_BULAN[d.getMonth()]} ${d.getFullYear()}` };
  });
}
