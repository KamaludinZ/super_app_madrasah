import React, { useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, Copy, Download, FileArchive, Loader2, Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { formatUkuranBerkas } from '@/lib/ujianBerkas';
import { LABEL_JENIS } from '@/lib/ujianBerkasAdmin';
import { waktuRelatif } from '@/lib/ujianMonitoringPublik';
import { salinTeks } from '@/lib/ujianTautanPublik';
import { labelJenjang } from '@/lib/mapelUjian';

/** Ringkasan isi ZIP satu jenis untuk satu jenjang dari baris status -> { ada: [baris], belum: [baris], ukuran, terakhir }. */
export function isiZip(baris, jenis) {
  const ada = (baris || []).filter((b) => b[jenis]);
  const waktu = ada.map((b) => b[jenis].updated_at).filter(Boolean).sort();
  return { ada, belum: (baris || []).filter((b) => !b[jenis]), ukuran: ada.reduce((n, b) => n + (b[jenis].ukuran_byte || 0), 0), terakhir: waktu.pop() || null };
}

/** Teks pengingat mapel yang belum mengirim (untuk disalin ke grup guru). */
export function teksBelumMengirim(jenis, jenjang, belum) {
  return `${LABEL_JENIS[jenis]} ${labelJenjang(jenjang)} yang belum dikirim (${belum.length} mapel):\n${belum.map((b, i) => `${i + 1}. ${b.nama}`).join('\n')}`;
}

/**
 * Panel bundel ZIP satu jenis berkas (kisi-kisi / kartu soal) untuk satu jenjang: isi ZIP (jumlah mapel, perkiraan
 * ukuran, update terakhir), mapel yang belum mengirim, dan tombol unduh (admin). `onUnduh(daftarNamaFile)`.
 * ZIP kartu soal (rahasia) meminta konfirmasi lebih dulu: unduhan tercatat atas nama admin.
 */
export default function PanelZipJenjang({ jenis, jenjang, baris, bolehUnduh, sibuk, mengunduh, onUnduh, children }) {
  const z = isiZip(baris, jenis);
  const total = (baris || []).length;
  const rahasia = jenis === 'kartu_soal';
  const id = `panel-zip-${jenis}-${jenjang}`;
  const [konfirmasi, setKonfirmasi] = useState(false);
  const daftar = z.ada.map((b) => b[jenis].nama_file);
  const mulai = () => (rahasia ? setKonfirmasi(true) : onUnduh(daftar));
  return (
    <Card data-testid={id}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          {rahasia ? <Lock className="h-4 w-4 text-[#006837]" /> : <FileArchive className="h-4 w-4 text-[#006837]" />}
          ZIP {LABEL_JENIS[jenis].toLowerCase()} {labelJenjang(jenjang)}
        </CardTitle>
        <p className="text-xs text-slate-500">
          {rahasia ? 'Berisi kartu soal rahasia — hanya admin yang dapat mengunduh.' : 'Semua kisi-kisi mapel jenjang ini dalam satu berkas.'}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <dl className="grid grid-cols-3 gap-2 text-center" data-testid={`${id}-ringkas`}>
          <div className="rounded-lg bg-slate-50 p-2"><dt className="text-[11px] text-slate-500">Mapel</dt>
            <dd className="text-sm font-bold tabular-nums text-slate-900" data-testid={`${id}-jumlah`}>{z.ada.length}/{total}</dd></div>
          <div className="rounded-lg bg-slate-50 p-2"><dt className="text-[11px] text-slate-500">Perkiraan ukuran</dt>
            <dd className="text-sm font-bold text-slate-900">{z.ada.length ? formatUkuranBerkas(z.ukuran) : '-'}</dd></div>
          <div className="rounded-lg bg-slate-50 p-2"><dt className="text-[11px] text-slate-500">Update terakhir</dt>
            <dd className="text-sm font-bold text-slate-900">{z.terakhir ? waktuRelatif(z.terakhir) : '-'}</dd></div>
        </dl>
        {z.belum.length > 0 ? (
          <div className="space-y-2 rounded-md bg-amber-50 px-2 py-2 text-xs text-amber-800" data-testid={`${id}-belum`}>
            <p className="flex items-start gap-1.5">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{z.ada.length ? `ZIP belum lengkap — ${z.belum.length} mapel belum mengirim. Mapel ini tidak ada di ZIP dan dicantumkan di berkas KETERANGAN.txt di dalamnya.`
                : `Belum ada ${LABEL_JENIS[jenis].toLowerCase()} yang terkirim untuk jenjang ini.`}</span>
            </p>
            <ul className="flex flex-wrap gap-1" aria-label="Mapel yang belum mengirim">
              {z.belum.map((b) => <li key={b.kode} className="rounded-full border border-amber-200 bg-white px-2 py-0.5 text-[11px]">{b.nama}</li>)}
            </ul>
            <Button type="button" size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs text-amber-900 hover:bg-amber-100" data-testid={`${id}-salin-belum`}
              onClick={async () => { if (await salinTeks(teksBelumMengirim(jenis, jenjang, z.belum))) toast.success('Daftar mapel disalin'); else toast.error('Gagal menyalin daftar'); }}>
              <Copy className="h-3.5 w-3.5" /> Salin daftar
            </Button>
          </div>
        ) : (
          <p className="flex items-center gap-1.5 text-xs text-emerald-700" data-testid={`${id}-lengkap`}><CheckCircle2 className="h-3.5 w-3.5" /> Semua {total} mapel sudah terkirim.</p>
        )}
        {children}
        <Button type="button" variant={rahasia ? 'outline' : 'default'} disabled={!bolehUnduh || !z.ada.length || sibuk}
          onClick={mulai}
          className={`w-full gap-1.5 sm:w-auto ${rahasia ? '' : 'bg-[#006837] hover:bg-[#005830]'}`} data-testid={`zip-${jenis}-${jenjang}`}>
          {mengunduh ? <Loader2 className="h-4 w-4 animate-spin" /> : rahasia ? <Lock className="h-4 w-4" /> : <Download className="h-4 w-4" />}
          Unduh ZIP {LABEL_JENIS[jenis].toLowerCase()} <span className="font-normal opacity-80">({z.ada.length} mapel)</span>
        </Button>
        {!bolehUnduh && <p className="text-[11px] text-slate-500">Unduhan hanya untuk admin.</p>}
      </CardContent>
      {rahasia && (
        <AlertDialog open={konfirmasi} onOpenChange={setKonfirmasi}>
          <AlertDialogContent data-testid={`${id}-konfirmasi`}>
            <AlertDialogHeader>
              <AlertDialogTitle>Unduh {z.ada.length} kartu soal rahasia {labelJenjang(jenjang)}?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2 text-sm text-slate-600">
                  <p>Unduhan ini <strong>tercatat atas nama Anda</strong> di jejak audit (waktu, perangkat, dan jenjang).</p>
                  <p>Simpan berkas ZIP di perangkat yang aman dan jangan dibagikan ke grup atau orang yang tidak berwenang.</p>
                  {z.belum.length > 0 && <p className="text-amber-700">{z.belum.length} mapel belum mengirim kartu soal dan tidak ikut dalam ZIP.</p>}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid={`${id}-batal`}>Batal</AlertDialogCancel>
              <AlertDialogAction onClick={() => onUnduh(daftar)} className="gap-2 bg-[#006837] hover:bg-[#005830]" data-testid={`${id}-ya`}>
                <Lock className="h-4 w-4" /> Ya, unduh
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </Card>
  );
}
