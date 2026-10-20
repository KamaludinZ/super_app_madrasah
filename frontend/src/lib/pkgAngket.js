import { api } from '@/lib/api';
import { galatDariRespons, namaDariHeader } from '@/lib/pkgCetak';

// Angket penilaian 360° (sejawat, peserta didik, orang tua/wali) — backend/routers/pkg_angket_api.py.
// Angket dicetak di kertas (format FORM-360-GR template resmi), diisi responden tanpa akun, lalu rekap jawabannya
// diinput kembali oleh kepala madrasah / tim penilai. DUDI tidak dipakai (khusus SMK).
//   GET  /pkg/angket/jenis -> [{ jenis, label, sheet, jumlah_butir, skor_maks, maks_responden }]
//   POST /pkg/angket/cetak { jenis_angket, format: 'pdf' | 'xlsx', periode_id?, guru_id? } -> berkas (blob)
//        tanpa guru_id = angket kosong; header X-PKG-Mesin / X-PKG-Cadangan seperti cetak dokumen resmi.

export const JENIS_ANGKET = {
  sejawat: { label: 'Teman Sejawat', keterangan: 'Diisi rekan guru' },
  siswa: { label: 'Peserta Didik', keterangan: 'Diisi siswa yang diajar' },
  ortu: { label: 'Orang Tua/Wali', keterangan: 'Diisi orang tua/wali siswa' },
};

async function panggil(fn, cadangan) {
  try {
    return (await fn()).data;
  } catch (e) {
    const d = e?.response?.data?.detail;
    throw new Error(typeof d === 'string' ? d : d?.pesan || cadangan);
  }
}

export const daftarJenisAngket = () => panggil(() => api.get('/pkg/angket/jenis'), 'Gagal memuat jenis angket.');

export async function cetakAngket({ jenis, format = 'pdf', periodeId, guruId }) {
  try {
    const res = await api.post('/pkg/angket/cetak', {
      jenis_angket: jenis, format, periode_id: periodeId || undefined, guru_id: guruId || undefined,
    }, { responseType: 'blob' });
    return {
      blob: res.data,
      namaBerkas: namaDariHeader(res.headers?.['content-disposition'], `Angket_360_${jenis}.${format}`),
      mesin: res.headers?.['x-pkg-mesin'] || null,
      alasanCadangan: res.headers?.['x-pkg-cadangan'] || null,
    };
  } catch (e) {
    throw await galatDariRespons(e);
  }
}
