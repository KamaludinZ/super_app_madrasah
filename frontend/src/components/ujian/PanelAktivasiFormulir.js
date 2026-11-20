import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Save } from 'lucide-react';
import { rentangTanggal } from '@/components/ujian/DaftarUjian';
import { pesanGalat } from '@/lib/ujian';
import { galatAktivasi, simpanAktivasi } from '@/lib/ujianFormulir';

/**
 * Panel Aktivasi & Jendela Waktu: menyalakan/mematikan formulir daftar hadir & berita acara beserta jam buka–tutup
 * untuk SELURUH ruang sekaligus pada satu ujian. Formulir hanya bisa diisi pada tanggal masa ujian dan di dalam
 * jendela jam ini (WIB). `onTersimpan(formulir)`.
 */
export default function PanelAktivasiFormulir({ ujian, formulir, bolehUbah, onTersimpan }) {
  const [isi, setIsi] = useState({ aktif: false, jam_buka: '', jam_tutup: '' });
  const [menyimpan, setMenyimpan] = useState(false);

  useEffect(() => {
    setIsi({ aktif: !!formulir?.aktif, jam_buka: formulir?.jam_buka || '', jam_tutup: formulir?.jam_tutup || '' });
  }, [formulir]);

  const galat = galatAktivasi(isi);
  const berubah = isi.aktif !== !!formulir?.aktif || isi.jam_buka !== (formulir?.jam_buka || '') || isi.jam_tutup !== (formulir?.jam_tutup || '');

  const simpan = async () => {
    setMenyimpan(true);
    try {
      const h = await simpanAktivasi(ujian.id, { aktif: isi.aktif, jam_buka: isi.jam_buka || null, jam_tutup: isi.jam_tutup || null });
      toast.success(`Formulir ${isi.aktif ? 'diaktifkan' : 'dinonaktifkan'} untuk semua ruang${h.tiruan ? ' (contoh)' : ''}`);
      onTersimpan?.(h.formulir);
    } catch (e) {
      toast.error(pesanGalat(e, 'Gagal menyimpan aktivasi formulir.'));
    } finally {
      setMenyimpan(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="panel-aktivasi">
      <label className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${isi.aktif ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200'}`}>
        <span>
          <span className="block text-sm font-semibold text-slate-900">{isi.aktif ? 'Formulir aktif' : 'Formulir nonaktif'}</span>
          <span className="block text-xs text-slate-500">
            {isi.aktif ? `Dapat diisi ${rentangTanggal(ujian?.mulai, ujian?.selesai)} di dalam jam di bawah.` : 'Tautan publik menolak semua kiriman.'}
          </span>
        </span>
        <Switch checked={isi.aktif} disabled={!bolehUbah || menyimpan} onCheckedChange={(v) => setIsi((x) => ({ ...x, aktif: v }))}
          aria-label="Aktifkan formulir daftar hadir dan berita acara" data-testid="switch-aktif-formulir" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="jam-buka" className={galat.jam_buka ? 'text-red-600' : undefined}>Jam buka (WIB)</Label>
          <Input id="jam-buka" type="time" value={isi.jam_buka} disabled={!bolehUbah || menyimpan} onChange={(e) => setIsi((x) => ({ ...x, jam_buka: e.target.value }))}
            aria-invalid={!!galat.jam_buka} className={galat.jam_buka ? 'border-red-500' : ''} data-testid="input-jam-buka" />
          {galat.jam_buka && <p className="text-xs text-red-600" role="alert">{galat.jam_buka}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="jam-tutup" className={galat.jam_tutup ? 'text-red-600' : undefined}>Jam tutup (WIB)</Label>
          <Input id="jam-tutup" type="time" value={isi.jam_tutup} disabled={!bolehUbah || menyimpan} onChange={(e) => setIsi((x) => ({ ...x, jam_tutup: e.target.value }))}
            aria-invalid={!!galat.jam_tutup} className={galat.jam_tutup ? 'border-red-500' : ''} data-testid="input-jam-tutup" />
          {galat.jam_tutup && <p className="text-xs text-red-600" role="alert">{galat.jam_tutup}</p>}
        </div>
      </div>
      <p className="text-xs text-slate-500">Satu pengaturan berlaku untuk semua ruang pada ujian ini. Di luar jam ini tautan publik menolak kiriman.</p>
      {bolehUbah && (
        <div className="flex justify-end">
          <Button onClick={simpan} disabled={menyimpan || !berubah || Object.keys(galat).length > 0} className="gap-2 bg-[#006837] hover:bg-[#00552d]" data-testid="btn-simpan-aktivasi">
            {menyimpan ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan Aktivasi
          </Button>
        </div>
      )}
    </div>
  );
}
