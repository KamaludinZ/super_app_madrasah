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
  // Fase 1 — Siswa (rencana docs/RENCANA_APLIKASI_NATIVE.md)
  if (p === '/siswa/tugas' && role === 'siswa') return '/siswa/tugas';
  return null;
}

export const webHref = (path: string, title?: string) =>
  `/web?path=${encodeURIComponent(path)}${title ? `&title=${encodeURIComponent(title)}` : ''}`;

/** Rute aplikasi untuk path web (native bila ada, selain itu modul web). */
export const routeForPath = (path: string, role?: string | null, title?: string) =>
  nativeRoute(path, role) ?? webHref(path, title);
