import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { bolehBukaInputTatib, halamanPoinTatib } from '@/lib/aksesTatib';

/**
 * Penjaga halaman tata tertib: peran yang tidak memenuhi `izin(activeRole)` dialihkan ke halaman poin
 * sesuai aksesnya (wali kelas -> Pantauan Walikelas, siswa -> Poin Saya, peran lain -> dashboard)
 * tanpa merender halaman (sehingga data tidak dimuat). Bawaan: peran input & lihat tatib.
 */
export default function PenjagaTatib({ izin = bolehBukaInputTatib, children }) {
  const { activeRole } = useAuth();
  if (!izin(activeRole)) return <Navigate to={halamanPoinTatib(activeRole)} replace />;
  return children;
}
