import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Save } from 'lucide-react';
import PadTandaTangan from '@/components/pkg/PadTandaTangan';
import { pesanGalat } from '@/lib/ujian';
import { TINGGI_TTD, simpanPolaTtd } from '@/lib/ujianFormulir';

// 1 mm pada pratinjau ≈ 3.78 px (96 dpi) agar terasa seperti di kertas.
const MM = 3.78;
// Sama dengan TINGGI_TTD_DH_MAKS di backend/ujian_cetak_docx.py: 32 baris daftar hadir tetap muat satu halaman.
const TINGGI_DH_MAKS = 6;

function SelTtd({ nomor, kanan, ttd, tinggi, tampil }) {
  return (
    <div className="relative border border-slate-400" style={{ height: `${tinggi * MM + 6}px` }}>
      <span className={`absolute top-0.5 text-[9px] text-slate-500 ${kanan ? 'right-1' : 'left-1'}`}>{nomor}</span>
      {tampil && ttd && (
        <img src={ttd} alt="" className={`absolute bottom-0.5 object-contain ${kanan ? 'right-1' : 'left-4'}`} style={{ height: `${tinggi * MM}px`, maxWidth: '80%' }} />
      )}
    </div>
  );
}

/**
 * Pola Tanda Tangan: tanda tangan PNG digambar di layar (komponen yang sama dengan angket 360°). Admin mengatur apakah
 * PNG tampil di lembar cetak dan tingginya; pratinjau menunjukkan kolom TTD zig-zag daftar hadir (ganjil kiri, genap
 * kanan) dan baris tanda tangan pengawas di berita acara.
 */
export default function PolaTandaTangan({ ujian, pola, bolehUbah, onTersimpan }) {
  const [isi, setIsi] = useState({ tampil_di_cetak: true, tinggi_mm: TINGGI_TTD.bawaan });
  const [ttd, setTtd] = useState(null);
  const [menyimpan, setMenyimpan] = useState(false);

  useEffect(() => {
    setIsi({ tampil_di_cetak: pola?.tampil_di_cetak ?? true, tinggi_mm: pola?.tinggi_mm ?? TINGGI_TTD.bawaan });
  }, [pola]);

  const berubah = isi.tampil_di_cetak !== (pola?.tampil_di_cetak ?? true) || Number(isi.tinggi_mm) !== (pola?.tinggi_mm ?? TINGGI_TTD.bawaan);

  const simpan = async () => {
    setMenyimpan(true);
    try {
      const h = await simpanPolaTtd(ujian.id, { tampil_di_cetak: isi.tampil_di_cetak, tinggi_mm: Number(isi.tinggi_mm) });
      toast.success(`Pola tanda tangan disimpan${h.tiruan ? ' (contoh)' : ''}`);
      onTersimpan?.(h.formulir);
    } catch (e) {
      toast.error(pesanGalat(e, 'Gagal menyimpan pola tanda tangan.'));
    } finally {
      setMenyimpan(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="pola-ttd">
      <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
        <span>
          <span className="block text-sm font-medium">Tampilkan tanda tangan di lembar cetak</span>
          <span className="block text-xs text-slate-500">Bila mati, kolom TTD dicetak kosong untuk ditandatangani basah.</span>
        </span>
        <Switch checked={isi.tampil_di_cetak} disabled={!bolehUbah || menyimpan} onCheckedChange={(v) => setIsi((x) => ({ ...x, tampil_di_cetak: v }))}
          aria-label="Tampilkan tanda tangan di lembar cetak" data-testid="switch-ttd-cetak" />
      </label>
      <div className="space-y-1.5">
        <Label htmlFor="tinggi-ttd">Tinggi tanda tangan di cetak: <span className="font-mono">{isi.tinggi_mm} mm</span></Label>
        <input id="tinggi-ttd" type="range" min={TINGGI_TTD.min} max={TINGGI_TTD.maks} step={1} value={isi.tinggi_mm}
          disabled={!bolehUbah || menyimpan || !isi.tampil_di_cetak} onChange={(e) => setIsi((x) => ({ ...x, tinggi_mm: Number(e.target.value) }))}
          className="w-full accent-[#006837]" data-testid="slider-tinggi-ttd" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Coba goreskan tanda tangan</p>
          <PadTandaTangan onUbah={setTtd} />
        </div>
        <div className="space-y-3">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Daftar hadir (kolom TTD)</p>
            <div className="grid grid-cols-2 bg-white">
              <SelTtd nomor={1} ttd={ttd} tinggi={Math.min(isi.tinggi_mm, TINGGI_DH_MAKS)} tampil={isi.tampil_di_cetak} />
              <SelTtd nomor={2} kanan ttd={ttd} tinggi={Math.min(isi.tinggi_mm, TINGGI_DH_MAKS)} tampil={isi.tampil_di_cetak} />
            </div>
            <p className="mt-1 text-[11px] text-slate-400">Di daftar hadir tinggi TTD peserta dibatasi {TINGGI_DH_MAKS} mm agar 32 baris muat satu halaman.</p>
          </div>
          <div className="rounded border border-slate-200 bg-white p-2 text-[11px]" style={{ fontFamily: 'Georgia, serif' }}>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500" style={{ fontFamily: 'inherit' }}>Berita acara</p>
            <div className="flex items-end gap-2">
              <span className="w-24">Tanda Tangan</span>:
              {isi.tampil_di_cetak && ttd
                ? <img src={ttd} alt="Pratinjau tanda tangan" style={{ height: `${isi.tinggi_mm * MM}px` }} className="object-contain" />
                : <span className="text-slate-400">..............................</span>}
            </div>
            <div className="flex gap-2"><span className="w-24">Nama</span>: Nama Pengawas</div>
          </div>
        </div>
      </div>

      {bolehUbah && (
        <div className="flex justify-end">
          <Button onClick={simpan} disabled={menyimpan || !berubah} className="gap-2 bg-[#006837] hover:bg-[#00552d]" data-testid="btn-simpan-pola-ttd">
            {menyimpan ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan Pola
          </Button>
        </div>
      )}
    </div>
  );
}
