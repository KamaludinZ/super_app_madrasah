import React, { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Download, FileUp, Loader2, RotateCcw } from 'lucide-react';
import { pesanGalat } from '@/lib/ujian';
import { simpanBerkas } from '@/lib/ujianPeserta';
import { berkasBarisGagal, imporNilai, validasiBerkasNilai } from '@/lib/ujianNilai';

/**
 * Alur unggah ulang bagian gagal: (1) unduh daftar baris gagal sebagai acuan perbaikan, (2) perbaiki baris itu di berkas
 * template yang sama, (3) unggah ulang untuk mapel & jenjang yang sama dengan `ulang_dari` = log ini: server hanya
 * memproses baris yang dulu gagal (siswa yang sudah berhasil dilewati). `onMulai(logId)` membuka pemantauan impor baru.
 */
export default function UnggahUlangGagal({ ujianId, log, onMulai }) {
  const masukan = useRef(null);
  const [proses, setProses] = useState(false);
  if (!log?.gagal) return null;

  const unduhDaftar = async () => simpanBerkas(await berkasBarisGagal(log), `baris_gagal_${log.berkas || 'impor'}`.replace(/\.xlsx$/i, '') + '.xlsx');

  const unggah = async (file) => {
    const galat = validasiBerkasNilai(file);
    if (galat) { toast.error(galat); return; }
    setProses(true);
    try {
      const h = await imporNilai(ujianId, { berkas: file, mapelId: log.mapel_id, mapelNama: log.mapel_nama, jenjang: log.jenjang, ulangDari: log.id });
      toast.success(`Berkas perbaikan diunggah — memproses ulang ${log.mapel_nama} kelas ${log.jenjang}${h.tiruan ? ' (contoh)' : ''}`);
      onMulai?.(h.log_id);
    } catch (e) {
      toast.error(pesanGalat(e, 'Gagal mengunggah berkas perbaikan.'));
    } finally {
      setProses(false);
    }
  };

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50 p-4" data-testid="unggah-ulang-gagal">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-900"><RotateCcw className="h-4 w-4" /> Perbaiki & unggah ulang bagian gagal</h3>
      <ol className="mt-2 list-inside list-decimal space-y-1 text-xs text-amber-900">
        <li>Unduh daftar {log.gagal} baris gagal sebagai acuan.</li>
        <li>Perbaiki baris tersebut di berkas template yang sama ({log.berkas}).</li>
        <li>Unggah ulang untuk {log.mapel_nama} kelas {log.jenjang}: hanya baris yang gagal yang diproses — siswa yang sudah berhasil dilewati sehingga nilainya tidak tertimpa.</li>
      </ol>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={unduhDaftar} className="gap-1 border-amber-300 bg-white" data-testid="btn-unduh-baris-gagal">
          <Download className="h-4 w-4" /> Daftar baris gagal (.xlsx)
        </Button>
        <Button size="sm" onClick={() => masukan.current?.click()} disabled={proses} className="gap-1 bg-[#006837] hover:bg-[#00552d]" data-testid="btn-unggah-ulang">
          {proses ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />} Unggah berkas perbaikan
        </Button>
        <input ref={masukan} type="file" accept=".xlsx" className="hidden" onChange={(e) => { unggah(e.target.files?.[0]); e.target.value = ''; }} data-testid="input-unggah-ulang" />
      </div>
    </section>
  );
}
