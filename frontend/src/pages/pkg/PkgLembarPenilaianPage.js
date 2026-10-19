import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Loader2, AlertTriangle, RotateCw, UserRound } from 'lucide-react';
import PenjagaMenuPkg from '@/components/pkg/PenjagaMenuPkg';
import KartuSubPenilaian from '@/components/pkg/KartuSubPenilaian';
import { labelVersi } from '@/lib/pkgInstrumen';
import { BATAS_TEKS, ambilLembar, hitungNilai, validasiLembar } from '@/lib/pkgPenilaian';

const STATUS = {
  belum: { label: 'Belum dimulai', kelas: 'bg-slate-100 text-slate-700 border-slate-200' },
  draf: { label: 'Draf', kelas: 'bg-amber-100 text-amber-700 border-amber-200' },
  terkunci: { label: 'Terkunci', kelas: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
};

const FORMAT_PERSEN = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function IsiLembar() {
  const { guruId } = useParams();
  const [lembar, setLembar] = useState(null);
  const [isian, setIsian] = useState({});
  const [catatanUmum, setCatatanUmum] = useState('');
  // true setelah penilai mencoba mengirim: penanda isian kosong ditampilkan lebih tegas.
  const [tegas, setTegas] = useState(false);
  const [galat, setGalat] = useState(null);

  const muat = useCallback(async () => {
    setGalat(null);
    try {
      const l = await ambilLembar(guruId);
      setLembar(l);
      setIsian(l.isian || {});
      setCatatanUmum(l.catatan_umum || '');
    } catch (e) {
      setGalat(e);
    }
  }, [guruId]);

  useEffect(() => { muat(); }, [muat]);

  const nilai = useMemo(() => hitungNilai(lembar?.instrumen?.kompetensi, isian), [lembar, isian]);
  const validasi = useMemo(() => validasiLembar(lembar?.instrumen?.kompetensi, isian), [lembar, isian]);

  if (galat) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center" role="alert">
        <AlertTriangle className="h-8 w-8 text-amber-600" />
        <p className="text-sm text-slate-700">{galat.message}</p>
        <Button variant="outline" size="sm" onClick={muat} className="gap-2"><RotateCw className="h-4 w-4" /> Coba lagi</Button>
      </div>
    );
  }
  if (!lembar) return <div className="p-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#006837]" /></div>;

  const terkunci = lembar.status === 'terkunci';
  const status = STATUS[lembar.status] || STATUS.belum;
  const ubahSub = (kode) => (baru) => setIsian((x) => ({ ...x, [kode]: baru }));
  // Tegaskan penanda isian bermasalah dan gulir ke yang pertama; true bila lembar sudah lengkap.
  const periksaKelengkapan = () => {
    setTegas(true);
    const pertama = Object.keys(validasi.galat)[0];
    if (pertama) document.getElementById(`sub-${pertama}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return validasi.sah;
  };

  return (
    <div className="space-y-4" data-testid="pkg-lembar">
      <Link to="/pkg/penilaian" className="inline-flex items-center gap-1 text-sm text-[#006837] hover:underline"><ArrowLeft className="h-4 w-4" /> Daftar tugas</Link>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[#006837]"><UserRound className="h-6 w-6" /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">{lembar.guru.nama}</h2>
            <Badge className={status.kelas}>{status.label}</Badge>
          </div>
          <p className="text-xs text-slate-500">{lembar.guru.mapel || '-'} · NIP {lembar.guru.nip || '-'} · {lembar.periode?.nama_periode}</p>
        </div>
        <Badge variant="outline" className="shrink-0" title="Instrumen yang dipakai lembar ini">{labelVersi(lembar.instrumen)}</Badge>
      </div>

      <div className="sticky top-0 z-10 rounded-xl border border-emerald-200 bg-emerald-50/95 p-3 backdrop-blur" data-testid="pkg-lembar-ringkasan">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
          <span>Nilai <span className="text-lg font-bold tabular-nums text-[#006837]">{nilai.total}</span><span className="text-slate-500">/{nilai.maks}</span></span>
          <span>Capaian <span className="font-bold tabular-nums text-[#006837]">{FORMAT_PERSEN.format(nilai.persen)}%</span></span>
          <span className="text-slate-600">Sub-kompetensi dinilai <span className="font-semibold tabular-nums">{nilai.terisi}/{nilai.jumlahSub}</span></span>
          {!terkunci && (
            <Button type="button" size="sm" variant="outline" className="ml-auto h-7 bg-white text-xs" onClick={periksaKelengkapan} data-testid="pkg-lembar-periksa">
              Periksa kelengkapan
            </Button>
          )}
        </div>
        <Progress value={nilai.jumlahSub ? (nilai.terisi / nilai.jumlahSub) * 100 : 0} className="mt-2 h-1.5" aria-label="Kelengkapan penilaian" />
        {!terkunci && !validasi.sah && (
          <div className={`mt-2 text-xs ${tegas ? 'text-rose-700' : 'text-amber-800'}`} data-testid="pkg-lembar-belum-lengkap">
            <span className="font-semibold">{Object.keys(validasi.galat).length} sub-kompetensi perlu dilengkapi:</span>{' '}
            {Object.keys(validasi.galat).map((kode, i) => (
              <React.Fragment key={kode}>
                {i > 0 && ', '}
                <a href={`#sub-${kode}`} className="font-mono underline underline-offset-2 hover:text-rose-900">{kode}</a>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {lembar.instrumen.kompetensi.map((k) => (
        <section key={k.kode} aria-labelledby={`komp-${k.kode}`} className="space-y-3">
          <h3 id={`komp-${k.kode}`} className="flex items-center gap-2 text-base font-bold text-slate-900">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-sm text-[#006837]">{k.kode}</span> {k.nama}
          </h3>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {k.sub.map((s) => (
              <KartuSubPenilaian key={s.kode} sub={s} isian={isian[s.kode]} terkunci={terkunci} onUbah={ubahSub(s.kode)}
                galat={validasi.galat[s.kode]} tegas={tegas} />
            ))}
          </div>
        </section>
      ))}

      <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-1" aria-labelledby="catatan-umum">
        <div className="flex items-baseline justify-between">
          <Label id="catatan-umum" htmlFor="catatan-umum-isian" className="text-sm font-semibold text-slate-900">Catatan umum &amp; rekomendasi</Label>
          <span className="text-[10px] tabular-nums text-slate-400">{catatanUmum.length}/{BATAS_TEKS}</span>
        </div>
        <Textarea id="catatan-umum-isian" value={catatanUmum} onChange={(e) => setCatatanUmum(e.target.value.slice(0, BATAS_TEKS))}
          rows={3} maxLength={BATAS_TEKS} disabled={terkunci} placeholder="Kekuatan, area pengembangan, dan rekomendasi untuk guru"
          data-testid="pkg-lembar-catatan-umum" />
      </section>
    </div>
  );
}

// Lembar penilaian kompetensi satu guru (penilai tersupervisi/kepala): ceklist indikator per sub-kompetensi dengan
// tingkat & nilai dihitung otomatis. Data sementara dari lib/pkgPenilaian (tiruan).
export default function PkgLembarPenilaianPage() {
  return (
    <PenjagaMenuPkg menuKey="penilaian">
      <IsiLembar />
    </PenjagaMenuPkg>
  );
}
