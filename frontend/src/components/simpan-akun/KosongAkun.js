import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { KeyRound, SearchX } from 'lucide-react';

// Keadaan kosong Simpan Akun: belum ada akun sama sekali, atau pencarian tidak menemukan hasil.
export default function KosongAkun({ jenis = 'belum-ada', kataKunci, onAturUlang, aksi }) {
  const cari = jenis === 'tidak-ditemukan';
  const Ikon = cari ? SearchX : KeyRound;
  return (
    <Card data-testid={`simpan-akun-kosong-${jenis}`}>
      <CardContent className="p-10 text-center">
        <Ikon className="mx-auto mb-3 h-10 w-10 text-slate-300" />
        <p className="font-semibold text-slate-700">{cari ? 'Akun tidak ditemukan' : 'Belum ada akun tersimpan'}</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
          {cari
            ? `Tidak ada akun yang cocok dengan "${kataKunci}". Coba kata lain atau hapus pencarian.`
            : 'Simpan akun aplikasi madrasah Anda (SIMPATIKA, EMIS, email, dll.) agar mudah dicari kapan saja.'}
        </p>
        {cari && onAturUlang && (
          <Button variant="outline" size="sm" className="mt-4" onClick={onAturUlang}>Hapus pencarian</Button>
        )}
        {!cari && aksi && <div className="mt-4">{aksi}</div>}
      </CardContent>
    </Card>
  );
}
