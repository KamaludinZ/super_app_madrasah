import { api, BASE_API } from '@/lib/api';
import { PERAN_GURU_GTK, PERAN_TENDIK_GTK } from '@/lib/jenisGtk';

// Login lewat tiket (SSO) ke aplikasi madrasah lain (backend/sso.py, backend/routers/sso.py).
//   GET  /sso/aplikasi-saya                -> [{ id, nama, deskripsi, url_ikon, urutan }] yang boleh dibuka pengguna
//   POST /sso/aplikasi/{id}/masuk          -> { url, berlaku_detik, aplikasi }  (tiket 60 detik, sekali pakai)
// Admin:
//   GET    /admin/sso/aplikasi             -> { aplikasi: [aplikasiAdmin], peran: [kode peran], umur_tiket_detik }
//   POST   /admin/sso/aplikasi             -> { aplikasi, kunci_rahasia }   (kunci hanya tampil sekali)
//   PUT    /admin/sso/aplikasi/{id}        -> aplikasiAdmin
//   POST   /admin/sso/aplikasi/{id}/kunci-baru -> { aplikasi, kunci_rahasia }
//   DELETE /admin/sso/aplikasi/{id}
//   GET    /admin/sso/pengguna?cari= | ?ids=a,b -> [{ id, nama, username, peran, aktif, nomor }]
// aplikasiAdmin = { id, nama, deskripsi, url_masuk, url_ikon, aktif, urutan, peran, izin_pengguna, blokir_pengguna,
//                   kunci_awal, kunci_dibuat_pada }

function pesanGalat(e, cadangan) {
  const d = e?.response?.data?.detail;
  if (typeof d === 'string') return d;
  if (d?.pesan) return d.pesan;
  if (Array.isArray(d) && d[0]?.msg) return `Isian tidak valid: ${String(d[0].msg).replace(/^Value error, /, '')}`;
  return cadangan;
}

async function panggil(fn, cadangan) {
  try {
    return (await fn()).data;
  } catch (e) {
    throw new Error(pesanGalat(e, cadangan));
  }
}

export const aplikasiSaya = () => panggil(() => api.get('/sso/aplikasi-saya'), 'Gagal memuat aplikasi terhubung.');
export const tiketMasuk = (id) => panggil(() => api.post(`/sso/aplikasi/${encodeURIComponent(id)}/masuk`), 'Gagal membuka aplikasi.');

export const daftarAplikasiAdmin = () => panggil(() => api.get('/admin/sso/aplikasi'), 'Gagal memuat aplikasi terhubung.');
export const tambahAplikasi = (data) => panggil(() => api.post('/admin/sso/aplikasi', data), 'Gagal menambah aplikasi.');
export const ubahAplikasi = (id, data) => panggil(() => api.put(`/admin/sso/aplikasi/${encodeURIComponent(id)}`, data), 'Gagal menyimpan aplikasi.');
export const kunciBaru = (id) => panggil(() => api.post(`/admin/sso/aplikasi/${encodeURIComponent(id)}/kunci-baru`), 'Gagal membuat kunci baru.');
export const hapusAplikasi = (id) => panggil(() => api.delete(`/admin/sso/aplikasi/${encodeURIComponent(id)}`), 'Gagal menghapus aplikasi.');
export const cariPengguna = (cari) => panggil(() => api.get('/admin/sso/pengguna', { params: { cari } }), 'Gagal mencari pengguna.');
export const penggunaById = (ids) => (ids.length
  ? panggil(() => api.get('/admin/sso/pengguna', { params: { ids: ids.join(',') } }), 'Gagal memuat pengguna.')
  : Promise.resolve([]));

// Alamat API tukar tiket untuk dipasang di aplikasi tujuan (SUPERAPP_SSO_URL).
export const alamatApiSso = () => {
  const dasar = BASE_API.startsWith('http') ? BASE_API : `${window.location.origin}${BASE_API}`;
  return `${dasar}/sso`;
};

// Pilihan cepat kelompok peran di form admin.
export const KELOMPOK_PERAN = [
  { kunci: 'siswa', label: 'Siswa', peran: ['siswa'] },
  { kunci: 'guru', label: 'Guru', peran: PERAN_GURU_GTK },
  { kunci: 'pegawai', label: 'Pegawai / Tendik', peran: PERAN_TENDIK_GTK },
];

// Buka aplikasi di tab baru. Tab dibuka lebih dulu (sinkron dengan klik) agar tidak diblokir browser, lalu diarahkan
// ke URL bertiket setelah tiket terbit; bila tab tidak bisa dibuka (WebView), halaman ini yang berpindah.
export async function bukaAplikasi(id) {
  const tab = window.open('', '_blank');
  try {
    const { url } = await tiketMasuk(id);
    if (tab && !tab.closed) {
      tab.opener = null;
      tab.location.replace(url);
    } else {
      window.location.assign(url);
    }
  } catch (e) {
    if (tab && !tab.closed) tab.close();
    throw e;
  }
}
