import { api } from '@/lib/api';

// Poin Tata Tertib: helper nilai + pemanggil API (backend/routers/tatib.py & tatib_poin.py).
// Poin kebaikan selalu PLUS, pelanggaran selalu MINUS; nilai dihitung dari aturan + kondisi.

// Nilai poin dihitung dari aturan + kondisi (bukan diketik petugas); tanda dipaksa sesuai jalur.
// Server menghitung ulang dengan aturan yang sama (hitung_poin_aturan) saat menyimpan.
// -> { poin, kondisi } atau null bila aturan/kondisi belum lengkap.
export function hitungNilaiPoin(jenis, aturan, kondisiId) {
  const kondisi = aturan?.kondisi?.find((k) => k.id === kondisiId);
  if (!kondisi) return null;
  const besar = Math.abs(Number(kondisi.poin) || 0);
  return { poin: jenis === 'pelanggaran' ? -besar : besar, kondisi };
}

// Kondisi yang disarankan otomatis: aturan berkondisi 'pertama'/'ulang' memakai 'ulang'
// bila siswa sudah pernah tercatat dengan kode aturan yang sama.
// -> { kondisi_id, jumlahSebelumnya } atau null bila tidak ada saran.
export function sarankanKondisi(aturan, siswaId, riwayat = []) {
  if (!aturan || !siswaId) return null;
  if (aturan.kondisi.length === 1) return { kondisi_id: aturan.kondisi[0].id, jumlahSebelumnya: 0 };
  const ids = aturan.kondisi.map((k) => k.id);
  if (!ids.includes('pertama') || !ids.includes('ulang')) return null;
  const jumlahSebelumnya = riwayat.filter((r) => r.siswa_id === siswaId && r.tatib_kode === aturan.kode).length;
  return { kondisi_id: jumlahSebelumnya > 0 ? 'ulang' : 'pertama', jumlahSebelumnya };
}

const tanpaKosong = (obj = {}) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && v != null));

// Semester & tahun takwim yang sedang dilihat pengguna (/auth/view-context), disimpan bersama catatan.
let konteksJanji = null;
export function konteksPeriode() {
  if (!konteksJanji) {
    konteksJanji = api.get('/auth/view-context')
      .then(({ data }) => ({ semester_id: data?.semester_id || null, tahun_takwim_id: data?.tahun_takwim_ids?.[0] || null }))
      .catch(() => {
        konteksJanji = null;
        return { semester_id: null, tahun_takwim_id: null };
      });
  }
  return konteksJanji;
}

// Aturan aktif satu jalur ('kebaikan' | 'pelanggaran') dalam bentuk yang dipakai formulir.
export async function ambilAturanPoin(jenis) {
  const { data } = await api.get('/tatib/aturan', { params: { jenis_poin: jenis } });
  return (data || [])
    .filter((a) => a.is_active !== false)
    .map((a) => ({ id: a.id, kode: a.kode, nama: a.nama_aturan, kategori_nama: a.kategori_nama || 'Lainnya', kondisi: a.kondisi || [] }));
}

// Catat poin lewat jalurnya; server menghitung nilai dari aturan + kondisi.
export async function catatPoin(jenis, { siswa_id, aturan_id, kondisi_id, tanggal, catatan }) {
  const periode = await konteksPeriode();
  const { data } = await api.post(`/tatib/poin/${jenis}`, {
    siswa_id, tatib_id: aturan_id, kondisi_id, tanggal, catatan: catatan || null, ...periode,
  });
  return data;
}

export async function tambahTindakLanjut(catatanId, { tanggal, uraian }) {
  const { data } = await api.post(`/tatib/penanganan/${catatanId}/tindak-lanjut`, { tanggal, uraian });
  return data;
}

export async function ambilPoinSaya() {
  const { data } = await api.get('/tatib/poin-saya');
  return data;
}

// Pantauan wali kelas: { kelas, batas_minus_perhatian, siswa: [... + rangkuman poin] }.
export async function ambilSiswaWaliKelas() {
  const { data } = await api.get('/tatib/walikelas/siswa');
  return data;
}

// Catatan poin siswa kelas yang diampu (server membatasi cakupan wali kelas).
export async function ambilCatatanKelas() {
  const { data } = await api.get('/tatib/penanganan');
  return data || [];
}

export async function ambilRekap(filter) {
  const { data } = await api.get('/tatib/rekap', { params: tanpaKosong(filter) });
  return data;
}

// Unduh Rekap Pengawas (.xlsx) -> { blob, nama } (nama dari Content-Disposition server).
export async function unduhRekap(filter) {
  const res = await api.get('/tatib/rekap/export', { params: tanpaKosong(filter), responseType: 'blob' });
  const cd = res.headers?.['content-disposition'] || '';
  const nama = /filename="?([^";]+)"?/i.exec(cd)?.[1] || `rekap_poin_tatib_${new Date().toISOString().slice(0, 10)}.xlsx`;
  return { blob: res.data, nama };
}
