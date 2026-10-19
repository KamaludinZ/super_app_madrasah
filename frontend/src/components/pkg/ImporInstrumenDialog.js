import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { FileSpreadsheet, Upload, Loader2, ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatUkuran } from '@/lib/pkgTemplate';
import { BATAS_UKURAN_UNGGAH, pratinjauImpor, ringkasInstrumen, terapkanImpor } from '@/lib/pkgInstrumen';

// Impor instrumen PKG (khusus kepala madrasah): pilih sumber (template resmi di server atau unggah .xlsx),
// tinjau hasil pembacaan, lalu terapkan sebagai instrumen aktif. Penilaian lama tetap memakai instrumen lamanya.
export default function ImporInstrumenDialog({ open, onClose, onTerapkan }) {
  const [sumber, setSumber] = useState('template');
  const [berkas, setBerkas] = useState(null);
  const [pratinjau, setPratinjau] = useState(null);
  const [memproses, setMemproses] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setSumber('template');
      setBerkas(null);
      setPratinjau(null);
    }
  }, [open]);

  const pilihBerkas = (e) => {
    const f = e.target.files?.[0] || null;
    e.target.value = '';
    if (f && f.size > BATAS_UKURAN_UNGGAH) {
      toast.error('Ukuran berkas melebihi 10 MB.');
      return;
    }
    setBerkas(f);
    setPratinjau(null);
  };

  const baca = async () => {
    setMemproses(true);
    try {
      setPratinjau(await pratinjauImpor({ sumber, berkas }));
    } catch (e) {
      toast.error(e.message || 'Gagal membaca instrumen');
    } finally {
      setMemproses(false);
    }
  };

  const terapkan = async () => {
    setMemproses(true);
    try {
      const instrumen = await terapkanImpor(pratinjau.token);
      toast.success('Instrumen PKG diterapkan');
      onTerapkan?.(instrumen);
    } catch (e) {
      toast.error(e.message || 'Gagal menerapkan instrumen');
    } finally {
      setMemproses(false);
    }
  };

  const r = pratinjau ? ringkasInstrumen(pratinjau) : null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !memproses) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" data-testid="pkg-impor-instrumen">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-[#006837]" /> Impor Instrumen PKG</DialogTitle>
          <DialogDescription className="text-left">
            Kompetensi, indikator, dan bobot dibaca dari berkas Excel instrumen. Penilaian yang sudah berjalan tetap memakai instrumen lamanya.
          </DialogDescription>
        </DialogHeader>

        {!pratinjau ? (
          <div className="space-y-4">
            <RadioGroup value={sumber} onValueChange={(v) => { setSumber(v); setPratinjau(null); }} className="space-y-2">
              <Label htmlFor="sumber-template" className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 cursor-pointer has-[[data-state=checked]]:border-[#006837] has-[[data-state=checked]]:bg-emerald-50/50">
                <RadioGroupItem value="template" id="sumber-template" className="mt-0.5" />
                <span>
                  <span className="block text-sm font-semibold text-slate-900">Template resmi di server (disarankan)</span>
                  <span className="block text-xs font-normal text-slate-500">pkg_template_v2026.xlsx — checksum diverifikasi</span>
                </span>
              </Label>
              <Label htmlFor="sumber-unggah" className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 cursor-pointer has-[[data-state=checked]]:border-[#006837] has-[[data-state=checked]]:bg-emerald-50/50">
                <RadioGroupItem value="unggah" id="sumber-unggah" className="mt-0.5" />
                <span>
                  <span className="block text-sm font-semibold text-slate-900">Unggah berkas .xlsx</span>
                  <span className="block text-xs font-normal text-slate-500">Struktur sama dengan template resmi, maks 10 MB</span>
                </span>
              </Label>
            </RadioGroup>

            {sumber === 'unggah' && (
              <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center">
                <input ref={inputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={pilihBerkas} data-testid="pkg-impor-berkas" />
                <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => inputRef.current?.click()}>
                  <Upload className="h-4 w-4" /> Pilih berkas
                </Button>
                <p className="mt-2 text-xs text-slate-500">{berkas ? `${berkas.name} · ${formatUkuran(berkas.size)}` : 'Belum ada berkas dipilih'}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3" data-testid="pkg-impor-pratinjau">
            <div className={`flex gap-2 rounded-lg border p-3 text-sm ${pratinjau.cocok_resmi ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
              {pratinjau.cocok_resmi ? <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" /> : <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />}
              <span>{pratinjau.nama_berkas} · versi {pratinjau.versi_template} · {pratinjau.cocok_resmi ? 'checksum cocok dengan template resmi' : 'bukan salinan identik template resmi'}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[['Kompetensi', r.kompetensi], ['Sub-kompetensi', r.sub], ['Indikator', r.indikator]].map(([label, n]) => (
                <div key={label} className="rounded-lg border border-slate-200 py-2">
                  <div className="text-lg font-bold tabular-nums text-slate-900">{n}</div>
                  <div className="text-[11px] text-slate-500">{label}</div>
                </div>
              ))}
            </div>
            <ul className="space-y-1 text-sm text-slate-700">
              {pratinjau.kompetensi.map((k) => (
                <li key={k.kode} className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> {k.kode}. {k.nama} <span className="text-xs text-slate-400">({k.sub.length} sub)</span></li>
              ))}
            </ul>
            {pratinjau.peringatan?.map((p) => (
              <p key={p} className="flex gap-1.5 text-xs text-amber-700"><AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {p}</p>
            ))}
          </div>
        )}

        <DialogFooter className="gap-2">
          {pratinjau ? (
            <>
              <Button type="button" variant="outline" onClick={() => setPratinjau(null)} disabled={memproses}>Kembali</Button>
              <Button type="button" onClick={terapkan} disabled={memproses} className="bg-[#006837] hover:bg-[#005830]" data-testid="pkg-impor-terapkan">
                {memproses && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Terapkan instrumen
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={onClose} disabled={memproses}>Batal</Button>
              <Button type="button" onClick={baca} disabled={memproses || (sumber === 'unggah' && !berkas)} className="bg-[#006837] hover:bg-[#005830]" data-testid="pkg-impor-baca">
                {memproses && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Baca &amp; tinjau
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
