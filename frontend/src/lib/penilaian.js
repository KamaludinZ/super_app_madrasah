/**
 * Input Nilai guru mapel — tab Ulangan, Sumatif, UTS (kolom penilaian) dan UAS (dari modul Ujian Madrasah).
 *
 * Kontrak server (backend/routers/penilaian.py):
 *   GET    /penilaian/kelas/{class_id}/mapel/{subject_id}?semester=
 *     -> { kelas, mapel, semester, tahun_pelajaran, mode: 'nilai'|'pk', mode_terkunci, kktp_bawaan,
 *          siswa: [{ id, nama, nisn, nis, jk }],
 *          kolom: { ulangan: [Kolom], sumatif: [Kolom], uts: Kolom|null },
 *          rekap: { [siswa_id]: { ulangan, sumatif, uts, uas } } }
 *     Kolom = { id, jenis, ke, ringkasan, kktp, interval, rerata_kelas, diubah_oleh_nama, diubah_pada,
 *               nilai: { [siswa_id]: { nilai?|p?,k?, akhir, ketercapaian } } }
 *   PUT    .../mode { semester, mode }                     (409 bila sudah ada nilai)
 *   POST   .../kolom { semester, jenis, ke, ringkasan, kktp, nilai }   (UTS: membuat/memperbarui kolom tunggal)
 *   PUT    /penilaian/kolom/{id} { ke?, ringkasan?, kktp?, nilai? }
 *   DELETE /penilaian/kolom/{id}
 *   GET    .../template?semester=&jenis=&kolom_id=          -> .xlsx
 *   POST   .../impor (multipart: semester, jenis, berkas)   -> { nilai, terbaca, kosong, galat, galat_total } (tidak menyimpan)
 */
import { api } from '@/lib/api';
import { simpanBerkas } from '@/lib/ujianPeserta';

export const JENIS_TAB = {
  ulangan: { label: 'Ulangan', keLabel: 'Ulangan Ke', singkat: 'UH', ringkasanLabel: 'Materi Ulangan',
    ringkasanContoh: 'Materi atau kompetensi yang diujikan pada ulangan ini' },
  sumatif: { label: 'Sumatif', keLabel: 'TP/LM Ke', singkat: 'TP', ringkasanLabel: 'Ringkasan TP/Lingkup Materi',
    ringkasanContoh: 'Point penting dari TP/Lingkup Materi di awali dengan KKO (Kata Kerja Operasional)' },
  uts: { label: 'UTS', keLabel: null, singkat: 'UTS', ringkasanLabel: 'Lingkup Materi UTS', ringkasanContoh: 'Lingkup materi yang diujikan pada UTS' },
  uas: { label: 'UAS' },
};
export const MODE_KOLOM = {
  nilai: { label: 'Kolom Nilai', ket: 'Satu kolom nilai per siswa.' },
  pk: { label: 'Pengetahuan & Keterampilan', ket: 'Dua kolom; nilai akhir = rerata pengetahuan dan keterampilan.' },
};
export const KETERCAPAIAN = {
  belum: { label: 'Belum Tercapai', kelas: 'bg-rose-50 text-rose-700 border-rose-200' },
  cukup: { label: 'Cukup', kelas: 'bg-amber-50 text-amber-800 border-amber-200' },
  baik: { label: 'Baik', kelas: 'bg-sky-50 text-sky-800 border-sky-200' },
  sangat_baik: { label: 'Sangat Baik', kelas: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
};

// ---- Perhitungan (sama dengan backend/penilaian.py) ----
export function batasInterval(kktp) {
  const k = Number(kktp);
  const lebar = (100 - k) / 3;
  return [Math.ceil(Number((k + lebar).toFixed(6))), Math.ceil(Number((k + 2 * lebar).toFixed(6)))];
}

/** { belum, cukup, baik, sangat_baik: [min, maks] | null } atau null bila KKTP kosong/tidak sah. */
export function intervalKetercapaian(kktp) {
  if (kktp === '' || kktp == null || Number.isNaN(Number(kktp)) || Number(kktp) < 0 || Number(kktp) > 100) return null;
  const [b2, b3] = batasInterval(kktp);
  const kk = Math.ceil(Number(kktp));
  const r = (a, b) => (a <= b ? [a, b] : null);
  return { belum: r(0, kk - 1), cukup: r(kk, b2 - 1), baik: r(b2, b3 - 1), sangat_baik: r(b3, 100) };
}

export function ketercapaian(nilai, kktp) {
  if (nilai == null || nilai === '' || kktp === '' || kktp == null || Number.isNaN(Number(nilai))) return null;
  const n = Number(nilai);
  const k = Number(kktp);
  if (n < k) return 'belum';
  const [b2, b3] = batasInterval(k);
  if (n < b2) return 'cukup';
  if (n < b3) return 'baik';
  return 'sangat_baik';
}

const angka = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));
const bulat = (v) => (v == null ? null : Math.round(v * 100) / 100);

