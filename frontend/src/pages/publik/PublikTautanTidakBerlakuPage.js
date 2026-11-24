import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import KerangkaPublik from '@/components/ujian/publik/KerangkaPublik';
import TautanTidakBerlaku from '@/components/ujian/publik/info/TautanTidakBerlaku';

// Judul & kontak menurut jalur yang dicoba dibuka.
function konteks(path) {
  if (path.startsWith('/publik/monitoring-ujian')) return { judul: 'Monitoring Pengumpulan Soal', kontak: 'panitia ujian atau admin madrasah' };
  if (path.startsWith('/publik/portal-ujian')) return { judul: 'Portal Ujian', kontak: 'pengawas ruang atau panitia ujian' };
  if (path.startsWith('/publik/info-ujian')) return { judul: 'Informasi Ujian', kontak: 'wali kelas atau panitia ujian' };
  return { judul: 'Tautan Publik Madrasah', kontak: 'pengirim tautan atau panitia ujian' };
}

/**
 * Jalur publik (/publik/…) yang tidak lengkap atau tidak dikenal — mis. tautan terpotong tanpa token. Ditampilkan sebagai
 * "tautan tidak berlaku" di kerangka publik (tanpa login), bukan halaman 404 aplikasi yang mengarah ke login.
 */
export default function PublikTautanTidakBerlakuPage() {
  const { pathname } = useLocation();
  const { judul, kontak } = konteks(pathname);
  useEffect(() => { document.title = `Tautan tidak berlaku · ${judul}`; }, [judul]);
  return (
    <KerangkaPublik judul={judul}>
      <TautanTidakBerlaku galat={{ alasan: 'tidak_lengkap' }} kontak={kontak} />
    </KerangkaPublik>
  );
}
