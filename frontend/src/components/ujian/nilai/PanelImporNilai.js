import React, { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { AlertTriangle, FileUp, Loader2, Upload } from 'lucide-react';
import { imporNilai, pesanGalatUnggah, validasiBerkasNilai } from '@/lib/ujianNilai';

/**
 * Panel Impor Massal Nilai: unggah SATU berkas template berisi beberapa sheet kelas sekaligus untuk mapel & jenjang
 * terpilih. Baris dicocokkan per sheet menurut ID siswa/NIS/nama; nilai kosong disimpan 0. Setelah diunggah, progres & hasil
 * per sheet dipantau di Monitoring Impor (`onMulai(logId, info)`). Bila server menolak unggahan, penyebabnya (beserta kode
 * HTTP) tampil di panel ini.
 */
export default function PanelImporNilai({ ujianId, mapel, jenjang, onMulai }) {
  const masukan = useRef(null);
  const [berkas, setBerkas] = useState(null);
  const [galat, setGalat] = useState('');
  const [ditolak, setDitolak] = useState('');
  const [proses, setProses] = useState(false);

  const pilih = (f) => { setBerkas(f || null); setDitolak(''); setGalat(f ? (validasiBerkasNilai(f) || '') : ''); };

  const unggah = async () => {
    setProses(true);
    setDitolak('');
    try {
      const h = await imporNilai(ujianId, { berkas, mapelId: mapel.id, mapelNama: mapel.nama, jenjang });
      toast.success(`Berkas diterima — memproses nilai ${mapel.nama} kelas ${jenjang}${h.tiruan ? ' (contoh)' : ''}`);
      onMulai?.(h.log_id, { mapel_id: mapel.id, mapel_nama: mapel.nama, jenjang, berkas: berkas.name });
      setBerkas(null);
    } catch (e) {
      setDitolak(pesanGalatUnggah(e));
    } finally {
      setProses(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4" data-testid="panel-impor-nilai">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><FileUp className="h-4 w-4 text-[#006837]" /> 2 · Impor massal</h3>
      <p className="mt-1 text-xs text-slate-600">Unggah template yang sudah diisi — semua sheet kelas diproses sekaligus untuk {mapel.nama} kelas {jenjang}. Nilai yang kosong otomatis disimpan 0.</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={() => masukan.current?.click()} disabled={proses}
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pilih(e.dataTransfer.files?.[0]); }}
          className="flex min-h-[3rem] flex-1 items-center gap-2 rounded-lg border-2 border-dashed border-slate-300 px-3 text-left text-sm text-slate-600 hover:border-[#006837]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006837]"
          data-testid="zona-impor-nilai">
          <FileUp className="h-5 w-5 shrink-0 text-[#006837]" />
          <span className="truncate">{berkas ? berkas.name : 'Pilih atau seret berkas .xlsx'}</span>
        </button>
        <input ref={masukan} type="file" accept=".xlsx" className="hidden" onChange={(e) => { pilih(e.target.files?.[0]); e.target.value = ''; }} data-testid="input-impor-nilai" />
        <Button onClick={unggah} disabled={proses || !berkas || !!galat} className="h-12 shrink-0 gap-2 bg-[#006837] hover:bg-[#00552d] sm:h-auto" data-testid="btn-impor-nilai">
          {proses ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Impor
        </Button>
      </div>
      {galat && <p className="mt-2 text-xs text-rose-700" role="alert">{galat}</p>}
      {ditolak && (
        <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-900" role="alert" data-testid="galat-unggah-nilai">
          <p className="flex items-center gap-1.5 font-semibold text-rose-800"><AlertTriangle className="h-3.5 w-3.5" /> Unggahan tidak diterima server</p>
          <p className="mt-1">{ditolak}</p>
          <p className="mt-1 text-rose-700">Belum ada nilai yang diproses dari berkas ini. Perbaiki penyebab di atas lalu klik Impor lagi.</p>
        </div>
      )}
    </section>
  );
}
