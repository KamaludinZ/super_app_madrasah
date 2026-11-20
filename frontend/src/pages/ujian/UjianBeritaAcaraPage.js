import React, { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ArrowLeft, CheckCircle2, CircleDashed, FileSignature, Loader2, Printer, RefreshCw } from 'lucide-react';
import AksesDitolak from '@/components/security/AksesDitolak';
import PilihUjian from '@/components/ujian/PilihUjian';
import { labelSesi } from '@/components/ujian/PanelCetakDokumen';
import { formatWIB } from '@/lib/datetime';
import { HALAMAN_BERANDA_UJIAN, aksesDitolak, pesanGalat } from '@/lib/ujian';
import { muatBeritaAcara } from '@/lib/ujianBeritaAcara';
import { HALAMAN_CETAK } from '@/lib/ujianCetak';

/**
 * Berita Acara (/ujian/berita-acara?ujian=<id>): pantauan berita acara pengawas per sesi per ruang — sudah/belum diisi,
 * pengawas, jumlah hadir & tidak hadir (dari daftar hadir), catatan — serta tautan ke Cetak & Arsip.
 */
export default function UjianBeritaAcaraPage() {
  const [ujian, setUjian] = useState(null);
  const [data, setData] = useState(null);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState('');
  const [ditolak, setDitolak] = useState('');

  const muat = useCallback(async (u) => {
    if (!u) { setData(null); return; }
    setMemuat(true);
    try {
      setData(await muatBeritaAcara(u.id));
      setGalat(''); setDitolak('');
    } catch (e) {
      if (aksesDitolak(e)) setDitolak(pesanGalat(e, 'Akses ditolak.'));
      else setGalat(pesanGalat(e, 'Gagal memuat berita acara.'));
    } finally {
      setMemuat(false);
    }
  }, []);
  const gantiUjian = useCallback((u) => { setUjian(u); muat(u); }, [muat]);

  return (
    <div className="space-y-6" data-testid="ujian-berita-acara">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link to={HALAMAN_BERANDA_UJIAN} className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-[#006837] hover:underline"><ArrowLeft className="h-3.5 w-3.5" /> Beranda Ujian</Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2"><FileSignature className="h-7 w-7 text-[#006837]" /> Berita Acara</h1>
          <p className="text-sm text-slate-600 mt-1">Berita acara pengawas per sesi dan ruang. Jumlah hadir & tidak hadir diambil otomatis dari daftar hadir.</p>
        </div>
        <div className="flex flex-wrap gap-2 self-start sm:self-auto">
          <Button asChild variant="outline" className="gap-2"><Link to={`${HALAMAN_CETAK}${ujian ? `?ujian=${ujian.id}` : ''}`}><Printer className="h-4 w-4" /> Cetak</Link></Button>
          <Button variant="outline" onClick={() => muat(ujian)} disabled={memuat || !ujian} className="gap-2">
            {memuat ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Muat Ulang
          </Button>
        </div>
      </div>
      <PilihUjian onUbah={gantiUjian} />
      {ditolak && <AksesDitolak halaman="Berita Acara" untuk="admin, pimpinan, dan panitia ujian ini" pesan={ditolak} />}
      {data?.tiruan && <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">Server belum menyediakan data berita acara — menampilkan data contoh.</p>}
      {galat && <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800" role="alert"><AlertTriangle className="h-4 w-4" /> {galat}</div>}
      {!ditolak && data && (data.items.length === 0
        ? <Card><CardContent className="p-6 text-center text-sm text-slate-500">Belum ada jadwal sesi. Atur jadwal di Pengaturan Formulir.</CardContent></Card>
        : data.items.map((g) => (
          <Card key={g.sesi.id} data-testid={`ba-sesi-${g.sesi.id}`}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
              <CardTitle className="text-base">{labelSesi(g.sesi)}</CardTitle>
              <Badge className={g.terisi === g.total ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-amber-100 text-amber-800 border-amber-200'}>{g.terisi}/{g.total} ruang</Badge>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-slate-100">
                {g.ruang.map((r) => (
                  <li key={r.ruang_id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start">
                    <div className="flex w-40 shrink-0 items-center gap-2 text-sm font-semibold text-slate-900">
                      {r.berita_acara ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <CircleDashed className="h-4 w-4 text-slate-300" />}
                      Ruang {r.nama_ruang} <span className="font-normal text-slate-500">· {r.jenjang.join('+')}</span>
                    </div>
                    {r.berita_acara ? (
                      <div className="min-w-0 flex-1 text-sm text-slate-700">
                        <div>{r.berita_acara.pengawas_nama} · {formatWIB(r.berita_acara.waktu_kirim, 'Time', { hour: '2-digit', minute: '2-digit' })} WIB · {r.berita_acara.jumlah_hadir} hadir, {r.berita_acara.jumlah_izin} tidak hadir</div>
                        {r.berita_acara.catatan && <div className="text-xs italic text-slate-500">“{r.berita_acara.catatan}”</div>}
                      </div>
                    ) : (
                      <div className="text-sm text-slate-500">Belum diisi{r.dh_lengkap ? ' — daftar hadir sudah lengkap' : ' — menunggu daftar hadir lengkap'}</div>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )))}
      {!data && memuat && <div className="p-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#006837]" /></div>}
    </div>
  );
}
