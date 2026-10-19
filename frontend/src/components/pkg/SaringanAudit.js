import React, { useEffect, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, RotateCcw } from 'lucide-react';
import { AKSI_PER_KATEGORI, KATEGORI_AUDIT } from '@/lib/pkgAudit';
import { daftarPeriodeRekap } from '@/lib/pkgRekap';

const SEMUA = '__semua__';
export const SARINGAN_AUDIT_KOSONG = { kategori: '', aksi: '', periodeId: '', dari: '', sampai: '', cari: '' };

// Satu baris saringan daftar audit: kategori, jenis aksi (bergantung kategori), periode PKG (-> rentang tanggal
// buka–tutup), dan pencarian pelaku/ringkasan. `nilai` & `onUbah(nilaiBaru)` dikendalikan halaman.
export default function SaringanAudit({ nilai, onUbah }) {
  const [periode, setPeriode] = useState([]);
  const [cari, setCari] = useState(nilai.cari);

  useEffect(() => { daftarPeriodeRekap().then(setPeriode).catch(() => setPeriode([])); }, []);
  // Pencarian diterapkan setelah berhenti mengetik sejenak.
  useEffect(() => {
    if (cari === nilai.cari) return undefined;
    const t = setTimeout(() => onUbah({ ...nilai, cari }), 350);
    return () => clearTimeout(t);
  }, [cari, nilai, onUbah]);

  const aksi = nilai.kategori ? AKSI_PER_KATEGORI[nilai.kategori] || {} : Object.assign({}, ...Object.values(AKSI_PER_KATEGORI));
  const pilihPeriode = (id) => {
    const p = periode.find((x) => x.id === id);
    onUbah({ ...nilai, periodeId: id === SEMUA ? '' : id, dari: p?.tanggal_buka || '', sampai: p?.tanggal_tutup || '' });
  };
  const ada = Object.entries(nilai).some(([k, v]) => v && k !== 'cari') || nilai.cari;

  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-center" data-testid="pkg-saringan-audit">
      <Select value={nilai.kategori || SEMUA} onValueChange={(v) => onUbah({ ...nilai, kategori: v === SEMUA ? '' : v, aksi: '' })}>
        <SelectTrigger className="h-9 lg:w-40" aria-label="Kategori aksi" data-testid="pkg-saringan-audit-kategori"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={SEMUA}>Semua kategori</SelectItem>
          {Object.entries(KATEGORI_AUDIT).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={nilai.aksi || SEMUA} onValueChange={(v) => onUbah({ ...nilai, aksi: v === SEMUA ? '' : v })}>
        <SelectTrigger className="h-9 lg:w-56" aria-label="Jenis aksi" data-testid="pkg-saringan-audit-aksi"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={SEMUA}>Semua jenis aksi</SelectItem>
          {Object.entries(aksi).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={nilai.periodeId || SEMUA} onValueChange={pilihPeriode}>
        <SelectTrigger className="h-9 lg:w-64" aria-label="Periode PKG" data-testid="pkg-saringan-audit-periode"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={SEMUA}>Semua periode</SelectItem>
          {periode.map((p) => <SelectItem key={p.id} value={p.id}>{p.nama_periode}</SelectItem>)}
        </SelectContent>
      </Select>
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari pelaku atau ringkasan" className="h-9 pl-8" maxLength={100} data-testid="pkg-saringan-audit-cari" />
      </div>
      {ada && (
        <Button type="button" variant="ghost" size="sm" className="h-9 gap-1" onClick={() => { setCari(''); onUbah(SARINGAN_AUDIT_KOSONG); }} data-testid="pkg-saringan-audit-reset">
          <RotateCcw className="h-3.5 w-3.5" /> Reset
        </Button>
      )}
    </div>
  );
}
