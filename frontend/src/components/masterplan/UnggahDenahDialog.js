import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, ImageUp, X, FileImage, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { unggahDenah } from '@/lib/masterplan';

export const TIPE_DENAH = ['image/png', 'image/jpeg', 'image/webp'];
export const MAKS_UKURAN_DENAH = 5 * 1024 * 1024;

// Periksa berkas sebelum diunggah -> pesan galat atau '' bila layak.
export function periksaBerkasDenah(b) {
  if (!b) return 'Pilih berkas gambar denah.';
  if (!TIPE_DENAH.includes(b.type)) return 'Format tidak didukung. Gunakan gambar PNG, JPG, atau WEBP.';
  if (b.size > MAKS_UKURAN_DENAH) return `Ukuran berkas ${formatUkuran(b.size)} melebihi batas 5 MB. Perkecil gambar lalu coba lagi.`;
  return '';
}

const formatUkuran = (b) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

// Selisih proporsi (lebar/tinggi) di atas batas ini membuat penanda berbasis persen bergeser.
const BATAS_SELISIH_PROPORSI = 0.05;

// Dialog unggah / ganti denah (admin): seret-lepas atau pilih berkas, pratinjau, lalu unggah.
// `denahLama` (saat mengganti) dipakai untuk memperingatkan bila proporsi gambar berubah.
export default function UnggahDenahDialog({ open, ganti = false, denahLama = null, jumlahPenanda = 0, onClose, onTerunggah }) {
  const [berkas, setBerkas] = useState(null);
  const [pratinjau, setPratinjau] = useState('');
  const [seret, setSeret] = useState(false);
  const [proses, setProses] = useState(false);
  const [ukuranBaru, setUkuranBaru] = useState(null);
  const [galat, setGalat] = useState('');
  const [progres, setProgres] = useState(0);
  const input = useRef(null);

  useEffect(() => {
    if (!open) {
      setBerkas(null);
      setSeret(false);
      setGalat('');
      setProgres(0);
    }
  }, [open]);

  useEffect(() => {
    setUkuranBaru(null);
    if (!berkas) {
      setPratinjau('');
      return undefined;
    }
    const url = URL.createObjectURL(berkas);
    setPratinjau(url);
    return () => URL.revokeObjectURL(url);
  }, [berkas]);

  const rasioLama = denahLama?.lebar && denahLama?.tinggi ? denahLama.lebar / denahLama.tinggi : null;
  const rasioBaru = ukuranBaru ? ukuranBaru.w / ukuranBaru.h : null;
  const proporsiBerubah = ganti && jumlahPenanda > 0 && rasioLama && rasioBaru
    && Math.abs(rasioBaru - rasioLama) / rasioLama > BATAS_SELISIH_PROPORSI;

  const terima = (b) => {
    if (!b) return;
    const pesan = periksaBerkasDenah(b);
    setGalat(pesan);
    setProgres(0);
    setBerkas(pesan ? null : b);
  };

  const unggah = async () => {
    if (!berkas) return;
    setProses(true);
    setGalat('');
    setProgres(0);
    try {
      const denah = await unggahDenah(berkas, setProgres);
      toast.success(ganti ? 'Denah diganti' : 'Denah diunggah');
      onTerunggah?.(denah);
      onClose();
    } catch (e) {
      const pesan = e?.response?.data?.detail || e?.message || 'Gagal mengunggah denah. Periksa koneksi lalu coba lagi.';
      setGalat(pesan);
      setProgres(0);
      toast.error('Denah gagal diunggah');
    } finally {
      setProses(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !proses) onClose(); }}>
      <DialogContent className="max-w-lg" data-testid="masterplan-unggah-dialog">
        <DialogHeader>
          <DialogTitle>{ganti ? 'Ganti Denah Sekolah' : 'Unggah Denah Sekolah'}</DialogTitle>
          <DialogDescription>
            {ganti ? 'Denah baru menggantikan denah aktif. Penanda ruang tetap di posisinya (dalam persen).' : 'Gambar denah menjadi latar penanda ruang.'}
          </DialogDescription>
        </DialogHeader>

        {!berkas ? (
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setSeret(true); }}
            onDragLeave={() => setSeret(false)}
            onDrop={(e) => { e.preventDefault(); setSeret(false); terima(e.dataTransfer.files?.[0]); }}
            className={`flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-10 text-center transition-colors ${
              seret ? 'border-[#006837] bg-[#006837]/5' : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'
            }`}
            data-testid="masterplan-area-berkas"
          >
            <ImageUp className="mb-2 h-10 w-10 text-slate-400" />
            <span className="text-sm font-medium text-slate-700">Seret gambar denah ke sini atau klik untuk memilih</span>
            <span className="mt-1 text-xs text-slate-500">PNG, JPG, atau WEBP · maksimal 5 MB</span>
          </button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <FileImage className="h-8 w-8 shrink-0 text-[#006837]" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">{berkas.name}</p>
                <p className="text-xs text-slate-500">{formatUkuran(berkas.size)}</p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setBerkas(null)} disabled={proses} aria-label="Batalkan pilihan berkas">
                <X className="h-4 w-4" />
              </Button>
            </div>
            {pratinjau && (
              <img
                src={pratinjau}
                alt="Pratinjau denah"
                className="max-h-64 w-full rounded-md border bg-slate-50 object-contain"
                onLoad={(e) => setUkuranBaru({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
                data-testid="masterplan-pratinjau"
              />
            )}
            {proporsiBerubah && (
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" data-testid="masterplan-peringatan-proporsi">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Proporsi gambar baru berbeda dari denah lama. {jumlahPenanda} penanda ruang bisa bergeser dari posisinya — periksa dan atur ulang penanda setelah mengganti.
                </span>
              </div>
            )}
          </div>
        )}

        {proses && (
          <div className="space-y-1" aria-live="polite" data-testid="masterplan-progres">
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full bg-[#006837] transition-all" style={{ width: `${progres}%` }} />
            </div>
            <p className="text-xs text-slate-500">Mengunggah denah... {progres}%</p>
          </div>
        )}
        {galat && (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700" role="alert" data-testid="masterplan-galat-unggah">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{galat}</span>
          </div>
        )}

        <input
          ref={input}
          type="file"
          accept={TIPE_DENAH.join(',')}
          className="hidden"
          onChange={(e) => { terima(e.target.files?.[0]); e.target.value = ''; }}
          data-testid="masterplan-berkas"
        />

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={proses}>Batal</Button>
          <Button onClick={unggah} disabled={!berkas || proses} className="bg-[#006837] hover:bg-[#005830]" data-testid="masterplan-kirim-unggah">
            {proses && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {proses ? 'Mengunggah...' : galat && berkas ? 'Coba lagi' : ganti ? 'Ganti denah' : 'Unggah'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
