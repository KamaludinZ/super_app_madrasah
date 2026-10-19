import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ClipboardList } from 'lucide-react';

// Daftar tugas guru per penilai: dibentuk otomatis dari pembagian yang TERSIMPAN (bukan suntingan yang belum
// disimpan), sama dengan daftar yang dilihat tiap penilai di "Tugas Penilaian Saya".
// `penilai`/`dinilai` = [anggota], `penugasan` = { guru_id: penilai_id }, `jatah` = { penilai_id: n }.
export default function DaftarTugasPerPenilai({ penilai = [], dinilai = [], penugasan = {}, jatah = {}, adaPerubahan = false }) {
  const guruById = Object.fromEntries(dinilai.map((g) => [g.id, g]));
  const tugas = Object.fromEntries(penilai.map((p) => [p.id, []]));
  Object.entries(penugasan).forEach(([gid, pid]) => {
    if (tugas[pid] && guruById[gid]) tugas[pid].push(guruById[gid]);
  });
  Object.values(tugas).forEach((daftar) => daftar.sort((a, b) => a.nama.localeCompare(b.nama)));

  return (
    <Card data-testid="pkg-tugas-per-penilai">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><ClipboardList className="h-4 w-4 text-[#006837]" /> Daftar Tugas per Penilai</CardTitle>
        <p className="text-xs text-slate-500">
          Terbentuk dari pembagian yang tersimpan.{adaPerubahan && <span className="text-amber-700"> Ada perubahan yang belum disimpan.</span>}
        </p>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {penilai.length === 0 && <p className="text-sm text-slate-500">Belum ada penilai di SK aktif.</p>}
        {penilai.map((p) => {
          const daftar = tugas[p.id] || [];
          const j = Number(jatah[p.id]) || 0;
          return (
            <div key={p.id} className="rounded-lg border border-slate-200 p-3" data-testid={`pkg-tugas-penilai-${p.id}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 truncate">{p.nama}</div>
                  <div className="text-xs text-slate-500">NIP {p.nip || '-'}</div>
                </div>
                <Badge variant="outline" className={`shrink-0 tabular-nums ${j && daftar.length > j ? 'border-rose-200 text-rose-700' : ''}`}>
                  {daftar.length}{j ? `/${j}` : ''} guru
                </Badge>
              </div>
              {daftar.length === 0 ? (
                <p className="mt-2 text-xs text-slate-400">Belum ada guru yang dibagikan.</p>
              ) : (
                <ol className="mt-2 space-y-1 text-sm text-slate-700 list-decimal list-inside">
                  {daftar.map((g) => (
                    <li key={g.id} className="truncate">{g.nama} <span className="text-xs text-slate-400">· {g.mapel || '-'}</span></li>
                  ))}
                </ol>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
