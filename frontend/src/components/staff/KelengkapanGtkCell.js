import React from 'react';
import KelengkapanPopover, { statusBagian } from '@/components/students/KelengkapanPopover';
import { kelengkapanGtk } from '@/lib/kelengkapanGtk';

export { statusBagian };

/**
 * Sel % kelengkapan data GTK di daftar GTK. Menandai jumlah bagian yang masih kosong,
 * dan bila diklik menampilkan rincian per bagian (Data Guru, Status & Riwayat, Pendidikan,
 * Data Anak, Riwayat Pesantren, Arsip Berkas) beserta data yang belum diisi.
 */
export default function KelengkapanGtkCell({ user, linkDetail }) {
  return (
    <KelengkapanPopover
      kelengkapan={kelengkapanGtk(user)}
      nama={user.full_name}
      linkDetail={linkDetail}
      testid={`btn-kelengkapan-${user.id}`}
    />
  );
}
