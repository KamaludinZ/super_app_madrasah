/**
 * Pemetaan path web → rute aplikasi (tanpa dependensi React, aman dipakai di modul notifikasi).
 * Path yang punya layar native diarahkan ke layar aplikasi; sisanya ke modul web (/web?path=…).
 */

/** Rute native untuk path web tertentu (bergantung peran), atau null. */
export function nativeRoute(path: string, role?: string | null): string | null {
  const p = path.split('?')[0];
  if (p === '/jurnal/scan') return '/scan';
  if (p === '/jurnal/riwayat') return '/(app)/(tabs)/jurnal';
  if (p === '/guru-pengganti') return '/(app)/(tabs)/pengganti';
  if (p === '/pengumuman') return '/(app)/(tabs)/pengumuman';
  if (p === '/piket/tugas' && (role === 'guru_piket' || role === 'admin')) return '/piket';
  if (p === '/piket/tugas') return '/titipan';
  // Fase 1 — Siswa (rencana docs/RENCANA_APLIKASI_NATIVE.md)
  if (p === '/siswa/tugas' && role === 'siswa') return '/siswa/tugas';
  if (p === '/siswa/materi' && role === 'siswa') return '/siswa/materi';
  if (p === '/siswa/kehadiran' && role === 'siswa') return '/siswa/kehadiran';
  if (p === '/rapor' && role === 'siswa') return '/siswa/rapor';
  if (p === '/profile/siswa' && role === 'siswa') return '/profil-siswa';
  if (p === '/profile/guru' || p === '/profile/tendik') return '/profil-gtk';
  if (p === '/siswa/clkb' && role === 'siswa') return '/siswa/clkb';
  if (p === '/siswa/pcl' && role === 'siswa') return '/siswa/pcl';
  if (p === '/verval/ajuan-saya') return '/verval';
  // Jadwal: siswa (kelasnya), wali kelas (kelas wali), guru & lainnya (jadwal mengajarnya)
  if (p === '/jadwal') return '/jadwal';
  if (p === '/jadwal/atur') return '/atur-jadwal';
  if (p === '/gtk/absensi-saya') return '/absensi-saya';
  if (p === '/my-agenda') return '/agenda';
  // Penyusun E-Kinerja (admin, kepala, KTU) mengelola RHK/rekap di web; GTK mengisi jurnal & LCKB di aplikasi.
  if (p === '/admin/gtk/profesionalitas' && !['admin', 'kepala_sekolah', 'kepala_tata_usaha'].includes(role ?? '')) return '/profesionalitas';
  if (p === '/admin/gtk/e-kinerja' && !['admin', 'kepala_sekolah', 'kepala_tata_usaha'].includes(role ?? '')) return '/ekinerja';
  if (p === '/guru/kebersihan') return '/kebersihan';
  if (p === '/guru/laporan') return '/laporan';
  if (p === '/guru/indikator-materi') return '/indikator-materi';
  if (p === '/guru/materi') return '/guru/konten?jenis=materi';
  if (p === '/guru/tugas') return '/guru/konten?jenis=tugas';
  // Admin menginput nilai semua kelas di web; guru mengampu kelasnya di aplikasi.
  if (p === '/nilai/input' && role !== 'admin') return '/nilai';
  // Admin mengelola jadwal piket di modul web; peran lain melihat saja.
  if (p === '/admin/jadwal-piket' && role !== 'admin') return '/jadwal-piket';
  // Admin, Waka Kesiswaan & wali kelas memproses/memverifikasi prestasi siswa → modul web (Fase 2).
  // Pembina & admin mengelola anggota/absensi/nilai ekskul → tetap di modul web (Fase 2).
  if (p === '/ekstrakurikuler' && role !== 'admin' && role !== 'guru_ekstrakurikuler') return '/ekskul';
  if (p === '/prestasi' && !['admin', 'wali_kelas', 'waka_kesiswaan'].includes(role ?? '')) return '/prestasi';
  // Fase 4 — pemantauan Kepala Madrasah (hanya lihat; admin tetap mengelola di modul web).
  if (role === 'kepala_sekolah') {
    const pantau: Record<string, string> = {
      '/admin/kehadiran': '/pantau/kehadiran',
      '/admin/jurnal': '/pantau/jurnal',
      '/admin/gtk/laporan-absensi': '/pantau/absensi-gtk',
      '/admin/kebersihan': '/pantau/kebersihan',
      '/admin/gtk/agenda-guru': '/pantau/agenda?jenis=guru',
      '/admin/gtk/agenda-tendik': '/pantau/agenda?jenis=tendik',
      '/admin/kegiatan-madrasah': '/pantau/agenda?jenis=madrasah',
      '/admin/siswa': '/pantau/siswa',
      '/admin/gtk': '/pantau/gtk',
      '/admin/bk/laporan': '/pantau/layanan?unit=bk',
      '/admin/uks/laporan': '/pantau/layanan?unit=uks',
      '/admin/perpus/laporan': '/pantau/layanan?unit=perpus',
      '/admin/sarpras/kerusakan': '/pantau/layanan?unit=sarpras',
      '/admin/alumni': '/pantau/alumni',
      '/admin/dana-rkam': '/pantau/rkam',
    };
    if (pantau[p]) return pantau[p];
  }
  return null;
}

export const webHref = (path: string, title?: string) =>
  `/web?path=${encodeURIComponent(path)}${title ? `&title=${encodeURIComponent(title)}` : ''}`;

/** Rute aplikasi untuk path web (native bila ada, selain itu modul web). */
export const routeForPath = (path: string, role?: string | null, title?: string) =>
  nativeRoute(path, role) ?? webHref(path, title);