/** Nilai akhir satu isian menurut mode ('nilai' -> nilai; 'pk' -> rerata pengetahuan & keterampilan yang terisi). */
export function nilaiAkhir(isian, mode) {
  if (!isian) return null;
  if (mode === 'pk') {
    const ada = [angka(isian.p), angka(isian.k)].filter((v) => v != null);
    return ada.length ? bulat(ada.reduce((a, b) => a + b, 0) / ada.length) : null;
  }
  return bulat(angka(isian.nilai));
}

export const formatNilai = (v) => (v == null || v === '' ? '-' : Number(v).toLocaleString('id-ID', { maximumFractionDigits: 2 }));
export const teksInterval = (r) => (r ? `${r[0]} – ${r[1]}` : '-');
export const nilaiSah = (v) => v === '' || v == null || (!Number.isNaN(Number(v)) && Number(v) >= 0 && Number(v) <= 100);

// ---- API ----
const dasar = (classId, subjectId) => `/penilaian/kelas/${classId}/mapel/${subjectId}`;

export const muatPenilaian = async (classId, subjectId, semester) => (await api.get(dasar(classId, subjectId), { params: { semester } })).data;
export const ubahMode = async (classId, subjectId, semester, mode) => (await api.put(`${dasar(classId, subjectId)}/mode`, { semester, mode })).data;
export const tambahKolom = async (classId, subjectId, body) => (await api.post(`${dasar(classId, subjectId)}/kolom`, body)).data;
export const ubahKolom = async (kolomId, body) => (await api.put(`/penilaian/kolom/${kolomId}`, body)).data;
export const hapusKolom = async (kolomId) => (await api.delete(`/penilaian/kolom/${kolomId}`)).data;

export async function unduhTemplate(classId, subjectId, semester, jenis, kolomId = '') {
  const res = await api.get(`${dasar(classId, subjectId)}/template`, {
    params: { semester, jenis, ...(kolomId ? { kolom_id: kolomId } : {}) }, responseType: 'blob',
  });
  const cd = res.headers?.['content-disposition'] || '';
  simpanBerkas(res.data, /filename="?([^";]+)"?/i.exec(cd)?.[1] || `nilai_${jenis}.xlsx`);
}

/** Baca berkas impor di server -> nilai per siswa untuk diisikan ke tabel (belum disimpan). */
export async function bacaImpor(classId, subjectId, semester, jenis, berkas) {
  const form = new FormData();
  form.append('semester', semester);
  form.append('jenis', jenis);
  form.append('berkas', berkas);
  return (await api.post(`${dasar(classId, subjectId)}/impor`, form, { headers: { 'Content-Type': 'multipart/form-data' } })).data;
}

/** Pesan galat dari respons blob/JSON axios. */
export async function pesanGalatApi(e, cadangan) {
  const data = e?.response?.data;
  if (data instanceof Blob) {
    try { return JSON.parse(await data.text())?.detail || cadangan; } catch { return cadangan; }
  }
  const d = data?.detail;
  if (Array.isArray(d)) return d.map((x) => x?.msg).filter(Boolean).join('; ') || cadangan;
  return d || cadangan;
}
