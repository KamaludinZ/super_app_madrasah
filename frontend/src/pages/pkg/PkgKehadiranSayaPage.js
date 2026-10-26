import React from 'react';
import PenjagaMenuPkg from '@/components/pkg/PenjagaMenuPkg';
import { IsiKehadiranGuru } from '@/pages/pkg/PkgKehadiranGuruPage';

// Menu Kehadiran Saya: guru yang dinilai menginput rekap kehadirannya sendiri per bulan (format INDEK-HDIR,
// lib/pkgKehadiran -> /pkg/kehadiran/saya). Datanya sama dengan yang diinput pengelola di Komponen 360° & Kehadiran.
export default function PkgKehadiranSayaPage() {
  return (
    <PenjagaMenuPkg menuKey="kehadiran_saya">
      <IsiKehadiranGuru sendiri />
    </PenjagaMenuPkg>
  );
}
