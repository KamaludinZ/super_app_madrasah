import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Progress } from '@/components/ui/progress';
import RingkasanImpor from '@/components/students/RingkasanImpor';
import { bacaBerkasCkg, validasiBarisCkg, validasiFormatExcel } from '@/lib/ckgImpor';

/**
 * Hasil tiruan impor CKG (sebelum server mendukung format template baru): baris tanpa
 * ID pasien/NIK atau tanpa tanggal dianggap gagal. Bentuk sama dengan respons server:
 * { success, failed, total, hasil: [{ baris, nama, status, pesan, kolom }] }.
 */
export function hasilImporCkgTiruan(baris) {
  const hasil = baris.map((b) => {
    const nama = b.data.nama_lengkap || '-';
    const salah = validasiBarisCkg(b.data);
    if (salah.length) {
      return { baris: b.baris, nama, status: 'gagal', kolom: salah.map((e) => e.kolom).join(', '), pesan: salah.map((e) => e.pesan).join('; ') };
    }
    return { baris: b.baris, nama, status: 'berhasil', pesan: 'Siap disimpan (tiruan)' };
  });
  const success = hasil.filter((h) => h.status === 'berhasil').length;
  return { tiruan: true, total: hasil.length, success, failed: hasil.length - success, hasil };
}

export const TAHAP_IMPOR_CKG = {
  mengunggah: 'Mengunggah berkas...',
  memproses: 'Memeriksa & menyimpan baris di server...',
  selesai: 'Selesai',
};

const jeda = (ms) => new Promise((r) => setTimeout(r, ms));

/** Ubah hasil impor CKG ({success, failed, total, hasil}) ke bentuk panel RingkasanImpor. */
export function keRingkasan(h) {
  return {
    tiruan: !!h.tiruan,
    dibatalkan: false,
    ringkasan: { total: h.total, diproses: h.total, berhasil: h.success, tanpa_perubahan: 0, gagal: h.failed },
    hasil: h.hasil.map((x) => ({ baris: x.baris, identitas: x.nama || '-', kolom: x.kolom, status: x.status, pesan: x.pesan })),
  };
}

/**
 * Modal impor CKG hasil template: unggah berkas, cek susunan kolom baku, pratinjau baris
 * yang akan diproses, lalu proses (tiruan pada tahap ini).
 */
