// Hak akses Masterplan / Denah Sekolah per peran aktif.
// Admin: unggah/ganti/hapus denah & kelola penanda ruang. Peran lain: hanya melihat (read-only).
export const PERAN_KELOLA_MASTERPLAN = ['admin'];

export const bolehKelolaMasterplan = (activeRole) => PERAN_KELOLA_MASTERPLAN.includes(activeRole);
