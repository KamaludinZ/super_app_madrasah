import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Loader2, AlertTriangle, RotateCw, UserRound, MessageSquareText } from 'lucide-react';
import PenjagaMenuPkg from '@/components/pkg/PenjagaMenuPkg';
import BadgeStatusPenilaian from '@/components/pkg/BadgeStatusPenilaian';
import HasilAkhirPenilaian from '@/components/pkg/HasilAkhirPenilaian';
import { labelVersi } from '@/lib/pkgInstrumen';
import { hitungTingkat } from '@/lib/pkgPenilaian';
import { ambilModelKompetensi, ambilRekapGuru } from '@/lib/pkgRekap';
import { FormatPenghitungan, KartuLevelGuru, TabelModelKompetensi } from '@/components/pkg/RekapModelKompetensi';

// Tab "Model Kompetensi": rekap per kompetensi (04-RKAP-PKG) + format penghitungan NKG (05-RKAP-PKGR); dimuat saat dibuka.
function TabModelKompetensi({ guruId, periodeId }) {
  const [data, setData] = useState(null);
  const [galat, setGalat] = useState(null);
  const muat = useCallback(async () => {
    setGalat(null);
    try {
      setData(await ambilModelKompetensi(guruId, periodeId));
    } catch (e) {
      setGalat(e);
    }
  }, [guruId, periodeId]);
  useEffect(() => { muat(); }, [muat]);

  if (galat) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center" role="alert">
        <p className="text-sm text-slate-700">{galat.message}</p>
        <Button variant="outline" size="sm" onClick={muat} className="gap-2"><RotateCw className="h-4 w-4" /> Coba lagi</Button>
      </div>
    );
  }
  if (!data) return <div className="p-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#006837]" /></div>;
  if (!data.model) return <p className="py-10 text-center text-sm text-slate-500">Model kompetensi tersedia setelah lembar dikunci.</p>;
  return (
    <div className="space-y-4">
      <KartuLevelGuru levelGuru={data.level_guru} />
      <TabelModelKompetensi model={data.model} />
      <FormatPenghitungan model={data.model} />
    </div>
  );
}

function IsiRekapGuru() {
  const { guruId } = useParams();
  const [searchParams] = useSearchParams();
  const periodeId = searchParams.get('periode') || undefined;
  const [data, setData] = useState(null);
  const [galat, setGalat] = useState(null);

  const muat = useCallback(async () => {
    setGalat(null);
    try {
      setData(await ambilRekapGuru(guruId, periodeId));
    } catch (e) {
      setGalat(e);
    }
  }, [guruId, periodeId]);

  useEffect(() => { muat(); }, [muat]);

  if (galat) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center" role="alert">
        <AlertTriangle className="h-8 w-8 text-amber-600" />
        <p className="text-sm text-slate-700">{galat.message || 'Gagal memuat rekap guru.'}</p>
        <Button variant="outline" size="sm" onClick={muat} className="gap-2"><RotateCw className="h-4 w-4" /> Coba lagi</Button>
      </div>
    );
  }
  if (!data) return <div className="p-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#006837]" /></div>;

  const kompetensi = data.instrumen?.kompetensi || [];

  return (
    <div className="space-y-4" data-testid="pkg-rekap-guru">
      <Link to={periodeId ? `/pkg/rekap?periode=${periodeId}` : '/pkg/rekap'} className="inline-flex items-center gap-1 text-sm text-[#006837] hover:underline"><ArrowLeft className="h-4 w-4" /> Rekap</Link>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[#006837]"><UserRound className="h-6 w-6" /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">{data.guru.nama}</h2>
            <BadgeStatusPenilaian status={data.status} />
          </div>
          <p className="text-xs text-slate-500">
            {data.guru.mapel || '-'} · NIP {data.guru.nip || '-'} · Penilai: {data.penilai_nama || '-'} · {data.periode?.nama_periode}
          </p>
        </div>
        {data.instrumen && <Badge variant="outline" className="shrink-0">{labelVersi(data.instrumen)}</Badge>}
      </div>

      {data.status !== 'terkunci' ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-slate-500">
            Penilaian guru ini belum dikirim &amp; dikunci; nilai akhir belum tersedia.
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="ringkasan" className="space-y-4">
          <TabsList className="flex h-auto flex-wrap justify-start">
            <TabsTrigger value="ringkasan" data-testid="pkg-rekap-guru-tab-ringkasan">Ringkasan</TabsTrigger>
            <TabsTrigger value="model" data-testid="pkg-rekap-guru-tab-model">Model Kompetensi</TabsTrigger>
          </TabsList>
          <TabsContent value="ringkasan" className="space-y-4">
            <HasilAkhirPenilaian hasil={data.hasil} kompetensi={kompetensi} isian={data.isian} />

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Rincian per Sub-kompetensi</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {kompetensi.map((k) => (
                  <div key={k.kode} className="space-y-2">
                    <h3 className="text-sm font-semibold text-slate-900">{k.kode}. {k.nama}</h3>
                    {k.sub.map((s) => {
                      const isi = data.isian?.[s.kode] || {};
                      const skor = hitungTingkat(isi.centang);
                      return (
                        <div key={s.kode} className="rounded-lg border border-slate-200 p-3" data-testid={`pkg-rekap-sub-${s.kode}`}>
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm text-slate-800"><span className="mr-1 font-mono text-xs text-slate-500">{s.kode}</span>{s.nama}</p>
                            <Badge variant="outline" className="shrink-0 tabular-nums">{skor ? `Level ${skor}` : '-'}</Badge>
                          </div>
                          {(isi.catatan_bukti || isi.tanggapan) && (
                            <dl className="mt-2 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                              {isi.catatan_bukti && <div><dt className="text-slate-500">Bukti fisik</dt><dd className="text-slate-700">{isi.catatan_bukti}</dd></div>}
                              {isi.tanggapan && <div><dt className="text-slate-500">Tanggapan penilai</dt><dd className="text-slate-700">{isi.tanggapan}</dd></div>}
                            </dl>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </CardContent>
            </Card>

            {data.catatan_umum && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><MessageSquareText className="h-4 w-4 text-[#006837]" /> Catatan Evaluasi</CardTitle></CardHeader>
                <CardContent><p className="text-sm text-slate-700 whitespace-pre-line">{data.catatan_umum}</p></CardContent>
              </Card>
            )}
          </TabsContent>
          <TabsContent value="model">
            <TabModelKompetensi guruId={guruId} periodeId={periodeId} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// Rekap per guru: nilai akhir, capaian, predikat, rincian skor per sub-kompetensi, bukti & tanggapan, catatan
// evaluasi, serta tab model kompetensi & format penghitungan (cakupan menurut peran; lib/pkgRekap ->
// /pkg/rekap/guru/{id} dan /pkg/rekap/guru/{id}/kompetensi).
export default function PkgRekapGuruPage() {
  return (
    <PenjagaMenuPkg menuKey="rekap">
      <IsiRekapGuru />
    </PenjagaMenuPkg>
  );
}
