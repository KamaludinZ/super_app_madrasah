import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { barisDataSiswa, KOLOM_DATA_SISWA } from '@/lib/dataSiswaKolom';
import PratinjauKolom from './PratinjauKolom';

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

/** Tingkat yang selalu ditawarkan di MTs; tingkat lain dari data kelas ikut ditampilkan bila ada. */
export const TINGKAT_DEFAULT = ['7', '8', '9'];

/** Nama berkas unduhan Data Siswa, mis. Data_Siswa_Kelas_7_2026-10-05.xlsx */
export const namaBerkasDataSiswa = (tingkat, tanggal = new Date().toISOString().slice(0, 10)) =>
  `Data_Siswa_${tingkat && tingkat !== 'all' ? `Kelas_${tingkat}` : 'Semua'}_${tanggal}.xlsx`;

/**
 * Cadangan bila endpoint server belum tersedia: susun .xlsx di browser dari daftar
 * siswa yang sudah termuat (kolom identitas/data diri terisi; kolom detail EMIS
 * kosong karena daftar siswa tidak memuat student_details).
 */
export async function unduhDataSiswaLokal({ siswa, kelasMap, tingkat, filename }) {
  const XLSX = await import('xlsx');
  const terpilih = siswa
    .filter((u) => tingkat === 'all' || String(kelasMap[u.student_class_id]?.grade) === String(tingkat))
    .map((u) => ({ user: u, detail: u.detail || {}, kelas: kelasMap[u.student_class_id]?.name || '' }));
  const ws = XLSX.utils.aoa_to_sheet(barisDataSiswa(terpilih));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data Siswa');
  XLSX.writeFile(wb, filename);
  return terpilih.length;
}

/**
 * Tombol "Unduh Excel" Data Siswa (khusus admin). Membuka dialog pilihan tingkat
 * kelas (7, 8, 9, atau keseluruhan) lalu mengunduh berkas dari
 * GET /students/export-excel?tingkat=..., berisi kolom tab Data Siswa,
 * Data Orang Tua, dan Data Alamat.
 *
 * - `tingkat`: tingkat awal yang terpilih (mengikuti filter tabel), 'all' | '7' | ...
 * - `tingkatOptions`: tingkat yang ada di data kelas tahun ajaran aktif.
 * - `jumlahPerTingkat`: { '7': 120, ..., all: 360 } untuk pratinjau jumlah siswa.
 */
export default function UnduhDataSiswaButton({ tingkat = 'all', tingkatOptions = [], jumlahPerTingkat = {}, siswa = [], kelasMap = {}, disabled }) {
  const [open, setOpen] = useState(false);
  const [pilihan, setPilihan] = useState('all');
  const [loading, setLoading] = useState(false);
  const [ringkasan, setRingkasan] = useState(null); // jumlah per tingkat dari server

  const opsi = [...new Set([...TINGKAT_DEFAULT, ...tingkatOptions.map(String)])].sort((a, b) => Number(a) - Number(b));

  const buka = () => {
    setPilihan(opsi.includes(String(tingkat)) ? String(tingkat) : 'all');
    setOpen(true);
    api.get('/students/export-excel/ringkasan')
      .then(({ data }) => setRingkasan(data))
      .catch(() => setRingkasan(null)); // server lama: pakai jumlah dari data di layar
  };

  const unduh = async () => {
    setLoading(true);
    try {
      const params = pilihan !== 'all' ? { tingkat: pilihan } : {};
      const res = await api.get('/students/export-excel', { params, responseType: 'blob' });
      saveBlob(new Blob([res.data]), namaBerkasDataSiswa(pilihan));
      const label = pilihan === 'all' ? 'semua tingkat' : `kelas ${pilihan}`;
      if (res.headers?.['x-jumlah-data'] === '0') {
        toast.warning(`Belum ada siswa pada ${label}; berkas hanya berisi judul kolom (lihat sheet Keterangan).`);
      } else {
        toast.success(`Data siswa ${label} berhasil diunduh`);
      }
      setOpen(false);
    } catch (e) {
      if (e?.response?.status === 404) {
        try {
          const n = await unduhDataSiswaLokal({ siswa, kelasMap, tingkat: pilihan, filename: namaBerkasDataSiswa(pilihan) });
          toast.info(`Diunduh dari data di layar (${n} siswa); kolom detail EMIS menunggu fitur server.`);
          setOpen(false);
        } catch (err) {
          toast.error('Gagal menyusun berkas Excel');
        }
      } else {
        toast.error('Gagal mengunduh data siswa');
      }
    } finally {
      setLoading(false);
    }
  };

  const jumlah = ringkasan ? { ...Object.fromEntries(opsi.map((g) => [g, 0])), ...ringkasan } : jumlahPerTingkat;
  const jumlahLabel = (key) => (jumlah[key] != null ? `${jumlah[key]} siswa` : '');
  const jumlahTerpilih = jumlah[pilihan];

  return (
    <>
      <Button onClick={buka} disabled={disabled} className="gap-2 bg-[#006837] hover:bg-[#005830]" data-testid="btn-unduh-data-siswa">
        <Download className="h-4 w-4" /> Unduh Excel
      </Button>

      <Dialog open={open} onOpenChange={(v) => !loading && setOpen(v)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Unduh Data Siswa</DialogTitle>
            <DialogDescription>
              Berkas Excel berisi kolom Data Siswa, Data Orang Tua, dan Data Alamat. Pilih tingkat kelas yang akan diunduh.
            </DialogDescription>
          </DialogHeader>

          <RadioGroup value={pilihan} onValueChange={setPilihan} className="gap-2" data-testid="pilih-tingkat-unduhan">
            {[...opsi.map((g) => ({ value: g, label: `Kelas ${g}` })), { value: 'all', label: 'Keseluruhan (semua tingkat)' }].map((o) => (
              <Label
                key={o.value}
                htmlFor={`tingkat-unduh-${o.value}`}
                className={`flex items-center justify-between rounded-lg border px-3 py-2.5 cursor-pointer font-normal ${pilihan === o.value ? 'border-[#006837] bg-[#006837]/5' : 'border-slate-200'}`}
              >
                <span className="flex items-center gap-2.5">
                  <RadioGroupItem id={`tingkat-unduh-${o.value}`} value={o.value} />
                  <span className="text-sm font-medium text-slate-800">{o.label}</span>
                </span>
                <span className="text-xs text-slate-500">{jumlahLabel(o.value)}</span>
              </Label>
            ))}
          </RadioGroup>

          {jumlahTerpilih === 0 && (
            <p className="text-xs text-amber-700">Belum ada siswa pada pilihan ini; berkas hanya berisi judul kolom.</p>
          )}

          <PratinjauKolom kolom={KOLOM_DATA_SISWA} judul="Pratinjau urutan kolom (sama dengan template & impor)" />

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>Batal</Button>
            <Button onClick={unduh} disabled={loading} className="gap-2 bg-[#006837] hover:bg-[#005830]" data-testid="btn-konfirmasi-unduh-siswa">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Unduh
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
