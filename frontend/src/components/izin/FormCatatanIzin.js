import React, { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Lock, NotebookPen, CheckCircle2 } from 'lucide-react';
import { CATATAN_MAKS, kirimCatatan, pesanGalat, validasiCatatan } from '@/lib/izinKamad';
import { formatWIB } from '@/lib/datetime';

/**
 * Formulir catatan satpam pada satu izin. Catatan hanya dapat dibaca kepala madrasah/kepala
 * sekolah dan kepala tata usaha, jadi isi catatan yang sudah terkirim tidak ditampilkan di sini —
 * cukup konfirmasi bahwa catatan tersimpan.
 */
export default function FormCatatanIzin({ izin, fokus = false }) {
  const [isi, setIsi] = useState('');
  const [galat, setGalat] = useState('');
  const [mengirim, setMengirim] = useState(false);
  const [terkirim, setTerkirim] = useState([]); // waktu kirim (sesi dialog ini)

  const kirim = async (e) => {
    e.preventDefault();
    const g = validasiCatatan(isi);
    setGalat(g);
    if (g) return;
    setMengirim(true);
    try {
      const h = await kirimCatatan(izin.id, isi);
      setTerkirim((t) => [...t, h.catatan.dibuat_pada]);
      setIsi('');
      toast.success(`Catatan tersimpan${h.tiruan ? ' (contoh, belum tersimpan di server)' : ''}`);
    } catch (err) {
      setGalat(pesanGalat(err, 'Gagal menyimpan catatan. Periksa koneksi lalu coba lagi.'));
    } finally {
      setMengirim(false);
    }
  };

  return (
    <form onSubmit={kirim} className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3" data-testid="form-catatan-izin">
      <label htmlFor={`catatan-${izin.id}`} className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
        <NotebookPen className="h-4 w-4 text-[#006837]" /> Catatan Satpam
      </label>
      <Textarea
        id={`catatan-${izin.id}`}
        value={isi}
        onChange={(e) => { setIsi(e.target.value); if (galat) setGalat(''); }}
        placeholder="Mis. keluar pukul 09.05 dijemput keluarga; kembali lewat gerbang belakang."
        rows={3}
        autoFocus={fokus}
        maxLength={CATATAN_MAKS}
        disabled={mengirim}
        aria-invalid={!!galat}
        aria-describedby={`catatan-info-${izin.id}`}
        className="bg-white"
        data-testid="input-catatan-izin"
      />
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span id={`catatan-info-${izin.id}`} className="flex items-center gap-1 text-slate-500">
          <Lock className="h-3 w-3" /> Hanya dapat dibaca Kepala Madrasah & Kepala Tata Usaha.
        </span>
        <span className="tabular-nums text-slate-400">{isi.length}/{CATATAN_MAKS}</span>
      </div>
      {galat && <p className="text-xs text-rose-700" role="alert" data-testid="galat-catatan-izin">{galat}</p>}
      {terkirim.length > 0 && (
        <p className="flex items-center gap-1 text-xs text-emerald-700" data-testid="info-catatan-terkirim">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {terkirim.length} catatan tersimpan · terakhir pukul {formatWIB(terkirim[terkirim.length - 1], 'Time', { hour: '2-digit', minute: '2-digit' })} WIB
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={mengirim || !isi.trim()} className="gap-1.5 bg-[#006837] hover:bg-[#00552d]" data-testid="btn-kirim-catatan-izin">
          {mengirim && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Simpan Catatan
        </Button>
      </div>
    </form>
  );
}
