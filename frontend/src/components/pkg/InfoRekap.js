import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Info, Hourglass } from 'lucide-react';

// Keadaan kosong rekap sesuai penyebabnya; null bila ada data untuk ditampilkan.
export function RekapKosong({ rekap }) {
  if (rekap.guru.length > 0) return null;
  let judul = 'Belum ada guru yang dinilai pada periode ini';
  let keterangan = 'Rekap muncul setelah kepala madrasah menetapkan SK, membagikan guru kepada penilai, dan penilai mengisi lembar penilaian.';
  if (!rekap.periode) {
    judul = 'Belum ada periode PKG';
    keterangan = 'Kepala madrasah perlu menetapkan periode penilaian terlebih dahulu.';
  } else if (rekap.cakupan === 'pribadi') {
    judul = 'Hasil penilaian Anda belum tersedia';
    keterangan = 'Hasil tampil di sini setelah penilai mengirim dan mengunci lembar penilaian Anda.';
  } else if (rekap.cakupan === 'penilai') {
    judul = 'Belum ada guru yang Anda nilai';
    keterangan = 'Guru yang dibagikan kepada Anda dan nilainya akan tampil di sini.';
  } else if (!rekap.sk) {
    keterangan = 'Periode ini belum memiliki SK aktif. Tetapkan SK dan tim penilai di menu SK & Tim Penilai.';
  }
  return (
    <Card data-testid="pkg-rekap-kosong">
      <CardContent className="p-0">
        <EmptyState illustration="mosque" size="sm" title={judul} description={keterangan} />
      </CardContent>
    </Card>
  );
}

// Pesan informatif di atas rekap: periode masih berjalan (rekap sementara) dan lembar yang belum terkunci.
export function PesanInfoRekap({ rekap }) {
  const r = rekap.ringkasan || {};
  const belumKunci = (r.draf || 0) + (r.belum || 0);
  const pesan = [];
  if (rekap.periode?.status === 'berjalan') {
    pesan.push({ icon: Hourglass, teks: 'Periode masih berjalan; rekap ini bersifat sementara dan dapat berubah sampai seluruh lembar dikunci.' });
  }
  if (belumKunci > 0 && rekap.guru.length > 0) {
    pesan.push({ icon: Info, teks: `${belumKunci} dari ${r.total} lembar belum dikunci; nilai, statistik, dan predikat hanya dihitung dari lembar yang sudah dikunci.` });
  }
  if (!pesan.length) return null;
  return (
    <div className="space-y-1.5 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900" role="status" data-testid="pkg-rekap-info">
      {pesan.map(({ icon: Ikon, teks }) => (
        <p key={teks} className="flex gap-2"><Ikon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {teks}</p>
      ))}
    </div>
  );
}
