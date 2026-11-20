import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Pencil, RotateCcw, Save } from 'lucide-react';
import { pesanGalat } from '@/lib/ujian';
import { FIELD_TEMPLATE, muatTemplateBawaan, simpanTemplate, templateBawaan } from '@/lib/ujianFormulir';

const Logo = () => <span className="inline-block h-7 w-7 shrink-0 rounded-full border border-emerald-700/40 bg-emerald-50" aria-hidden="true" />;

/** Pratinjau kop kedua lembar (daftar hadir & berita acara) menurut isian template — bentuk ringkas dari docx. */
export function PratinjauKop({ template: t, ujian }) {
  const tp = ujian?.tahun_pelajaran || '2026/2027';
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" data-testid="pratinjau-kop">
      <figure className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <figcaption className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Daftar Hadir</figcaption>
        <div className="flex items-center gap-2">
          <Logo />
          <div className="min-w-0 flex-1 text-center leading-tight">
            <div className="text-[11px] font-bold">DAFTAR HADIR PESERTA</div>
            <div className="text-[11px] font-bold">{t.singkatan_ujian} TAHUN AJARAN {tp}</div>
            <div className="text-[10px]">{t.kop_madrasah}</div>
            <div className="truncate text-[9px] text-slate-600">{t.alamat}</div>
          </div>
          <Logo />
        </div>
        <div className="mt-2 text-right text-[9px] text-slate-600">{t.kota_ttd}, …………… · Pengawas Ruang</div>
      </figure>
      <figure className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <figcaption className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Berita Acara</figcaption>
        <div className="flex flex-col items-center text-center leading-tight" style={{ fontFamily: 'Georgia, serif' }}>
          <Logo />
          <div className="mt-1 text-[13px] font-bold">BERITA ACARA</div>
          <div className="text-[10px] font-bold uppercase">Penyelenggaraan {t.nama_kegiatan}</div>
          <div className="text-[10px] font-bold uppercase">{t.nama_madrasah}</div>
          <div className="text-[9px]">TAHUN AJARAN {tp}</div>
        </div>
        <div className="mt-2 text-[9px] text-slate-600">Pada Madrasah : {t.nama_madrasah} · Alamat : <span className="break-words">{t.alamat}</span></div>
        <div className="mt-1 text-[9px] italic text-slate-500">* {t.catatan_kaki}</div>
      </figure>
    </div>
  );
}

/**
 * Editor Template Cetak: isian kop & teks tetap lembar daftar hadir dan berita acara (mengikuti template docx
 * madrasah), dengan pratinjau langsung dan tombol kembali ke bawaan. Nomor, tanggal, ruang, mapel, dan nama terisi
 * otomatis saat cetak.
 */
export default function EditorTemplateCetak({ ujian, template, bolehUbah, onTersimpan }) {
  const [buka, setBuka] = useState(false);
  const [isi, setIsi] = useState(template || templateBawaan(ujian?.jenis));
  const [menyimpan, setMenyimpan] = useState(false);
  const t = template || templateBawaan(ujian?.jenis);

  useEffect(() => { if (buka) setIsi(t); }, [buka]); // eslint-disable-line react-hooks/exhaustive-deps

  const galat = Object.fromEntries(FIELD_TEMPLATE
    .map((f) => [f.key, !String(isi[f.key] || '').trim() ? 'Wajib diisi' : String(isi[f.key]).length > f.maks ? `Maksimal ${f.maks} karakter` : ''])
    .filter(([, p]) => p));

  const simpan = async () => {
    setMenyimpan(true);
    try {
      const bersih = Object.fromEntries(FIELD_TEMPLATE.map((f) => [f.key, String(isi[f.key]).trim()]));
      const h = await simpanTemplate(ujian.id, bersih);
      toast.success(`Template cetak disimpan${h.tiruan ? ' (contoh)' : ''}`);
      onTersimpan?.(h.formulir);
      setBuka(false);
    } catch (e) {
      toast.error(pesanGalat(e, 'Gagal menyimpan template.'));
    } finally {
      setMenyimpan(false);
    }
  };

  return (
    <div className="space-y-3" data-testid="editor-template">
      <PratinjauKop template={t} ujian={ujian} />
      {bolehUbah && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => setBuka(true)} className="gap-1" data-testid="btn-ubah-template">
            <Pencil className="h-4 w-4" /> Ubah Template
          </Button>
        </div>
      )}
      <Dialog open={buka} onOpenChange={(o) => { if (!o && !menyimpan) setBuka(false); }}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl" data-testid="dialog-template-cetak">
          <DialogHeader>
            <DialogTitle>Template Cetak</DialogTitle>
            <DialogDescription>Teks tetap pada lembar daftar hadir dan berita acara. Data ujian, ruang, mapel, dan peserta terisi otomatis saat dicetak.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {FIELD_TEMPLATE.map((f) => (
              <div key={f.key} className={`space-y-1 ${f.key === 'alamat' || f.key === 'nama_kegiatan' ? 'sm:col-span-2' : ''}`}>
                <Label htmlFor={`tpl-${f.key}`} className={galat[f.key] ? 'text-red-600' : undefined}>{f.label}</Label>
                <Input id={`tpl-${f.key}`} value={isi[f.key] || ''} maxLength={f.maks} onChange={(e) => setIsi((x) => ({ ...x, [f.key]: e.target.value }))}
                  aria-invalid={!!galat[f.key]} className={galat[f.key] ? 'border-red-500' : ''} data-testid={`input-tpl-${f.key}`} />
                <p className={`text-xs ${galat[f.key] ? 'text-red-600' : 'text-slate-500'}`}>{galat[f.key] || f.petunjuk}</p>
              </div>
            ))}
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pratinjau</p>
            <PratinjauKop template={isi} ujian={ujian} />
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="ghost" onClick={async () => setIsi(await muatTemplateBawaan(ujian?.id, ujian?.jenis))} disabled={menyimpan} className="gap-1 text-slate-600">
              <RotateCcw className="h-4 w-4" /> Kembalikan Bawaan
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setBuka(false)} disabled={menyimpan}>Batal</Button>
              <Button onClick={simpan} disabled={menyimpan || Object.keys(galat).length > 0} className="gap-2 bg-[#006837] hover:bg-[#00552d]" data-testid="btn-simpan-template">
                {menyimpan ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan Template
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
