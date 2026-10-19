import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, ShieldCheck, ShieldAlert, FileX2, Loader2, Copy, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { formatWIBPanjang } from '@/lib/datetime';
import { ambilInfoTemplate, formatUkuran } from '@/lib/pkgTemplate';

const STATUS = {
  cocok: { label: 'Checksum cocok', kelas: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: ShieldCheck },
  berbeda: { label: 'Checksum berbeda', kelas: 'bg-rose-100 text-rose-700 border-rose-200', icon: ShieldAlert },
  hilang: { label: 'Berkas tidak ditemukan', kelas: 'bg-rose-100 text-rose-700 border-rose-200', icon: FileX2 },
};

const ringkasChecksum = (c) => (c ? `${c.slice(0, 12)}…${c.slice(-8)}` : '-');

function salin(teks) {
  navigator.clipboard?.writeText(teks).then(() => toast.success('Checksum disalin'), () => toast.error('Gagal menyalin'));
}

// Info versi template resmi PKG: berkas instrumen & rekap yang dipakai cetak, versinya, dan verifikasi checksum.
// Data sementara dari lib/pkgTemplate (tiruan).
export default function PkgTemplatePage() {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    ambilInfoTemplate().then(setInfo).catch(() => toast.error('Gagal memuat info template'));
  }, []);

  if (!info) return <div className="p-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#006837]" /></div>;

  const semuaCocok = info.berkas.every((b) => b.status === 'cocok');

  return (
    <div className="space-y-4" data-testid="pkg-template">
      <div className={`flex gap-2 rounded-lg border p-3 text-sm ${semuaCocok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`} data-testid="pkg-template-status">
        {semuaCocok ? <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" /> : <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />}
        <span>
          {semuaCocok
            ? `Semua berkas template resmi versi ${info.versi_template} tersedia dan utuh.`
            : 'Ada berkas template yang hilang atau berubah. Cetak dokumen resmi dapat tidak sesuai; hubungi admin sistem.'}
          <span className="block text-xs opacity-80">Diperiksa {formatWIBPanjang(info.diperiksa_pada)}</span>
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {info.berkas.map((b) => {
          const st = STATUS[b.status] || STATUS.berbeda;
          return (
            <Card key={b.jenis} data-testid={`pkg-template-${b.jenis}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base flex items-center gap-2"><FileSpreadsheet className="h-4 w-4 text-[#006837]" /> {b.judul}</CardTitle>
                  <Badge className={`${st.kelas} shrink-0 gap-1`}><st.icon className="h-3 w-3" /> {st.label}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between gap-4"><span className="text-slate-500">Nama berkas</span><span className="font-mono text-xs text-slate-800 break-all text-right">{b.nama_berkas}</span></div>
                <div className="flex justify-between gap-4"><span className="text-slate-500">Versi</span><span className="inline-flex items-center gap-1 text-slate-800"><Tag className="h-3 w-3" /> {b.versi}</span></div>
                <div className="flex justify-between gap-4"><span className="text-slate-500">Ukuran</span><span className="tabular-nums text-slate-800">{formatUkuran(b.ukuran)}</span></div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-500">SHA-256</span>
                  <span className="flex items-center gap-1">
                    <span className="font-mono text-xs text-slate-800" title={b.checksum || ''}>{ringkasChecksum(b.checksum)}</span>
                    {b.checksum && (
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => salin(b.checksum)} aria-label="Salin checksum"><Copy className="h-3 w-3" /></Button>
                    )}
                  </span>
                </div>
                {b.status === 'berbeda' && (
                  <div className="flex justify-between gap-4"><span className="text-slate-500">Checksum resmi</span><span className="font-mono text-xs text-rose-700" title={b.checksum_resmi}>{ringkasChecksum(b.checksum_resmi)}</span></div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-slate-500">
        Berkas template hanya dibaca dari folder internal aplikasi dan tidak pernah ditimpa; hasil cetak ditulis ke salinan sementara.
      </p>
    </div>
  );
}
