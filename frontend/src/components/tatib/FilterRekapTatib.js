import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RotateCcw } from 'lucide-react';
import { api } from '@/lib/api';

export const FILTER_REKAP_KOSONG = { kelas: '', semester_id: '', tahun_takwim_id: '', start_date: '', end_date: '' };

// Filter Rekap Pengawas: kelas, semester (dari /auth/view-context, bawaan = semester yang sedang
// dilihat pengguna), dan rentang tanggal. `onChange` menerima objek filter siap dikirim ke API.
export default function FilterRekapTatib({ value, onChange }) {
  const [kelasList, setKelasList] = useState([]);
  const [semesterList, setSemesterList] = useState([]);

  useEffect(() => {
    api.get('/classes').then(({ data }) => setKelasList(data || [])).catch(() => {});
    api.get('/auth/view-context').then(({ data }) => {
      setSemesterList(data?.available_semesters || []);
      // Bawaan mengikuti konteks semester pengguna agar konsisten dengan halaman lain.
      if (data?.semester_id && !value.semester_id) {
        onChange({ ...value, semester_id: data.semester_id, tahun_takwim_id: data.tahun_takwim_ids?.[0] || '' });
      }
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (patch) => onChange({ ...value, ...patch });
  const pilihSemester = (id) => {
    const sem = semesterList.find((s) => s.id === id);
    set({ semester_id: id, tahun_takwim_id: sem?.tahun_takwim_id || '' });
  };
  const tanggalTerbalik = value.start_date && value.end_date && value.start_date > value.end_date;

  return (
    <Card data-testid="rekap-filter">
      <CardContent className="p-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1.5fr_1fr_1fr_auto] lg:items-end">
        <div>
          <Label>Kelas</Label>
          <Select value={value.kelas || 'all'} onValueChange={(v) => set({ kelas: v === 'all' ? '' : v })}>
            <SelectTrigger data-testid="rekap-filter-kelas"><SelectValue placeholder="Semua kelas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua kelas</SelectItem>
              {kelasList.map((k) => <SelectItem key={k.id} value={k.name}>{k.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Semester</Label>
          <Select value={value.semester_id || 'all'} onValueChange={(v) => (v === 'all' ? set({ semester_id: '', tahun_takwim_id: '' }) : pilihSemester(v))}>
            <SelectTrigger data-testid="rekap-filter-semester"><SelectValue placeholder="Semua semester" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua semester</SelectItem>
              {semesterList.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}{s.is_active ? ' (aktif)' : ''}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Dari tanggal</Label>
          <Input type="date" value={value.start_date} max={value.end_date || undefined} onChange={(e) => set({ start_date: e.target.value })} data-testid="rekap-filter-dari" />
        </div>
        <div>
          <Label>Sampai tanggal</Label>
          <Input type="date" value={value.end_date} min={value.start_date || undefined} onChange={(e) => set({ end_date: e.target.value })} data-testid="rekap-filter-sampai" />
        </div>
        <Button variant="outline" onClick={() => onChange(FILTER_REKAP_KOSONG)} data-testid="rekap-filter-reset">
          <RotateCcw className="h-4 w-4 mr-2" /> Atur ulang
        </Button>
        {tanggalTerbalik && (
          <p className="text-xs text-red-600 sm:col-span-2 lg:col-span-5">Tanggal awal tidak boleh setelah tanggal akhir.</p>
        )}
      </CardContent>
    </Card>
  );
}
