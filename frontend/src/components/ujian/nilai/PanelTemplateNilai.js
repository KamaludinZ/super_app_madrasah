import React, { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { pesanGalat } from '@/lib/ujian';
import { simpanBerkas } from '@/lib/ujianPeserta';
import { KOLOM_TEMPLATE_NILAI, namaBerkasTemplateNilai, unduhTemplateNilai } from '@/lib/ujianNilai';

/**
 * Panel Unduh Template Nilai: satu berkas .xlsx per mapel per jenjang berisi SATU sheet per kelas (mis. 7A, 7B, 7C)
 * dengan nama siswa sudah terisi, sehingga tiap nilai pasti tertuju ke siswa yang benar saat diimpor.
 */
export default function PanelTemplateNilai({ ujianId, mapel, jenjang, kelas = [] }) {
  const [proses, setProses] = useState(false);
  const unduh = async () => {
    setProses(true);
    try {
      const h = await unduhTemplateNilai(ujianId, mapel, jenjang, kelas);
      simpanBerkas(h.blob, h.nama);
      toast.success(`Template ${mapel.nama} kelas ${jenjang} diunduh${h.tiruan ? ' (contoh)' : ''}`);
    } catch (e) {
      toast.error(pesanGalat(e, 'Gagal mengunduh template nilai.'));
    } finally {
      setProses(false);
    }
  };
  const siswa = kelas.reduce((a, k) => a + (k.jumlah_siswa || 0), 0);
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4" data-testid="panel-template-nilai">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><FileSpreadsheet className="h-4 w-4 text-[#006837]" /> 1 · Unduh template</h3>
          <p className="mt-1 text-xs text-slate-600">
            {kelas.length} sheet ({kelas.map((k) => k.nama).join(', ') || '—'}) · {siswa} siswa sudah terisi namanya. Kolom: {KOLOM_TEMPLATE_NILAI.join(' · ')}.
          </p>
          <p className="truncate font-mono text-[11px] text-slate-400">{namaBerkasTemplateNilai(mapel, jenjang)}</p>
        </div>
        <Button onClick={unduh} disabled={proses || !kelas.length} className="shrink-0 gap-2 bg-[#006837] hover:bg-[#00552d]" data-testid="btn-unduh-template-nilai">
          {proses ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Unduh .xlsx
        </Button>
      </div>
    </section>
  );
}
