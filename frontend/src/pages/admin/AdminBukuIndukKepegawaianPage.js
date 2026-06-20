import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Briefcase } from 'lucide-react';

export default function AdminBukuIndukKepegawaianPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Buku Induk Kepegawaian</h1>
        <p className="text-sm text-slate-600 mt-1">
          Halaman ini disiapkan untuk pengelolaan data buku induk kepegawaian.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Briefcase className="h-4 w-4 text-[#006837]" />
            Ringkasan
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-700">
          Modul Buku Induk Kepegawaian sudah tersedia di menu. Integrasi detail data dan fitur lanjutan
          dapat dikembangkan pada iterasi berikutnya.
        </CardContent>
      </Card>
    </div>
  );
}
