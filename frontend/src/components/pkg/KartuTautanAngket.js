import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Copy, ExternalLink, Link2, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { confirmDialog } from '@/components/ui/confirm-dialog';
import { formatWIBPanjang } from '@/lib/datetime';
import { ambilTautanAngket, aturStatusTautanAngket, gantiTautanAngket, urlAngketPublik } from '@/lib/pkgAngket';

// Salin ke papan klip dengan cadangan textarea + execCommand (WebView/HTTP sering menolak navigator.clipboard).
async function salin(teks) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(teks);
      return true;
    }
  } catch {
    // lanjut ke cadangan
  }
  const el = document.createElement('textarea');
  el.value = teks;
  el.setAttribute('readonly', '');
  el.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
  document.body.appendChild(el);
  el.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  el.remove();
  return ok;
}

function StatusTautan({ t }) {
  if (t.terbuka) return <Badge className="border-emerald-200 bg-emerald-100 text-emerald-800">Dibuka</Badge>;
  if (!t.aktif) return <Badge variant="outline" className="border-slate-300 text-slate-600">Ditutup</Badge>;
  return <Badge className="border-amber-200 bg-amber-100 text-amber-800">Periode tidak berjalan</Badge>;
}

// Tab Angket 360°: satu tautan publik per periode untuk diisi responden tanpa login (sejawat, peserta didik,
// orang tua/wali). Semua pengelola dapat menyalin; kepala madrasah dapat membuka/menutup pengisian dan mengganti tautan.
export default function KartuTautanAngket({ periodeId }) {
  const [t, setT] = useState(null);
  const [sedang, setSedang] = useState(null); // null | 'status' | 'ganti'

  useEffect(() => {
    if (!periodeId) return;
    ambilTautanAngket(periodeId).then(setT).catch((e) => { toast.error(e.message); setT({ galat: e.message }); });
  }, [periodeId]);

  if (!t) return <Card><CardContent className="p-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-[#006837]" /></CardContent></Card>;
  if (t.galat) return null;

  const url = urlAngketPublik(t.token);
  const jalankan = async (jenis, fn, pesan) => {
    setSedang(jenis);
    try {
      setT(await fn());
      toast.success(pesan);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSedang(null);
    }
  };
  const aturStatus = (aktif) => jalankan('status', () => aturStatusTautanAngket(periodeId, aktif),
    aktif ? 'Pengisian angket online dibuka' : 'Pengisian angket online ditutup');
  const ganti = async () => {
    const ok = await confirmDialog('Tautan lama langsung tidak dapat dipakai lagi; bagikan ulang tautan baru ke responden. Jawaban yang sudah masuk tetap tersimpan.', {
      title: 'Ganti tautan angket online?', confirmText: 'Ganti tautan',
    });
    if (ok) jalankan('ganti', () => gantiTautanAngket(periodeId), 'Tautan baru dibuat');
  };

  return (
    <Card className="border-[#006837]/30" data-testid="pkg-tautan-angket">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base"><Link2 className="h-4 w-4 text-[#006837]" /> Angket Online</CardTitle>
          <StatusTautan t={t} />
        </div>
        <p className="text-xs text-slate-500">
          Satu tautan untuk semua responden tanpa login: pilih jenis angket, tulis nama, pilih guru yang dinilai, isi butir, lalu tanda tangan.
          Jawaban langsung masuk ke rekap guru di bawah (maks. 10 responden per jenis per guru).
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input readOnly value={url} onFocus={(e) => e.target.select()} aria-label="Tautan angket online"
            className={`font-mono text-xs ${t.terbuka ? '' : 'text-slate-400'}`} data-testid="pkg-tautan-angket-url" />
          <div className="flex shrink-0 gap-2">
            <Button className="gap-1 bg-[#006837] hover:bg-[#005830]" data-testid="pkg-salin-tautan-angket"
              onClick={async () => ((await salin(url)) ? toast.success('Tautan angket disalin') : toast.error('Gagal menyalin tautan'))}>
              <Copy className="h-4 w-4" /> Salin tautan
            </Button>
            <Button asChild variant="outline" className="gap-1">
              <a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /> Buka</a>
            </Button>
          </div>
        </div>

        {t.boleh_kelola ? (
          <div className="flex flex-col gap-3 rounded-lg border border-slate-200 p-3 sm:flex-row sm:items-center">
            <label className="flex flex-1 cursor-pointer items-start gap-3">
              <Switch checked={t.aktif} disabled={sedang === 'status'} onCheckedChange={aturStatus} className="mt-0.5"
                aria-label="Terima jawaban angket online" data-testid="pkg-toggle-tautan-angket" />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-slate-900">
                  {t.aktif ? 'Menerima jawaban' : 'Pengisian ditutup'}
                  {sedang === 'status' && <Loader2 className="ml-2 inline h-3.5 w-3.5 animate-spin" />}
                </span>
                <span className="block text-xs text-slate-500">
                  {t.aktif
                    ? 'Matikan bila pengisian sudah selesai; tautan menampilkan pesan "pengisian ditutup".'
                    : 'Tautan yang sudah dibagikan tetap sama dan dapat dibuka kembali kapan saja.'}
                  {!t.aktif || t.periode?.status === 'berjalan' ? '' : ' Periode tidak berjalan, jadi jawaban belum diterima.'}
                </span>
              </span>
            </label>
            <Button variant="outline" size="sm" onClick={ganti} disabled={!!sedang} className="gap-1 self-start sm:self-center" data-testid="pkg-ganti-tautan-angket">
              {sedang === 'ganti' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Ganti tautan
            </Button>
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            {t.aktif ? 'Tautan sedang menerima jawaban.' : 'Pengisian sedang ditutup.'} Membuka/menutup dan mengganti tautan dilakukan kepala madrasah.
          </p>
        )}
        {(t.status_pada || t.dibuat_pada) && (
          <p className="text-[11px] text-slate-400">
            {t.status_pada
              ? `Status terakhir diubah ${t.status_oleh_nama || '-'} · ${formatWIBPanjang(t.status_pada)}`
              : `Tautan dibuat ${t.dibuat_oleh_nama || '-'} · ${formatWIBPanjang(t.dibuat_pada)}`}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
