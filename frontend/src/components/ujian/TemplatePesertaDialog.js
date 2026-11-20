import React, { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { pesanGalat } from '@/lib/ujian';
import { labelJenjang } from '@/lib/ujianRuang';
import {
  KOLOM_TEMPLATE_PESERTA, barisTemplate, namaBerkasTemplate, simpanBerkas, unduhTemplatePeserta,
} from '@/lib/ujianPeserta';

const PRATINJAU_MAKS = 8;

/**
 * Pratinjau & unduh template nomor peserta (.xlsx) SATU ruang. Template hanya memuat siswa yang sudah dibagi ke
 * ruang itu (nama, kelas, jenjang, nomor peserta yang ada, dan Nomor Peserta UM dari data siswa sebagai acuan).
 * `sasaran` = { ujian, ruang, peserta } atau null.
 */
export default function TemplatePesertaDialog({ sasaran, onTutup }) {
  const [mengunduh, setMengunduh] = useState(false);
  const peserta = sasaran?.peserta || [];
  const baris = barisTemplate(peserta);
  const kosong = peserta.filter((p) => !p.nomor_peserta).length;

  const unduh = async () => {
    setMengunduh(true);
    try {
      const h = await unduhTemplatePeserta(sasaran.ujian, sasaran.ruang, peserta);
      simpanBerkas(h.blob, h.nama);
      toast.success(`Template Ruang ${sasaran.ruang.nama_ruang} diunduh${h.tiruan ? ' (dibuat dari data contoh)' : ''}`);
    } catch (e) {
      toast.error(pesanGalat(e, 'Gagal mengunduh template.'));
    } finally {
      setMengunduh(false);
    }
  };

  return (
    <Dialog open={!!sasaran} onOpenChange={(o) => { if (!o && !mengunduh) onTutup?.(); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl" data-testid="dialog-template-peserta">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-[#006837]" /> Template Peserta Ruang {sasaran?.ruang?.nama_ruang}</DialogTitle>
          <DialogDescription>
            Berisi {peserta.length} siswa yang sudah dibagi ke ruang ini ({labelJenjang(sasaran?.ruang?.jenjang)}). Isi kolom
            "No. Peserta", lalu impor kembali berkas yang sama untuk ruang ini.
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 p-2"><dt className="text-slate-500">Nama berkas</dt><dd className="truncate font-mono" title={namaBerkasTemplate(sasaran?.ujian, sasaran?.ruang)}>{namaBerkasTemplate(sasaran?.ujian, sasaran?.ruang)}</dd></div>
          <div className="rounded-lg border border-slate-200 p-2"><dt className="text-slate-500">Baris peserta</dt><dd className="font-semibold">{peserta.length}</dd></div>
          <div className="rounded-lg border border-slate-200 p-2"><dt className="text-slate-500">Nomor masih kosong</dt><dd className={`font-semibold ${kosong ? 'text-amber-700' : ''}`}>{kosong}</dd></div>
        </dl>

        {peserta.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
            Ruang ini belum berisi peserta. Tempatkan siswa terlebih dahulu agar template terisi.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-xs" data-testid="pratinjau-template-peserta">
              <thead className="bg-emerald-50 text-left text-[11px] uppercase tracking-wide text-emerald-900">
                <tr>{KOLOM_TEMPLATE_PESERTA.map((k) => <th key={k} className="whitespace-nowrap px-2 py-1.5 font-semibold">{k}</th>)}</tr>
              </thead>
              <tbody>
                {baris.slice(0, PRATINJAU_MAKS).map((b) => (
                  <tr key={b[1]} className="border-t border-slate-100">
                    {b.map((sel, i) => (
                      <td key={KOLOM_TEMPLATE_PESERTA[i]} className={`whitespace-nowrap px-2 py-1 ${i === 7 ? 'bg-amber-50 font-mono' : ''} ${i === 1 ? 'font-mono text-slate-400' : ''}`}>
                        {sel === '' ? <span className="text-slate-300">—</span> : String(sel)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {baris.length > PRATINJAU_MAKS && (
              <p className="border-t border-slate-100 px-2 py-1.5 text-xs text-slate-500">… dan {baris.length - PRATINJAU_MAKS} baris lainnya.</p>
            )}
          </div>
        )}
        <p className="text-xs text-slate-500">Kolom berlatar kuning (No. Peserta) adalah yang diisi. Kolom ID Siswa dipakai mencocokkan baris saat impor — jangan diubah.</p>

        <DialogFooter>
          <Button variant="outline" onClick={onTutup} disabled={mengunduh}>Tutup</Button>
          <Button onClick={unduh} disabled={mengunduh || peserta.length === 0} className="gap-2 bg-[#006837] hover:bg-[#00552d]" data-testid="btn-unduh-template-peserta">
            {mengunduh ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Unduh .xlsx
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
