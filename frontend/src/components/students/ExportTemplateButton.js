import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, FileSpreadsheet, Loader2, Lock } from 'lucide-react';
import PratinjauKolom from './PratinjauKolom';
import LegendaPengisian, { aturanPengisian } from './LegendaPengisian';
import { labelOpsi, opsiKolom } from '@/lib/pilihanDataMaster';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const saveBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

/**
 * Cadangan bila endpoint template belum tersedia: buat .xlsx kosong di browser berisi
 * baris judul kolom baku (sama persis dengan unduhan & impor).
 */
/** Baris sheet "Petunjuk" (dipakai template cadangan di browser). */
export function barisPetunjuk(kolom, sheet) {
  const a = aturanPengisian(kolom);
  const daftar = (arr) => arr.map((k) => k.label).join(', ');
  return [
    [`Petunjuk pengisian template ${sheet}`],
    [],
    ['1. Isi data pada sheet "' + sheet + '" mulai baris 2. Jangan mengubah, menghapus, atau menukar urutan baris judul.'],
    [`Baris 1 = judul kolom, baris 2 = keterangan pengisian (diawali ${PENANDA_KETERANGAN}, dilewati saat impor); isi data mulai baris 3.`],
    [`2. Kolom identitas terkunci (penanda baris): ${daftar(a.kunci)}. Jangan diubah; baris tanpa identitas valid dilewati saat impor.`],
    ...(a.tanggal.length ? [[`3. Tanggal ditulis TAHUN-BULAN-TANGGAL (mis. 2012-05-10): ${daftar(a.tanggal)}.`]] : []),
    ...(a.yaTidak.length ? [[`- Isi "Ya" atau "Tidak": ${daftar(a.yaTidak)}.`]] : []),
    ...(a.daftar.length ? [[`- Beberapa nilai dipisah titik koma (mis. BCG; Polio): ${daftar(a.daftar)}.`]] : []),
    ...(a.pilihan.length ? [['- Kolom pilihan diisi salah satu isian yang tersedia di aplikasi (isian lain ditolak saat impor):'],
      ...a.pilihan.map((k) => [`   • ${k.label}: ${labelOpsi(k).join(' / ')}`])] : []),
    ...a.daftar.filter((k) => opsiKolom(k).length).map((k) => [`   • ${k.label} (boleh lebih dari satu, pisahkan ;): ${opsiKolom(k).join(' / ')}`]),
    ['- Nomor (NIK, KK, HP, NISN/NIP) ditulis lengkap termasuk angka 0 di depan.'],
    ['- Kolom yang dikosongkan tidak mengubah data tersimpan (mode bawaan impor: hanya mengisi yang kosong).'],
  ];
}

/** Penanda baris keterangan (baris 2) — sama dengan backend PENANDA_KETERANGAN; dilewati saat impor. */
export const PENANDA_KETERANGAN = '[Keterangan]';

/** Teks keterangan singkat tiap kolom (sama dengan backend keterangan_singkat). */
export function barisKeterangan(kolom) {
  const a = aturanPengisian(kolom);
  const jenis = {};
  Object.entries(a).forEach(([aturan, daftar]) => daftar.forEach((k) => { jenis[k.key] = aturan; }));
  const contoh = { tanggal: '2012-05-10', yaTidak: 'Ya', daftar: 'BCG; Polio' };
  // contoh daftar dari isian aplikasi bila ada (sama dengan backend petunjuk_kolom)
  const dasar = { kunci: 'Penanda baris - jangan diubah', tanggal: 'Format TAHUN-BULAN-TANGGAL', yaTidak: 'Ya / Tidak', daftar: 'Pisahkan dengan ;', teks: 'Teks bebas' };
  return kolom.map((k, i) => {
    const aturan = jenis[k.key];
    let teks;
    if (aturan === 'pilihan') {
      const opsi = opsiKolom(k);
      teks = opsi.length <= 6 ? `Pilih: ${opsi.join(' / ')}` : `Pilih dari dropdown (${opsi.length} pilihan, lihat sheet Daftar Pilihan)`;
    } else {
      const ct = aturan === 'daftar' && opsiKolom(k).length ? opsiKolom(k).slice(0, 2).join('; ') : contoh[aturan];
      teks = dasar[aturan] + (ct ? ` (mis. ${ct})` : '');
    }
    return i === 0 ? `${PENANDA_KETERANGAN} ${teks}` : teks;
  });
}

export async function buatTemplateLokal({ kolom, sheet, filename }) {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.aoa_to_sheet([kolom.map((k) => k.label), barisKeterangan(kolom)]);
  ws['!cols'] = kolom.map((k) => ({ wch: Math.max(12, Math.min(40, k.label.length + 4)) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheet);
  const petunjuk = XLSX.utils.aoa_to_sheet(barisPetunjuk(kolom, sheet));
  petunjuk['!cols'] = [{ wch: 120 }];
  XLSX.utils.book_append_sheet(wb, petunjuk, 'Petunjuk');
  XLSX.writeFile(wb, filename);
}

/**
 * Tombol "Export Template" — mengunduh berkas Excel kosong siap isi dengan kolom yang
 * persis sama seperti hasil Unduh Excel, untuk dilengkapi lalu diimpor kembali.
 *
 * - `endpoint`: URL template di server (mis. '/students/import-template')
 * - `kolom`, `sheet`: skema kolom baku untuk cadangan bila server belum mendukung
 * - `filename`: nama berkas unduhan
 */
export default function ExportTemplateButton({ endpoint, kolom, sheet, filename, label = 'Export Template', judul = 'Template Impor', pilihBagian = false, disabled, testid }) {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const grup = [...new Set(kolom.map((k) => k.grup))];
  const kunci = kolom.filter((k) => k.kunci).map((k) => k.label);

  const unduh = async () => {
    setLoading(true);
    try {
      const res = await api.get(endpoint, { responseType: 'blob' });
      saveBlob(new Blob([res.data]), filename);
      toast.success('Template berhasil diunduh');
      setOpen(false);
    } catch (e) {
      if (e?.response?.status === 404) {
        try {
          await buatTemplateLokal({ kolom, sheet, filename });
          toast.info('Template dibuat dari susunan kolom baku (petunjuk pengisian menyusul dari server).');
          setOpen(false);
        } catch (err) {
          toast.error('Gagal membuat template');
        }
      } else {
        toast.error('Gagal mengunduh template');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} disabled={disabled} className="gap-2" data-testid={testid}>
        <FileSpreadsheet className="h-4 w-4" /> {label}
      </Button>

      <Dialog open={open} onOpenChange={(v) => !loading && setOpen(v)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{judul}</DialogTitle>
            <DialogDescription>
              Berkas Excel kosong siap isi dengan {kolom.length} kolom yang persis sama seperti hasil Unduh Excel ({grup.join(', ')}).
              Lengkapi di luar aplikasi, lalu unggah kembali lewat Import.
            </DialogDescription>
          </DialogHeader>

          {kunci.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>Kolom <strong>{kunci.join(' / ')}</strong> adalah penanda baris untuk mencocokkan data saat impor — jangan diubah isinya.</span>
            </div>
          )}

          <PratinjauKolom kolom={kolom} judul="Pratinjau kolom template" defaultOpen maxHeight="max-h-64" pilihBagian={pilihBagian} />

          <LegendaPengisian kolom={kolom} />

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>Tutup</Button>
            <Button onClick={unduh} disabled={loading} className="gap-2 bg-[#006837] hover:bg-[#005830]" data-testid={testid ? `${testid}-unduh` : undefined}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Unduh Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
