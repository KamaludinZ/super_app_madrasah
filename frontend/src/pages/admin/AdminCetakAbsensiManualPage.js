import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Printer } from 'lucide-react';

export default function AdminCetakAbsensiManualPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Cetak Format Absensi Siswa Manual</h1>
        <p className="text-sm text-slate-600 mt-1">
          Halaman ini disiapkan untuk kebutuhan cetak format absensi manual siswa.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Printer className="h-4 w-4 text-[#006837]" />
            Ringkasan
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-700">
          Menu cetak format absensi manual sudah tersedia di sidebar admin. Fitur template, filter kelas,
          dan export/print lanjutan dapat ditambahkan pada iterasi berikutnya.
        </CardContent>
      </Card>
    </div>
  );
}
