import React, { useEffect, useMemo, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Filter } from 'lucide-react';
import { daftarPeriodeRekap } from '@/lib/pkgRekap';

const SEMUA = '__semua__';

// Saringan rekap bertingkat: tahun pelajaran -> semester -> periode PKG. `nilai` = periode_id terpilih;
// `onUbah(periodeId)` dipanggil saat periode berganti (memilih tahun/semester memilih periode terbaru yang cocok).
export default function SaringanPeriodeRekap({ nilai, onUbah }) {
  const [daftar, setDaftar] = useState([]);
  const [tahun, setTahun] = useState(SEMUA);
  const [semester, setSemester] = useState(SEMUA);

  useEffect(() => { daftarPeriodeRekap().then(setDaftar).catch(() => setDaftar([])); }, []);

  // Selaraskan tahun & semester dengan periode terpilih (mis. dari URL).
  useEffect(() => {
    const p = daftar.find((x) => x.id === nilai);
    if (p) {
      setTahun(p.tahun_pelajaran);
      setSemester(p.semester);
    }
  }, [daftar, nilai]);

  const daftarTahun = useMemo(() => [...new Set(daftar.map((p) => p.tahun_pelajaran))], [daftar]);
  const daftarSemester = useMemo(
    () => [...new Set(daftar.filter((p) => tahun === SEMUA || p.tahun_pelajaran === tahun).map((p) => p.semester))],
    [daftar, tahun],
  );
  const cocok = useMemo(
    () => daftar.filter((p) => (tahun === SEMUA || p.tahun_pelajaran === tahun) && (semester === SEMUA || p.semester === semester)),
    [daftar, tahun, semester],
  );

  const pilihTahun = (v) => {
    setTahun(v);
    setSemester(SEMUA);
    const p = daftar.find((x) => v === SEMUA || x.tahun_pelajaran === v);
    if (p && p.id !== nilai) onUbah(p.id);
  };
  const pilihSemester = (v) => {
    setSemester(v);
    const p = daftar.find((x) => (tahun === SEMUA || x.tahun_pelajaran === tahun) && (v === SEMUA || x.semester === v));
    if (p && p.id !== nilai) onUbah(p.id);
  };

  if (!daftar.length) return null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-end" data-testid="pkg-saringan-rekap">
      <Filter className="hidden h-4 w-4 shrink-0 text-slate-400 sm:mb-2.5 sm:block" aria-hidden="true" />
      <div className="space-y-1 sm:w-40">
        <Label className="text-xs text-slate-500">Tahun pelajaran</Label>
        <Select value={tahun} onValueChange={pilihTahun}>
          <SelectTrigger className="h-9" data-testid="pkg-saringan-tahun"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={SEMUA}>Semua</SelectItem>
            {daftarTahun.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1 sm:w-36">
        <Label className="text-xs text-slate-500">Semester</Label>
        <Select value={semester} onValueChange={pilihSemester}>
          <SelectTrigger className="h-9" data-testid="pkg-saringan-semester"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={SEMUA}>Semua</SelectItem>
            {daftarSemester.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <Label className="text-xs text-slate-500">Periode PKG</Label>
        <Select value={nilai || ''} onValueChange={onUbah}>
          <SelectTrigger className="h-9" data-testid="pkg-saringan-periode"><SelectValue placeholder="Pilih periode" /></SelectTrigger>
          <SelectContent>
            {cocok.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.nama_periode}{p.status === 'berjalan' ? ' (berjalan)' : ''}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {(() => {
        const p = daftar.find((x) => x.id === nilai);
        return p ? <Badge variant="outline" className="h-6 shrink-0 self-start sm:self-end sm:mb-1.5">{p.status === 'berjalan' ? 'Berjalan' : 'Ditutup'}</Badge> : null;
      })()}
    </div>
  );
}