export default function ImportCkgDialog({ open, onOpenChange, onSelesai }) {
  const [file, setFile] = useState(null);
  const [baca, setBaca] = useState(null);
  const [galat, setGalat] = useState('');
  const [memuat, setMemuat] = useState(false);
  const [hasil, setHasil] = useState(null);
  const [seret, setSeret] = useState(false);
  const [tahap, setTahap] = useState(null); // null | 'mengunggah' | 'memproses' | 'selesai'
  const [persen, setPersen] = useState(0);
  const berjalan = tahap === 'mengunggah' || tahap === 'memproses';
  const inputRef = useRef(null);

  const reset = () => { setFile(null); setBaca(null); setGalat(''); setHasil(null); setTahap(null); setPersen(0); if (inputRef.current) inputRef.current.value = ''; };
  const tutup = () => { if (!memuat && !berjalan) { reset(); onOpenChange(false); } };

  const pilih = async (f) => {
    reset();
    if (!f) return;
    setFile(f);
    setMemuat(true);
    try {
      const err = await validasiFormatExcel(f);
      if (err) { setGalat(err); return; }
      const r = await bacaBerkasCkg(f);
      setBaca(r);
      if (r.masalahHeader.length) setGalat('Susunan kolom berkas tidak sesuai template CKG.');
      else if (!r.baris.length) setGalat('Tidak ada baris hasil pemeriksaan yang bisa diimpor.');
    } catch (e) {
      setGalat('Berkas tidak bisa dibaca. Pastikan berkas Excel .xlsx dari template CKG.');
    } finally {
      setMemuat(false);
    }
  };

  const proses = async () => {
    setTahap('mengunggah');
    setPersen(5);
    let h;
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post('/uks/ckg/import-excel', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (ev) => {
          if (ev.total) setPersen(Math.min(60, Math.round((ev.loaded / ev.total) * 60)));
          if (ev.total && ev.loaded >= ev.total) setTahap('memproses');
        },
      });
      setTahap('memproses');
      setPersen(95);
      h = { ...data, tiruan: false };
    } catch (e) {
      const st = e?.response?.status;
      if (st === 404) {
        // Server lama tanpa endpoint impor: tampilkan hasil tiruan (tidak disimpan).
        setTahap('memproses');
        await jeda(300);
        h = hasilImporCkgTiruan(baca.baris);
      } else {
        setTahap(null);
        setPersen(0);
        const d = e?.response?.data?.detail;
        toast.error(st === 403 ? 'Hanya petugas UKS/admin yang dapat mengimpor CKG'
          : typeof d === 'string' ? d : d?.pesan ? [d.pesan, ...(d.masalah || [])].join(' — ') : 'Impor CKG gagal');
        return;
      }
    }
    setPersen(100);
    setTahap('selesai');
    setHasil(h);
    if (h.tiruan) toast.info(`Tiruan impor CKG: ${h.success} baris siap, ${h.failed} baris gagal (belum disimpan).`);
    else if (h.failed) toast.warning(`Impor CKG: ${h.success} berhasil (${h.baru ?? h.success} baru, ${h.diperbarui ?? 0} diperbarui), ${h.failed} gagal.`);
    else toast.success(`Impor CKG berhasil: ${h.baru ?? h.success} baru, ${h.diperbarui ?? 0} diperbarui.`);
    onSelesai?.(h);
  };

  const siap = baca && !baca.masalahHeader.length && baca.baris.length > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : tutup())}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Upload className="h-5 w-5 text-[#006837]" /> Impor Data CKG</DialogTitle>
          <DialogDescription>Unggah berkas hasil template CKG yang sudah diisi. Hanya baris yang memiliki hasil pemeriksaan yang diproses.</DialogDescription>
        </DialogHeader>

        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
          onDragOver={(e) => { e.preventDefault(); setSeret(true); }}
          onDragLeave={() => setSeret(false)}
          onDrop={(e) => { e.preventDefault(); setSeret(false); pilih(e.dataTransfer.files?.[0]); }}
          className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center ${seret ? 'border-[#006837] bg-[#006837]/5' : 'border-slate-300 hover:border-slate-400'}`}
          data-testid="zona-unggah-ckg"
        >
          {memuat ? <Loader2 className="h-6 w-6 animate-spin text-[#006837]" /> : <FileSpreadsheet className="h-6 w-6 text-[#006837]" />}
          {file ? <div className="text-sm font-medium text-slate-800">{file.name}</div>
            : <div className="text-sm text-slate-600">Seret berkas .xlsx ke sini atau <span className="font-medium text-[#006837]">klik untuk memilih</span><div className="text-xs text-slate-400">Format Excel .xlsx dari template CKG, maks 5 MB</div></div>}
          {file && <div className="text-xs text-slate-500">{(file.size / 1024).toFixed(0)} KB</div>}
          <input ref={inputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(e) => pilih(e.target.files?.[0])} data-testid="input-berkas-ckg" />
        </div>

        {galat && (
          <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800" role="alert">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div><div className="font-semibold">{galat}</div>{baca?.masalahHeader?.map((m) => <div key={m}>{m}</div>)}</div>
          </div>
        )}

        {siap && (
          <div className="space-y-2" data-testid="pratinjau-impor-ckg">
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline" className="gap-1 border-emerald-300 text-emerald-700"><CheckCircle2 className="h-3 w-3" /> Kolom sesuai template</Badge>
              <Badge variant="outline">{baca.baris.length} baris hasil pemeriksaan</Badge>
              {baca.dilewati.belumDiperiksa > 0 && <Badge variant="outline">{baca.dilewati.belumDiperiksa} pasien belum diperiksa dilewati</Badge>}
              {baca.dilewati.kosong > 0 && <Badge variant="outline">{baca.dilewati.kosong} baris kosong</Badge>}
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>{['Baris', 'Nama', 'Tanggal', 'BB', 'TB', 'TD', 'Hb', 'GDS'].map((h) => <th key={h} className="px-2 py-1.5 text-left">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {baca.baris.slice(0, 6).map((b) => (
                    <tr key={b.baris} className="border-t border-slate-100">
                      <td className="px-2 py-1 font-mono text-slate-500">{b.baris}</td>
                      <td className="px-2 py-1">{b.data.nama_lengkap || '-'}</td>
                      <td className="px-2 py-1 font-mono">{b.data.tanggal || <span className="text-rose-600">kosong</span>}</td>
                      {['bb', 'tb', 'td', 'hemoglobin', 'gds'].map((k) => <td key={k} className="px-2 py-1 font-mono">{b.data[k] || '-'}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
              {baca.baris.length > 6 && <div className="border-t border-slate-100 px-2 py-1 text-xs text-slate-500">... dan {baca.baris.length - 6} baris lainnya</div>}
            </div>
          </div>
        )}

        {tahap && (
          <div className="space-y-1.5" data-testid="indikator-impor-ckg" aria-live="polite">
            <div className="flex items-center justify-between text-xs text-slate-700">
              <span className="flex items-center gap-1.5">
                {berjalan ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[#006837]" /> : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                {TAHAP_IMPOR_CKG[tahap]}{berjalan && baca ? ` (${baca.baris.length} baris)` : ''}
              </span>
              <span className="tabular-nums">{persen}%</span>
            </div>
            <Progress value={persen} className="h-2" />
            <ol className="flex gap-3 text-[11px] text-slate-500">
              {['mengunggah', 'memproses', 'selesai'].map((t, i) => {
                const urut = ['mengunggah', 'memproses', 'selesai'];
                const lewat = urut.indexOf(tahap) > i || tahap === 'selesai';
                return <li key={t} className={tahap === t ? 'font-semibold text-[#006837]' : lewat ? 'text-emerald-600' : ''}>{i + 1}. {t[0].toUpperCase() + t.slice(1)}</li>;
              })}
            </ol>
          </div>
        )}

        {hasil && (
          <>
          {!hasil.tiruan && (hasil.baru != null) && (
            <p className="text-xs text-slate-600" data-testid="rincian-simpan-ckg">
              Tersimpan: <span className="font-semibold text-emerald-700">{hasil.baru} pemeriksaan baru</span>
              {hasil.diperbarui > 0 && <>, <span className="font-semibold text-sky-700">{hasil.diperbarui} diperbarui</span> (pasien & tanggal sudah ada)</>}
              {hasil.format === 'lama' && ' · berkas template versi lama'}
            </p>
          )}
          <RingkasanImpor
            hasil={keRingkasan(hasil)}
            dilewati={baca ? { kosong: baca.dilewati.kosong, belum: baca.dilewati.belumDiperiksa } : undefined}
            namaData="CKG"
            keteranganMode={null}
            labelDilewati="kosong/belum diperiksa"
          />
          </>
        )}

        <DialogFooter>
          {file && !memuat && !berjalan && <Button variant="ghost" onClick={reset} className="mr-auto gap-1"><X className="h-4 w-4" /> Ganti berkas</Button>}
          <Button variant="outline" onClick={tutup} disabled={memuat || berjalan}>Tutup</Button>
          <Button onClick={proses} disabled={!siap || memuat || berjalan || !!hasil} className="gap-2 bg-[#006837] hover:bg-[#005830]" data-testid="btn-proses-impor-ckg">
            {berjalan ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {berjalan ? 'Memproses...' : 'Proses Impor'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
