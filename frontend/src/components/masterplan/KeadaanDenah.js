import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ImageOff, WifiOff, RotateCcw, Upload } from 'lucide-react';

// Keadaan khusus halaman Masterplan: data gagal dimuat, atau denah belum diunggah.
export default function KeadaanDenah({ jenis, bolehKelola = false, onCobaLagi, onUnggah, sibuk = false }) {
  const gagal = jenis === 'gagal';
  const Ikon = gagal ? WifiOff : ImageOff;
  return (
    <Card data-testid={`masterplan-${jenis}`}>
      <CardContent className="p-10 text-center">
        <Ikon className="mx-auto mb-3 h-10 w-10 text-slate-300" />
        <p className="font-semibold text-slate-700">{gagal ? 'Denah gagal dimuat' : 'Denah belum diunggah'}</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
          {gagal
            ? 'Periksa koneksi internet Anda, lalu coba lagi.'
            : bolehKelola
              ? 'Unggah gambar denah sekolah agar warga madrasah dapat melihat tata ruangnya.'
              : 'Admin belum mengunggah gambar denah sekolah. Silakan cek kembali nanti.'}
        </p>
        {gagal && onCobaLagi && (
          <Button variant="outline" size="sm" className="mt-4" onClick={onCobaLagi} data-testid="masterplan-coba-lagi">
            <RotateCcw className="mr-2 h-4 w-4" /> Coba lagi
          </Button>
        )}
        {!gagal && bolehKelola && onUnggah && (
          <Button size="sm" className="mt-4 bg-[#006837] hover:bg-[#005830]" onClick={onUnggah} disabled={sibuk} data-testid="masterplan-unggah-kosong">
            <Upload className="mr-2 h-4 w-4" /> Unggah denah
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
