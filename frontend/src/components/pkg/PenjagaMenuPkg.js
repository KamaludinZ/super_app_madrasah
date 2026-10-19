import React from 'react';
import { useOutletContext } from 'react-router-dom';
import PesanTolakPkg from '@/components/pkg/PesanTolakPkg';

// Penjaga sub-halaman PKG (di dalam PkgLayout): hanya merender `children` bila menu `menuKey` boleh dibuka
// menurut akses dari server (GET /pkg/beranda/menu); selain itu tampil pesan tolak dengan alasannya.
// Endpoint backend halaman tersebut tetap memvalidasi ulang — penjaga ini hanya untuk tampilan.
export default function PenjagaMenuPkg({ menuKey, children }) {
  const { menu = [] } = useOutletContext() || {};
  const m = menu.find((x) => x.key === menuKey);
  if (!m || !m.akses) {
    return <PesanTolakPkg penolakan={{ alasan: m?.alasan || 'bukan_anggota_sk', pesan: null }} />;
  }
  return children;
}
