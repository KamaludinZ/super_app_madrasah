import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Download, Loader2, UserX, CheckCircle2 } from 'lucide-react';
import { barisDataGtk, jenisGtk } from '@/lib/dataGtkKolom';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { hariIniWIB } from '@/lib/tanggal';

export const saveBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const LABEL_JENIS_GTK = { guru: 'Guru', tendik: 'Tendik', all: 'Semua' };

export const OPSI_JENIS_GTK = [
  { value: 'all', label: 'Keseluruhan (guru & tenaga kependidikan)' },
  { value: 'guru', label: 'Guru' },
  { value: 'tendik', label: 'Tenaga Kependidikan' },
];

/** Nama berkas unduhan Data GTK, mis. Data_GTK_Guru_2026-10-05.xlsx */
export const namaBerkasDataGtk = (jenis, tanggal = hariIniWIB()) =>
  `Data_GTK_${LABEL_JENIS_GTK[jenis] || 'Semua'}_${tanggal}.xlsx`;

/**
 * Cadangan bila endpoint server belum tersedia: susun .xlsx di browser dari daftar
 * GTK yang sudah termuat di halaman, dengan susunan kolom baku KOLOM_DATA_GTK.
 */
export async function unduhDataGtkLokal({ users, jenis, filename }) {
  const XLSX = await import('xlsx');
  const terpilih = users.filter((u) => {
    const j = jenisGtk(u);
    return j && (jenis === 'all' || j === jenis);
  });
  const ws = XLSX.utils.aoa_to_sheet(barisDataGtk(terpilih));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data GTK');
  XLSX.writeFile(wb, filename);
  return terpilih.length;
}

const TAHAP = {
  menyiapkan: 'Menyiapkan data GTK di server…',
  mengunduh: 'Mengunduh berkas…',
  lokal: 'Menyusun berkas dari data di layar…',
  selesai: 'Berkas siap — unduhan dimulai.',
};

/**
 * Tombol "Unduh Excel" Data GTK (khusus admin). Membuka dialog pemilih jenis GTK
 * (default keseluruhan) lalu mengunduh GET /gtk/export-excel?jenis=guru|tendik,
 * berisi kolom data diri, kepegawaian, informasi lain, tempat tinggal, status
 * perkawinan, dan penugasan.
 *
 * - `jumlah`: { guru, tendik } untuk pratinjau jumlah GTK per jenis.
 */
