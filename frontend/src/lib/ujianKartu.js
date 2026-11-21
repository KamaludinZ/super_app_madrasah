/**
 * Ujian Madrasah — Kartu Peserta & Kartu Meja: PDF A4 berisi 8 kartu per halaman (2 x 4, tinggal digunting),
 * dicetak per ruang atau semua ruang sekaligus (tiap ruang mulai halaman baru), peserta urut nomor peserta.
 *
 * Kontrak server:
 *   GET /ujian/{ujian_id}/kartu/pilihan?jenis=peserta|meja
 *     -> { ujian, ruang: [{ id, nama_ruang, jenjang, peserta, tanpa_nomor, ada_foto }], ketua: { nama, nip } | null,
 *          kartu_per_halaman, foto_bawaan: 'pakai'|'tanpa' }
 *   GET /ujian/{ujian_id}/kartu/{peserta|meja}?ruang_id=&foto=pakai|tanpa   (ruang_id kosong = semua ruang) -> PDF
 *     foto 'pakai': pas foto siswa (dokumen Pas Foto / foto profil); siswa tanpa foto -> kotak kosong untuk ditempel.
 *   Akses: admin, kepala madrasah & waka kurikulum, serta panitia ujian itu (menu kartu_peserta / kartu_meja).
 */
import { api } from '@/lib/api';
import { denganTiruan } from '@/lib/ujian';
import { blobEndpointBelumAda, galatDariBlob } from '@/lib/ujianPeserta';

export const HALAMAN_KARTU = { peserta: '/ujian/kartu-peserta', meja: '/ujian/kartu-meja' };
export const JENIS_KARTU = {
  peserta: { label: 'Kartu Peserta', ket: 'Kartu identitas peserta: kop madrasah, pas foto 3x4 (opsional), nomor peserta, nama, kelas, NISN, ruang, dan tanda tangan Ketua Panitia.' },
  meja: { label: 'Kartu Meja', ket: 'Ditempel di meja ujian: nomor peserta berukuran besar, nama, kelas, ruang, dan pas foto (opsional).' },
};
export const jenisDariPath = (path = '') => (path.startsWith(HALAMAN_KARTU.meja) ? 'meja' : 'peserta');
export const OPSI_FOTO = {
  pakai: { label: 'Pakai foto', ket: 'Pas foto siswa dicetak di kartu; siswa yang belum punya pas foto mendapat kotak kosong untuk ditempel foto.' },
  tanpa: { label: 'Tanpa foto', ket: 'Kartu dicetak tanpa kotak foto; isian kartu dibuat lebih lebar.' },
};
export const FOTO_BAWAAN = { peserta: 'pakai', meja: 'tanpa' };

export const pilihanKartuTiruan = () => ({
  ujian: null,
  ruang: [
    { id: 'contoh-r01', nama_ruang: '01', jenjang: [7, 8], peserta: 32, tanpa_nomor: 0, ada_foto: 28 },
    { id: 'contoh-r02', nama_ruang: '02', jenjang: [9], peserta: 20, tanpa_nomor: 3, ada_foto: 0 },
  ],
  ketua: { nama: 'Siti Aminah, S.Pd. (contoh)', nip: '198001012005012001' },
  kartu_per_halaman: 8,
});

/** Pilihan cetak kartu satu ujian -> { ruang, ketua, kartu_per_halaman, tiruan }. */
export const muatPilihanKartu = (ujianId, jenis) => denganTiruan(
  async () => (await api.get(`/ujian/${ujianId}/kartu/pilihan`, { params: { jenis } })).data,
  pilihanKartuTiruan,
);

/** Jumlah halaman A4 untuk sejumlah ruang (tiap ruang mulai halaman baru). */
export const jumlahHalaman = (ruangList = [], perHalaman = 8) => ruangList.reduce((n, r) => n + Math.ceil((r.peserta || 0) / perHalaman), 0);

/** PDF kartu -> { blob, nama, tiruan }. `ruangId` kosong = semua ruang; `foto` = 'pakai' | 'tanpa'. */
export async function unduhKartu(ujianId, jenis, ruangId = '', namaRuang = '', foto = FOTO_BAWAAN[jenis]) {
  const cadangan = `kartu_${jenis}_${ruangId ? `ruang_${namaRuang}` : 'semua_ruang'}_${foto === 'pakai' ? 'dengan' : 'tanpa'}_foto.pdf`;
  try {
    const params = { foto, ...(ruangId ? { ruang_id: ruangId } : {}) };
    const res = await api.get(`/ujian/${ujianId}/kartu/${jenis}`, { params, responseType: 'blob' });
    const cd = res.headers?.['content-disposition'] || '';
    return { blob: res.data, nama: /filename="?([^";]+)"?/i.exec(cd)?.[1] || cadangan, tiruan: false };
  } catch (e) {
    if (await blobEndpointBelumAda(e)) {
      return { blob: new Blob([`Contoh ${JENIS_KARTU[jenis].label} — server belum tersedia.`], { type: 'text/plain' }), nama: cadangan.replace(/\.pdf$/, '.txt'), tiruan: true };
    }
    throw await galatDariBlob(e);
  }
}
