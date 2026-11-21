import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, FileText, Link2, Loader2 } from 'lucide-react';
import { formatWIBPanjang } from '@/lib/datetime';
import { pesanGalat } from '@/lib/ujian';
import { simpanBerkas } from '@/lib/ujianPeserta';
import { JENIS_DOKUMEN, MODE_DOKUMEN, labelKelasArsip, modeArsip, ukuranBerkas, unduhArsip } from '@/lib/ujianCetak';

const MESIN = { libreoffice: 'LibreOffice (identik template)', reportlab: 'ReportLab (cadangan)', docx: 'Word .docx', contoh: 'Contoh' };

/** Dokumen terkait: arsip lain untuk mode, ruang, jenjang, dan sesi yang sama (pasangan DH–BA & cetakan ulang), terbaru dulu. */
export const dokumenTerkait = (arsip, semua = []) => semua
  .filter((a) => a.id !== arsip.id && modeArsip(a) === modeArsip(arsip) && a.ruang_id === arsip.ruang_id
    && (a.jenjang ?? null) === (arsip.jenjang ?? null) && a.sesi_id === arsip.sesi_id)
  .sort((a, b) => (b.waktu || '').localeCompare(a.waktu || ''));

/**
 * Detail satu arsip dokumen ujian: metadata lengkap, pratinjau PDF, unduh, dan dokumen terkait (pasangan daftar hadir
 * / berita acara serta cetakan ulang untuk ruang-jenjang-sesi yang sama). `arsip` = Arsip | null.
 */
export default function DetailArsipSheet({ arsip, semua, ujian, onTutup, onPilih }) {
  const [url, setUrl] = useState(null);
  const [memuat, setMemuat] = useState(false);

  useEffect(() => {
    setUrl(null);
    if (!arsip || arsip.format !== 'pdf') return undefined;
    let hidup = true;
    let dibuat = null;
    setMemuat(true);
    unduhArsip(arsip).then((h) => { dibuat = URL.createObjectURL(h.blob); if (hidup) setUrl(dibuat); })
      .catch(() => {}).finally(() => { if (hidup) setMemuat(false); });
    return () => { hidup = false; if (dibuat) URL.revokeObjectURL(dibuat); };
  }, [arsip]);

  const unduh = async (a) => {
    try {
      const h = await unduhArsip(a);
      simpanBerkas(h.blob, h.nama);
    } catch (e) {
      toast.error(pesanGalat(e, 'Gagal mengunduh arsip.'));
    }
  };

  const terkait = arsip ? dokumenTerkait(arsip, semua) : [];
  const baris = arsip ? [
    ['Ujian', ujian?.nama], ['Dokumen', JENIS_DOKUMEN[arsip.jenis_dokumen]?.label], ['Mode dokumen', MODE_DOKUMEN[modeArsip(arsip)].label], ['Ruang', arsip.nama_ruang], ['Kelas', labelKelasArsip(arsip).replace(/^Kelas /, '')],
    ['Sesi', arsip.sesi_label], ['Format', arsip.format?.toUpperCase()], ['Mesin cetak', MESIN[arsip.mesin] || arsip.mesin],
    ['Ukuran', ukuranBerkas(arsip.ukuran)], ['Dicetak oleh', arsip.dibuat_oleh_nama], ['Waktu', formatWIBPanjang(arsip.waktu)], ['Nama berkas', arsip.nama_berkas],
  ] : [];

  return (
    <Sheet open={!!arsip} onOpenChange={(o) => { if (!o) onTutup(); }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl" data-testid="detail-arsip">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-[#006837]" /> {JENIS_DOKUMEN[arsip?.jenis_dokumen]?.label}</SheetTitle>
          <SheetDescription>Ruang {arsip?.nama_ruang} · {arsip ? labelKelasArsip(arsip) : ''} · {arsip?.sesi_label}</SheetDescription>
        </SheetHeader>
        <dl className="mt-4 grid grid-cols-[8rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
          {baris.map(([k, v]) => (
            <React.Fragment key={k}>
              <dt className="text-slate-500">{k}</dt>
              <dd className="break-words text-slate-900">{v ?? '-'}</dd>
            </React.Fragment>
          ))}
        </dl>
        <Button onClick={() => unduh(arsip)} className="mt-4 w-full gap-2 bg-[#006837] hover:bg-[#00552d]" data-testid="btn-unduh-detail-arsip">
          <Download className="h-4 w-4" /> Unduh {arsip?.format?.toUpperCase()}
        </Button>
        {arsip?.format === 'pdf' && (
          <div className="mt-4 h-96 overflow-hidden rounded-lg border border-slate-200 bg-white">
            {memuat ? <div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-[#006837]" /></div>
              : url ? <iframe title="Pratinjau arsip" src={url} className="h-full w-full" /> : <p className="p-4 text-center text-sm text-slate-500">Pratinjau tidak tersedia.</p>}
          </div>
        )}
        <section className="mt-5" data-testid="dokumen-terkait">
          <h3 className="mb-2 flex items-center gap-1 text-sm font-semibold text-slate-900"><Link2 className="h-4 w-4 text-[#006837]" /> Dokumen terkait</h3>
          {terkait.length === 0 ? <p className="text-xs text-slate-500">Belum ada dokumen lain untuk ruang, kelas, dan sesi ini.</p> : (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {terkait.map((a) => (
                <li key={a.id}>
                  <button type="button" onClick={() => onPilih(a)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#006837]">
                    <span className="min-w-0 flex-1 truncate">{JENIS_DOKUMEN[a.jenis_dokumen]?.label}</span>
                    <Badge variant="outline" className="font-normal">{a.format?.toUpperCase()}</Badge>
                    <span className="shrink-0 text-xs text-slate-500">{formatWIBPanjang(a.waktu)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </SheetContent>
    </Sheet>
  );
}