export default function UnduhDataGtkButton({ jumlah = {}, users = [], disabled }) {
  const [open, setOpen] = useState(false);
  const [jenis, setJenis] = useState('all');
  const [loading, setLoading] = useState(false);
  const [tahap, setTahap] = useState(null); // null | 'menyiapkan' | 'mengunduh' | 'lokal' | 'selesai'
  const [persen, setPersen] = useState(0);


  const [ringkasan, setRingkasan] = useState(null);
  const jumlahPer = ringkasan || { ...jumlah, all: (jumlah.guru ?? 0) + (jumlah.tendik ?? 0) };

  const buka = () => {
    api.get('/gtk/export-excel/ringkasan').then(({ data }) => setRingkasan(data)).catch(() => setRingkasan(null));
    setJenis('all'); // selalu mulai dari keseluruhan
    setTahap(null);
    setPersen(0);
    setOpen(true);
  };

  const unduh = async () => {
    setLoading(true);
    setTahap('menyiapkan');
    setPersen(10);
    const label = jenis === 'all' ? 'keseluruhan' : LABEL_JENIS_GTK[jenis].toLowerCase();
    const selesai = () => {
      setTahap('selesai');
      setPersen(100);
      setTimeout(() => setOpen(false), 700);
    };
    try {
      const params = jenis !== 'all' ? { jenis } : {};
      const res = await api.get('/gtk/export-excel', {
        params,
        responseType: 'blob',
        onDownloadProgress: (ev) => {
          setTahap('mengunduh');
          setPersen(ev.total ? Math.max(30, Math.round((ev.loaded / ev.total) * 95)) : 60);
        },
      });
      saveBlob(new Blob([res.data]), namaBerkasDataGtk(jenis));
      if (res.headers?.['x-jumlah-data'] === '0') {
        toast.warning(`Belum ada data GTK ${label}; berkas hanya berisi judul kolom (lihat sheet Keterangan).`);
      } else {
        toast.success(`Data GTK ${label} berhasil diunduh`);
      }
      selesai();
    } catch (e) {
      if (e?.response?.status === 404) {
        try {
          setTahap('lokal');
          setPersen(60);
          const n = await unduhDataGtkLokal({ users, jenis, filename: namaBerkasDataGtk(jenis) });
          toast.info(`Diunduh dari data di layar (${n} GTK) karena fitur server belum tersedia.`);
          selesai();
        } catch (err) {
          setTahap(null);
          toast.error('Gagal menyusun berkas Excel');
        }
      } else {
        setTahap(null);
        toast.error('Gagal mengunduh data GTK');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button onClick={buka} disabled={disabled} className="gap-2 bg-[#006837] hover:bg-[#005830]" data-testid="btn-unduh-data-gtk">
        <Download className="h-4 w-4" /> Unduh Excel
      </Button>

      <Dialog open={open} onOpenChange={(v) => !loading && setOpen(v)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Unduh Data GTK</DialogTitle>
            <DialogDescription>
              Berkas Excel berisi data diri, kepegawaian, informasi lain, tempat tinggal, status perkawinan, dan penugasan. Pilih jenis GTK.
            </DialogDescription>
          </DialogHeader>

          <RadioGroup value={jenis} onValueChange={setJenis} disabled={loading} className="gap-2" data-testid="pilih-jenis-gtk-unduhan">
            {OPSI_JENIS_GTK.map((o) => (
              <Label
                key={o.value}
                htmlFor={`jenis-gtk-unduh-${o.value}`}
                className={`flex items-center justify-between rounded-lg border px-3 py-2.5 cursor-pointer font-normal ${jenis === o.value ? 'border-[#006837] bg-[#006837]/5' : 'border-slate-200'}`}
              >
                <span className="flex items-center gap-2.5">
                  <RadioGroupItem id={`jenis-gtk-unduh-${o.value}`} value={o.value} />
                  <span className="text-sm font-medium text-slate-800">{o.label}</span>
                </span>
                <span className="text-xs text-slate-500">{jumlahPer[o.value] != null ? `${jumlahPer[o.value]} orang` : ''}</span>
              </Label>
            ))}
          </RadioGroup>

          {jumlahPer[jenis] === 0 && !tahap && (
            <div className="flex items-start gap-3 rounded-lg border border-dashed border-amber-300 bg-amber-50 px-3 py-3" data-testid="unduh-gtk-kosong">
              <UserX className="h-5 w-5 shrink-0 text-amber-600" />
              <div className="text-xs text-amber-800">
                <div className="font-semibold">Belum ada data GTK pada pilihan ini</div>
                Berkas tetap bisa diunduh dan hanya berisi judul kolom — bisa dipakai sebagai acuan pengisian.
              </div>
            </div>
          )}

          {tahap && (
            <div className="space-y-1.5" data-testid="unduh-gtk-proses" aria-live="polite">
              <div className="flex items-center gap-2 text-xs text-slate-700">
                {tahap === 'selesai'
                  ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  : <Loader2 className="h-4 w-4 animate-spin text-[#006837]" />}
                {TAHAP[tahap]}
              </div>
              <Progress value={persen} className="h-2" />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>Batal</Button>
            <Button onClick={unduh} disabled={loading} className="gap-2 bg-[#006837] hover:bg-[#005830]" data-testid="btn-konfirmasi-unduh-gtk">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Unduh
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
