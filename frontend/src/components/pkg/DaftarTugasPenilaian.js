import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { ClipboardList, Search, FileBadge, ShieldAlert, Play, PencilLine, Eye } from 'lucide-react';

const STATUS_TUGAS = {
  belum: { label: 'Belum dimulai', kelas: 'bg-slate-100 text-slate-700 border-slate-200', aksi: 'Mulai', ikon: Play },
  draf: { label: 'Draf', kelas: 'bg-amber-100 text-amber-700 border-amber-200', aksi: 'Lanjutkan', ikon: PencilLine },
  terkunci: { label: 'Terkunci', kelas: 'bg-emerald-100 text-emerald-700 border-emerald-200', aksi: 'Lihat', ikon: Eye },
};

const FILTER = [
  { key: 'semua', label: 'Semua' },
  { key: 'belum', label: 'Belum' },
  { key: 'draf', label: 'Draf' },
  { key: 'terkunci', label: 'Terkunci' },
];

// Tugas Penilaian Saya: guru yang dibagikan kepala madrasah kepada pengguna (penilai) pada SK aktif.
// Lembar penilaian baru bisa dibuka setelah penilai disupervisi kepala madrasah.
// `tugas` = [{ id, nama, nip, mapel, status, progres }], `keanggotaan` = { nomor_sk, peran, supervisi_selesai }.
export default function DaftarTugasPenilaian({ tugas = [], keanggotaan }) {
  const [cari, setCari] = useState('');
  const [filter, setFilter] = useState('semua');
  const penilai = keanggotaan?.peran !== 'dinilai';
  const bolehMenilai = !!keanggotaan?.supervisi_selesai;

  const jumlahPerStatus = useMemo(() => tugas.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, { semua: tugas.length }), [tugas]);

  const tampil = useMemo(() => {
    const kata = cari.trim().toLowerCase();
    return tugas
      .filter((t) => filter === 'semua' || t.status === filter)
      .filter((t) => !kata || [t.nama, t.nip, t.mapel].some((v) => (v || '').toLowerCase().includes(kata)));
  }, [tugas, cari, filter]);

  return (
    <Card data-testid="pkg-tugas-saya">
      <CardHeader className="pb-3 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-[#006837]" /> Tugas Penilaian Saya
          </CardTitle>
          <Badge variant="outline">{tugas.length} guru</Badge>
        </div>
        {keanggotaan?.nomor_sk && (
          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <FileBadge className="h-3.5 w-3.5" /> SK {keanggotaan.nomor_sk}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {penilai && !bolehMenilai && (
          <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" data-testid="pkg-tugas-belum-supervisi">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <span>Anda belum disupervisi kepala madrasah pada periode ini. Lembar penilaian dapat dibuka setelah supervisi tercatat.</span>
          </div>
        )}

        {tugas.length > 0 && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={cari}
                onChange={(e) => setCari(e.target.value)}
                placeholder="Cari nama, NIP, atau mapel"
                className="pl-8 h-9"
                data-testid="pkg-tugas-cari"
              />
            </div>
            <div className="flex gap-1 overflow-x-auto" role="group" aria-label="Saring status">
              {FILTER.map((f) => (
                <Button
                  key={f.key}
                  type="button"
                  size="sm"
                  variant={filter === f.key ? 'default' : 'outline'}
                  className={`h-8 shrink-0 ${filter === f.key ? 'bg-[#006837] hover:bg-[#005830]' : ''}`}
                  onClick={() => setFilter(f.key)}
                  aria-pressed={filter === f.key}
                  data-testid={`pkg-tugas-filter-${f.key}`}
                >
                  {f.label} <span className="ml-1 tabular-nums opacity-70">{jumlahPerStatus[f.key] || 0}</span>
                </Button>
              ))}
            </div>
          </div>
        )}

        {tugas.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-6" data-testid="pkg-tugas-kosong">
            {penilai
              ? 'Belum ada guru yang dibagikan kepada Anda pada periode ini. Pembagian dilakukan oleh kepala madrasah.'
              : 'Anda terdaftar sebagai guru yang dinilai pada periode ini, bukan sebagai penilai. Hasil penilaian dapat dilihat setelah dikunci.'}
          </p>
        )}
        {tugas.length > 0 && tampil.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-6">Tidak ada guru yang cocok dengan pencarian.</p>
        )}

        <div className="space-y-2">
          {tampil.map((t) => {
            const status = STATUS_TUGAS[t.status] || STATUS_TUGAS.belum;
            const IkonAksi = status.ikon;
            const terbuka = bolehMenilai || t.status === 'terkunci';
            return (
              <div key={t.id} className="flex flex-col gap-3 rounded-lg border border-slate-200 p-3 sm:flex-row sm:items-center" data-testid={`pkg-tugas-${t.id}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">{t.nama}</span>
                    <Badge className={status.kelas}>{status.label}</Badge>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">{t.mapel} · NIP {t.nip || '-'}</div>
                  <div className="flex items-center gap-2 mt-2">
                    <Progress value={t.progres} className="h-1.5 flex-1" aria-label={`Progres penilaian ${t.progres}%`} />
                    <span className="text-[11px] tabular-nums text-slate-500 w-9 text-right">{t.progres}%</span>
                  </div>
                </div>
                {terbuka ? (
                  <Button asChild size="sm" variant={t.status === 'terkunci' ? 'outline' : 'default'} className={t.status === 'terkunci' ? 'shrink-0' : 'shrink-0 bg-[#006837] hover:bg-[#005830]'}>
                    <Link to={`/pkg/penilaian/${t.id}`} data-testid={`pkg-tugas-aksi-${t.id}`}>
                      <IkonAksi className="h-3.5 w-3.5 mr-1" /> {status.aksi}
                    </Link>
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="shrink-0" disabled data-testid={`pkg-tugas-aksi-${t.id}`}>
                    <IkonAksi className="h-3.5 w-3.5 mr-1" /> {status.aksi}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
