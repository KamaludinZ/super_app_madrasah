import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { UsersRound, ArrowDownWideNarrow, ArrowDownAZ } from 'lucide-react';
import BadgeStatusPenilaian from '@/components/pkg/BadgeStatusPenilaian';
import { kelompokkanPerTim } from '@/lib/pkgRekap';

const PERSEN = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const persen = (n) => (n == null ? '-' : `${PERSEN.format(n)}%`);

// Rekap tim per SK: guru dikelompokkan per penilai, terurut (capaian tertinggi atau nama) dengan peringkat,
// ringkasan terkunci & rata-rata capaian per tim. `guru` = baris rekap; `nomorSk` untuk judul.
export default function RekapPerTim({ guru = [], nomorSk }) {
  const [urut, setUrut] = useState('capaian');
  const tim = useMemo(() => kelompokkanPerTim(guru, urut), [guru, urut]);

  return (
    <div className="space-y-3" data-testid="pkg-rekap-tim">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">{nomorSk ? `SK ${nomorSk} · ` : ''}{tim.length} tim penilai</p>
        <div className="flex gap-1" role="group" aria-label="Urutkan">
          {[['capaian', 'Capaian', ArrowDownWideNarrow], ['nama', 'Nama', ArrowDownAZ]].map(([k, label, Ikon]) => (
            <Button key={k} size="sm" variant={urut === k ? 'default' : 'outline'} aria-pressed={urut === k}
              className={`h-8 gap-1 ${urut === k ? 'bg-[#006837] hover:bg-[#005830]' : ''}`} onClick={() => setUrut(k)} data-testid={`pkg-rekap-urut-${k}`}>
              <Ikon className="h-3.5 w-3.5" /> {label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {tim.map((t) => (
          <Card key={t.penilai_nama} data-testid={`pkg-rekap-tim-${t.penilai_nama}`}>
            <CardHeader className="pb-2 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base flex items-center gap-2"><UsersRound className="h-4 w-4 text-[#006837]" /> {t.penilai_nama}</CardTitle>
                <Badge variant="outline" className="shrink-0 tabular-nums">Rata-rata {persen(t.rata_capaian)}</Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Progress value={t.guru.length ? (t.terkunci / t.guru.length) * 100 : 0} className="h-1.5 flex-1" aria-label="Lembar terkunci" />
                <span className="tabular-nums">{t.terkunci}/{t.guru.length} terkunci</span>
              </div>
            </CardHeader>
            <CardContent>
              <ol className="divide-y divide-slate-100">
                {t.guru.map((g) => (
                  <li key={g.guru_id} className="flex items-center gap-3 py-2">
                    <span className="w-6 shrink-0 text-center text-sm font-bold tabular-nums text-slate-400">{g.peringkat ?? '–'}</span>
                    <div className="min-w-0 flex-1">
                      <Link to={`/pkg/rekap/${g.guru_id}`} className="text-sm font-medium text-slate-900 hover:text-[#006837] hover:underline">{g.nama}</Link>
                      <div className="text-xs text-slate-500">{g.mapel || '-'}{g.level_capaian ? ` · ${g.level_capaian}` : ''}</div>
                    </div>
                    {g.capaian_persen != null
                      ? <span className="shrink-0 text-sm font-semibold tabular-nums text-[#006837]">{persen(g.capaian_persen)}</span>
                      : <BadgeStatusPenilaian status={g.status} />}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
