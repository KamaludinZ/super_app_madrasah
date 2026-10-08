import { api } from '@/lib/api';

// Masterplan / Denah Sekolah: pemanggil API (backend/routers/masterplan.py).
// Gambar denah dikirim endpoint ber-autentikasi, jadi diambil sebagai blob lalu dijadikan object URL.

const pesanGalat = (e, cadangan) => {
  const d = e?.response?.data?.detail;
  return new Error(typeof d === 'string' ? d : cadangan);
};

async function panggil(fn, cadangan) {
  try {
    return (await fn()).data;
  } catch (e) {
    throw pesanGalat(e, cadangan);
  }
}

export const ambilMasterplan = () => panggil(() => api.get('/masterplan'), 'Gagal memuat denah sekolah');

// image_url dari server berawalan /api; axios sudah memakai baseURL /api.
export async function ambilGambarDenah(imageUrl) {
  const { data } = await api.get(imageUrl.replace(/^\/api(?=\/)/, ''), { responseType: 'blob' });
  return URL.createObjectURL(data);
}

export async function unggahDenah(berkas, onProgres) {
  const form = new FormData();
  form.append('berkas', berkas);
  return panggil(() => api.post('/masterplan/denah', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (ev) => ev.total && onProgres?.(Math.round((ev.loaded / ev.total) * 100)),
  }), 'Gagal mengunggah denah. Periksa koneksi lalu coba lagi.');
}

export const hapusDenah = () => panggil(() => api.delete('/masterplan/denah'), 'Gagal menghapus denah');

// Master ruangan yang sudah ada (/rooms) -> sumber nama ruang penanda.
export async function ambilDaftarRuang() {
  const data = await panggil(() => api.get('/rooms'), 'Gagal memuat master ruangan');
  return (data || []).map((r) => ({ id: r.id, name: r.name, description: r.description }));
}

export const tambahPenanda = (isi) => panggil(() => api.post('/masterplan/markers', isi), 'Gagal menambahkan penanda');
export const ubahPenanda = (id, isi) => panggil(() => api.put(`/masterplan/markers/${id}`, isi), 'Gagal mengubah penanda');
export const hapusPenanda = (id) => panggil(() => api.delete(`/masterplan/markers/${id}`), 'Gagal menghapus penanda');

// Rincian ruang dari master ruangan + jumlah aset sarpras (/sarpras/ruangan-aset/{id}).
export async function ambilDetailRuang(roomId) {
  const data = await panggil(() => api.get(`/sarpras/ruangan-aset/${roomId}`), 'Data ruang tidak ditemukan');
  return {
    room: data.room,
    jumlah_aset_tetap: (data.aset_tetap || []).length,
    jumlah_aset_lancar: (data.aset_lancar || []).length,
  };
}
