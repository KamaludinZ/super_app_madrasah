/**
 * Ujian Madrasah — Master Guru Pengawas: daftar guru yang dapat dipilih pengawas saat mengisi berita acara. Hanya
 * master pilihan (berlaku untuk semua ujian), TANPA plotting pengawas per ruang.
 *
 * Kontrak server (backend menyusul; koleksi `guru_pengawas`):
 *   GET    /ujian/pengawas                     -> { boleh_ubah, items: [Pengawas] }   (admin; ketua & sekretaris melihat)
 *   POST   /ujian/pengawas { user_ids: [..] }  -> { ditambahkan, dilewati: [{ user_id, alasan }], items }
 *                                                (admin; akun GTK aktif saja)
 *   PATCH  /ujian/pengawas/{id} { aktif }      -> Pengawas                           (admin; nonaktif = tidak tampil di
 *                                                                                    pilihan berita acara)
 *   DELETE /ujian/pengawas/{id}                -> { ok }  (admin; pengawas yang sudah mengisi berita acara tidak
 *                                                          dapat dihapus -> 409, cukup dinonaktifkan)
 *
 *   Pengawas = { id, user_id, nama, nip, peran, aktif, dipakai: jumlah berita acara, ditambahkan_pada }
 */
import { api } from '@/lib/api';
import { denganTiruan, gtkPilihanTiruan } from '@/lib/ujian';

export const HALAMAN_PENGAWAS = '/ujian/pengawas';

let pengawasContoh = null;

function galatContoh(status, detail) {
  const e = new Error(detail);
  e.response = { status, data: { detail } };
  return e;
}

export function pengawasTiruan() {
  if (!pengawasContoh) {
    const gtk = gtkPilihanTiruan().filter((g) => !['kepala_sekolah', 'tenaga_kependidikan', 'kepala_tata_usaha'].includes(g.peran));
    pengawasContoh = gtk.map((g, i) => ({
      ...g, id: `contoh-pengawas-${i + 1}`, aktif: i !== 3, dipakai: i < 2 ? 3 : 0, ditambahkan_pada: '2026-11-01T08:00:00+07:00',
    }));
  }
  return { boleh_ubah: true, items: pengawasContoh.map((p) => ({ ...p })) };
}

/** Master guru pengawas -> { boleh_ubah, items, tiruan }. */
export const muatPengawas = () => denganTiruan(
  async () => (await api.get('/ujian/pengawas')).data,
  pengawasTiruan,
);

/** Tambah beberapa GTK sebagai pengawas -> { ditambahkan, dilewati, tiruan }. */
export const tambahPengawas = (userIds) => denganTiruan(
  async () => (await api.post('/ujian/pengawas', { user_ids: userIds })).data,
  () => {
    pengawasTiruan();
    const gtk = gtkPilihanTiruan();
    let ditambahkan = 0;
    const dilewati = [];
    userIds.forEach((uid) => {
      const g = gtk.find((x) => x.user_id === uid);
      if (!g) { dilewati.push({ user_id: uid, alasan: 'Bukan akun GTK aktif' }); return; }
      if (pengawasContoh.some((p) => p.user_id === uid)) { dilewati.push({ user_id: uid, alasan: 'Sudah terdaftar sebagai pengawas' }); return; }
      pengawasContoh.push({ ...g, id: `contoh-pengawas-${Date.now()}-${uid}`, aktif: true, dipakai: 0, ditambahkan_pada: new Date().toISOString() });
      ditambahkan += 1;
    });
    return { ditambahkan, dilewati, items: pengawasContoh };
  },
);

/** Aktifkan/nonaktifkan pengawas -> { pengawas, tiruan }. */
export const aturAktifPengawas = (id, aktif) => denganTiruan(
  async () => ({ pengawas: (await api.patch(`/ujian/pengawas/${id}`, { aktif })).data }),
  () => {
    pengawasTiruan();
    const p = pengawasContoh.find((x) => x.id === id);
    if (p) p.aktif = aktif;
    return { pengawas: { ...p } };
  },
);

/** Hapus pengawas yang belum pernah mengisi berita acara -> { tiruan }. */
export const hapusPengawas = (id) => denganTiruan(
  async () => { await api.delete(`/ujian/pengawas/${id}`); return {}; },
  () => {
    pengawasTiruan();
    const p = pengawasContoh.find((x) => x.id === id);
    if (p?.dipakai) throw galatContoh(409, `${p.nama} sudah mengisi ${p.dipakai} berita acara; nonaktifkan saja agar riwayatnya tetap utuh`);
    pengawasContoh = pengawasContoh.filter((x) => x.id !== id);
    return {};
  },
);
