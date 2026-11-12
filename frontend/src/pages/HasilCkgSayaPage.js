import React, { useEffect, useState } from 'react';
import { HeartPulse } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import RiwayatCkgTab from '@/pages/admin/uks/RiwayatCkgTab';
import { ambilCkgSaya } from '@/lib/ckgSaya';

// Hasil Cek Kesehatan Gratis (CKG) milik siswa / GTK yang login: data yang diinput petugas UKS maupun hasil impor
// Excel, karena keduanya tersimpan pada akun pasien (pasien_id).
export default function HasilCkgSayaPage() {
  const [tahun, setTahun] = useState('');
  const [data, setData] = useState(null);
  const [galat, setGalat] = useState(null);

  useEffect(() => {
    let hidup = true;
    setData(null);
    setGalat(null);
    ambilCkgSaya(tahun)
      .then((d) => { if (hidup) setData(d); })
      .catch((e) => { if (hidup) setGalat(e?.response?.data?.detail || 'Gagal memuat hasil CKG.'); });
    return () => { hidup = false; };
  }, [tahun]);

  return (
    <div className="space-y-4" data-testid="hasil-ckg-saya">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><HeartPulse className="h-5 w-5 text-[#006837]" /> Hasil CKG Saya</h2>
          <p className="text-xs text-slate-500">
            Hasil Cek Kesehatan Gratis dari petugas UKS madrasah
            {data?.pasien?.nama ? ` untuk ${data.pasien.nama}${data.pasien.kelas ? ` (${data.pasien.kelas})` : ''}` : ''}.
          </p>
        </div>
        {(data?.tahun_tersedia || []).length > 1 && (
          <Select value={tahun || 'semua'} onValueChange={(v) => setTahun(v === 'semua' ? '' : v)}>
            <SelectTrigger className="w-40" data-testid="filter-tahun-ckg-saya"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="semua">Semua tahun</SelectItem>
              {data.tahun_tersedia.map((t) => <SelectItem key={t} value={t}>Tahun {t}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>
      {galat ? (
        <Card><CardContent className="p-6 text-center text-sm text-rose-700">{galat}</CardContent></Card>
      ) : (
        <RiwayatCkgTab items={data?.items} loading={!data} pesanKosong="Belum ada hasil pemeriksaan CKG untuk akun Anda." />
      )}
    </div>
  );
}
