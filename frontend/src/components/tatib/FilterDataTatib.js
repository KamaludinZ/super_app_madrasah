import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RotateCcw, Search } from 'lucide-react';

/**
 * Filter Data Tata Tertib: kategori → jenis aturan (jenis mengikuti kategori terpilih) dan cari siswa.
 * `pilihan`: { kategori: [nama], jenis: [{id, kode, nama}] }; `value`/`onChange` objek filter.
 */
export default function FilterDataTatib({ value, onChange, pilihan, kosong }) {
  const set = (patch) => onChange({ ...value, ...patch });
  const aktif = Boolean(value.kategori || value.jenis || value.cari);
  return (
    <Card data-testid="data-filter">
      <CardContent className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1.5fr_1.5fr_auto] lg:items-end">
        <div>
          <Label>Kategori</Label>
          <Select value={value.kategori || 'all'} onValueChange={(v) => set({ kategori: v === 'all' ? '' : v, jenis: '' })}>
            <SelectTrigger data-testid="data-filter-kategori"><SelectValue placeholder="Semua kategori" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua kategori</SelectItem>
              {pilihan.kategori.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Jenis aturan</Label>
          <Select value={value.jenis || 'all'} onValueChange={(v) => set({ jenis: v === 'all' ? '' : v })}>
            <SelectTrigger data-testid="data-filter-jenis"><SelectValue placeholder="Semua jenis" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua jenis{value.kategori ? ` di ${value.kategori}` : ''}</SelectItem>
              {pilihan.jenis.map((j) => <SelectItem key={j.id} value={j.id}>{j.kode} · {j.nama}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Cari siswa</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={value.cari} onChange={(e) => set({ cari: e.target.value })} placeholder="Nama, NIS, NISN, atau kelas…"
              className="pl-9" data-testid="data-filter-cari" />
          </div>
        </div>
        <Button variant="outline" onClick={() => onChange(kosong)} disabled={!aktif} data-testid="data-filter-reset">
          <RotateCcw className="h-4 w-4 mr-2" /> Atur ulang
        </Button>
      </CardContent>
    </Card>
  );
}
