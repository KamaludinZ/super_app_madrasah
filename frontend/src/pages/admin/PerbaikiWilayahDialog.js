import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Save, Sparkles } from 'lucide-react';
import WilayahBertingkat from '@/components/wilayah/WilayahBertingkat';
import { teksAlamatAsli, teksRantai } from '@/lib/pencocokanWilayah';
import { TINGKAT_WILAYAH } from '@/lib/wilayah';

const KOSONG = { provinsi: null, kabupaten: null, kecamatan: null, desa: null };

/** Nilai dropdown awal dari baris: kode yang sudah cocok sebagian (bila ada) -> rantai {kode, nama}. */
function nilaiAwal(baris) {
  const s = baris?.saran?.[0];
  if (baris?.kode_wilayah && s?.kode?.startsWith(baris.kode_wilayah)) {
    const n = baris.kode_wilayah.split('.').length;
    const r = { ...KOSONG };
    TINGKAT_WILAYAH.slice(0, n).forEach((t) => { r[t.key] = s.rantai?.[t.key] || null; });
    return r;
  }
  return { ...KOSONG };
}

/**
 * Dialog perbaikan manual satu baris pencocokan: pilih salah satu saran atau tentukan sendiri
 * wilayahnya lewat dropdown bertingkat (provinsi -> desa/kelurahan). `onSimpan(baris, {kode_wilayah, kode_pos, rantai})`.
 */
export default function PerbaikiWilayahDialog({ baris, onTutup, onSimpan }) {
  const [nilai, setNilai] = useState(KOSONG);
  const [info, setInfo] = useState({ kode_wilayah: '', kode_pos: '' });
  const [menyimpan, setMenyimpan] = useState(false);

  useEffect(() => {
    if (!baris) return;
    setNilai(nilaiAwal(baris));
    setInfo({ kode_wilayah: baris.kode_wilayah || '', kode_pos: '' });
  }, [baris]);

  const pakaiSaran = (s) => {
    setNilai({ ...KOSONG, ...s.rantai });
    setInfo({ kode_wilayah: s.kode, kode_pos: s.kode_pos || '' });
  };

  const sampaiDesa = !!nilai.desa;
  const simpan = async () => {
    setMenyimpan(true);
    try {
      await onSimpan(baris, { kode_wilayah: info.kode_wilayah, kode_pos: info.kode_pos ?? '', rantai: nilai });
    } finally {
      setMenyimpan(false);
    }
  };

  return (
    <Dialog open={!!baris} onOpenChange={(o) => { if (!o && !menyimpan) onTutup(); }}>
      <DialogContent className="max-w-2xl" data-testid="dialog-perbaiki-wilayah">
        <DialogHeader>
          <DialogTitle>Perbaiki Wilayah</DialogTitle>
          <DialogDescription>
            {baris?.nama} · {baris?.label_blok}
          </DialogDescription>
        </DialogHeader>
        {baris && (
          <div className="space-y-4">
            <div className="rounded-md bg-slate-50 px-3 py-2 text-sm">
              <div className="text-xs text-slate-500">Alamat asli hasil impor</div>
              <div className="text-slate-800">{teksAlamatAsli(baris.teks) || <span className="italic text-slate-400">kosong</span>}</div>
              {baris.alasan && <div className="mt-1 text-xs text-amber-700">{baris.alasan}</div>}
            </div>

            {baris.saran?.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600"><Sparkles className="h-3.5 w-3.5" /> Saran dari master wilayah</div>
                <div className="space-y-1">
                  {baris.saran.map((s) => (
                    <button key={s.kode} type="button" onClick={() => pakaiSaran(s)}
                      className={`flex w-full items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-left text-sm hover:bg-slate-50 ${info.kode_wilayah === s.kode ? 'border-[#006837] bg-[#006837]/5' : 'border-slate-200'}`}
                      data-testid={`saran-wilayah-${s.kode}`}>
                      <span className="truncate">{teksRantai(s.rantai)}</span>
                      <span className="shrink-0 text-xs text-slate-500">
                        {s.kode_pos && <span className="font-mono">{s.kode_pos} · </span>}{Math.round((s.skor || 0) * 100)}%
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <div className="text-xs font-medium text-slate-600">Atau pilih wilayah secara manual</div>
              <WilayahBertingkat
                value={nilai}
                onChange={(v, i) => { setNilai(v); setInfo((lama) => ({ kode_wilayah: i.kode_wilayah, kode_pos: i.kode_pos ?? lama.kode_pos })); }}
                testidPrefix="perbaiki-wil"
                ringkasan={teksRantai(nilai)}
              />
            </div>
            {info.kode_wilayah && !sampaiDesa && (
              <p className="text-xs text-amber-700">Wilayah belum sampai desa/kelurahan — tetap bisa disimpan, tetapi sebaiknya dipilih sampai desa.</p>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onTutup} disabled={menyimpan}>Batal</Button>
          <Button onClick={simpan} disabled={menyimpan || !info.kode_wilayah} className="gap-2 bg-[#006837] hover:bg-[#005830]" data-testid="btn-simpan-perbaikan-wilayah">
            {menyimpan ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan Wilayah
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
