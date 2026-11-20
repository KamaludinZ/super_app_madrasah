import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, FileUp, Loader2, Upload, XCircle } from 'lucide-react';
import { pesanGalat } from '@/lib/ujian';
import { imporNomorPeserta, validasiBerkasImpor } from '@/lib/ujianPeserta';

function Ringkasan({ hasil }) {
  return (
    <div className="space-y-3" data-testid="hasil-impor-peserta">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border border-slate-200 p-2"><div className="text-xl font-bold text-slate-800">{hasil.total}</div><div className="text-xs text-slate-500">Baris dibaca</div></div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2"><div className="text-xl font-bold text-emerald-700">{hasil.tersimpan}</div><div className="text-xs text-emerald-700">Tersimpan</div></div>
        <div className={`rounded-lg border p-2 ${hasil.dilewati.length ? 'border-amber-200 bg-amber-50' : 'border-slate-200'}`}>
          <div className={`text-xl font-bold ${hasil.dilewati.length ? 'text-amber-700' : 'text-slate-800'}`}>{hasil.dilewati.length}</div>
          <div className={`text-xs ${hasil.dilewati.length ? 'text-amber-700' : 'text-slate-500'}`}>Dilewati</div>
        </div>
      </div>
      {hasil.dilewati.length > 0 ? (
        <div className="max-h-64 overflow-y-auto rounded-lg border border-amber-200">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-amber-50 text-left text-amber-900">
              <tr><th className="px-2 py-1.5">Baris</th><th className="px-2 py-1.5">Nama</th><th className="px-2 py-1.5">Alasan dilewati</th></tr>
            </thead>
            <tbody>
              {hasil.dilewati.map((d) => (
                <tr key={`${d.baris}-${d.siswa_id}`} className="border-t border-amber-100">
                  <td className="px-2 py-1 font-mono">{d.baris}</td>
                  <td className="px-2 py-1">{d.nama}</td>
                  <td className="px-2 py-1 text-amber-800"><XCircle className="mr-1 inline h-3 w-3" />{d.alasan}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Semua baris tersimpan.</p>
      )}
    </div>
  );
}

/**
 * Impor nomor peserta dari template .xlsx SATU ruang. Validasi per baris di server (siswa di data induk, belum di ruang
 * lain, jenjang sesuai, nomor sah & tidak ganda) lalu ringkasan: tersimpan dan dilewati beserta alasannya.
 * `sasaran` = { ujianId, ruang } atau null. `onSelesai()` dipanggil setelah impor (memuat ulang data).
 */
export default function ImporPesertaDialog({ sasaran, onTutup, onSelesai }) {
  const masukan = useRef(null);
  const [berkas, setBerkas] = useState(null);
  const [galat, setGalat] = useState('');
  const [proses, setProses] = useState(false);
  const [hasil, setHasil] = useState(null);

  useEffect(() => { setBerkas(null); setGalat(''); setHasil(null); }, [sasaran]);

  const pilih = (file) => {
    setHasil(null);
    setBerkas(file || null);
    setGalat(file ? (validasiBerkasImpor(file) || '') : '');
  };

  const impor = async () => {
    setProses(true);
    try {
      const h = await imporNomorPeserta(sasaran.ujianId, sasaran.ruang.id, berkas);
      setHasil(h);
      toast.success(`Impor Ruang ${sasaran.ruang.nama_ruang}: ${h.tersimpan} tersimpan, ${h.dilewati.length} dilewati${h.tiruan ? ' (contoh)' : ''}`);
      onSelesai?.();
    } catch (e) {
      setGalat(pesanGalat(e, 'Gagal mengimpor berkas.'));
    } finally {
      setProses(false);
    }
  };

  return (
    <Dialog open={!!sasaran} onOpenChange={(o) => { if (!o && !proses) onTutup?.(); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl" data-testid="dialog-impor-peserta">
        <DialogHeader>
          <DialogTitle>Impor Nomor Peserta Ruang {sasaran?.ruang?.nama_ruang}</DialogTitle>
          <DialogDescription>Unggah template .xlsx ruang ini yang sudah diisi. Satu berkas hanya untuk satu ruang.</DialogDescription>
        </DialogHeader>

        <button type="button" onClick={() => masukan.current?.click()} disabled={proses}
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pilih(e.dataTransfer.files?.[0]); }}
          className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 p-6 text-center transition-colors hover:border-[#006837]/50 hover:bg-emerald-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006837]"
          data-testid="zona-berkas-impor">
          <FileUp className="h-8 w-8 text-[#006837]" />
          <span className="text-sm font-medium text-slate-800">{berkas ? berkas.name : 'Pilih atau seret berkas .xlsx ke sini'}</span>
          <span className="text-xs text-slate-500">{berkas ? `${Math.max(1, Math.round(berkas.size / 1024))} KB` : 'Maksimal 5 MB'}</span>
        </button>
        <input ref={masukan} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden"
          onChange={(e) => { pilih(e.target.files?.[0]); e.target.value = ''; }} data-testid="input-berkas-impor" />
        {galat && <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800" role="alert">{galat}</p>}
        {proses && <p className="flex items-center gap-2 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin" /> Memeriksa dan menyimpan tiap baris…</p>}
        {hasil && <Ringkasan hasil={hasil} />}

        <DialogFooter>
          <Button variant="outline" onClick={onTutup} disabled={proses}>{hasil ? 'Selesai' : 'Batal'}</Button>
          <Button onClick={impor} disabled={proses || !berkas || !!validasiBerkasImpor(berkas)} className="gap-2 bg-[#006837] hover:bg-[#00552d]" data-testid="btn-impor-peserta">
            {proses ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {hasil ? 'Impor Ulang' : 'Impor'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
