import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Loader2, AlertTriangle, RotateCw, UserRound, Send, UserX, Repeat, CalendarX } from 'lucide-react';
import PenjagaMenuPkg from '@/components/pkg/PenjagaMenuPkg';
import PesanTolakPkg from '@/components/pkg/PesanTolakPkg';
import KartuSubPenilaian from '@/components/pkg/KartuSubPenilaian';
import StatusSimpanDraf from '@/components/pkg/StatusSimpanDraf';
import BadgeStatusPenilaian from '@/components/pkg/BadgeStatusPenilaian';
import HasilAkhirPenilaian from '@/components/pkg/HasilAkhirPenilaian';
import { confirmDialog } from '@/components/ui/confirm-dialog';
import useAutosaveDraf from '@/hooks/useAutosaveDraf';
import { labelVersi } from '@/lib/pkgInstrumen';
import { formatWIBPanjang } from '@/lib/datetime';
import { toast } from 'sonner';
import { BATAS_TEKS, ambilLembar, hitungHasilAkhir, hitungNilai, kirimLembar, simpanDraf, validasiLembar } from '@/lib/pkgPenilaian';

const FORMAT_PERSEN = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function IsiLembar() {
  const { guruId } = useParams();
  const { keanggotaan } = useOutletContext() || {};
  const [lembar, setLembar] = useState(null);
  const [isian, setIsian] = useState({});
  const [catatanUmum, setCatatanUmum] = useState('');
  // true setelah penilai mencoba mengirim: penanda isian kosong ditampilkan lebih tegas.
  const [tegas, setTegas] = useState(false);
  const [mengirim, setMengirim] = useState(false);
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

  const kompetensi = lembar?.instrumen?.kompetensi;
  const simpan = useCallback(
    (data) => simpanDraf(guruId, { isian: data.isian, catatanUmum: data.catatanUmum, kompetensi }),
    [guruId, kompetensi],
  );
  const draf = useAutosaveDraf({
    data: { isian, catatanUmum },
    simpan,
    aktif: !!lembar && lembar.status !== 'terkunci' && lembar.dapat_diisi !== false && keanggotaan?.dalam_masa_penilaian !== false,
    tersimpanAwal: lembar?.updated_at || null,
  });
  const simpanManual = () => draf.simpanSekarang().catch((e) => toast.error(e.message || 'Gagal menyimpan draf'));

  // Kirim & kunci: periksa kelengkapan -> simpan draf terakhir -> konfirmasi ringkasan -> kunci permanen.
  const kirim = async () => {
    setTegas(true);
    if (!validasi.sah) {
      const pertama = Object.keys(validasi.galat)[0];
      document.getElementById(`sub-${pertama}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      toast.error(`${Object.keys(validasi.galat).length} sub-kompetensi belum dinilai.`);
      return;
    }
    const h = hitungHasilAkhir(kompetensi, isian);
    const ok = await confirmDialog(
      `Kirim dan kunci penilaian ${lembar.guru.nama}? Nilai ${h.nilai_akhir}/${h.nilai_maks} (${h.capaian_persen.toLocaleString('id-ID')}%, ${h.level_capaian}). `
      + 'Setelah dikunci, lembar tidak dapat diubah lagi.',
      { title: 'Kirim & Kunci Penilaian', confirmText: 'Kirim & kunci' },
    );
    if (!ok) return;
    setMengirim(true);
    try {
      const baru = await kirimLembar(guruId, { isian, catatanUmum, kompetensi });
      setLembar(baru);
      toast.success('Penilaian dikirim dan dikunci');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      toast.error(e.message || 'Gagal mengirim penilaian');
    } finally {
      setMengirim(false);
    }
  };

  if (galat?.penolakan) return <PesanTolakPkg penolakan={galat.penolakan} />;
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

  // Di luar masa penilaian lembar hanya dapat dibaca (server juga menolak penyimpanan).
  const diLuarMasa = keanggotaan?.dalam_masa_penilaian === false && lembar.status !== 'terkunci';
  const terkunci = lembar.status === 'terkunci' || diLuarMasa || lembar.dapat_diisi === false;
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
            <BadgeStatusPenilaian status={lembar.status} />
            {lembar.guru.akun_aktif === false && (
              <Badge variant="outline" className="gap-1 border-amber-300 text-amber-700" title="Identitas memakai snapshot periode"><UserX className="h-3 w-3" /> Akun nonaktif</Badge>
            )}
            {lembar.guru.juga_penilai && (
              <Badge variant="outline" className="gap-1 text-slate-600" title="Guru ini juga anggota tim penilai"><Repeat className="h-3 w-3" /> Juga penilai</Badge>
            )}
          </div>
          <p className="text-xs text-slate-500">{lembar.guru.mapel || '-'} · NIP {lembar.guru.nip || '-'} · {lembar.periode?.nama_periode}</p>
        </div>
        <Badge variant="outline" className="shrink-0" title="Instrumen yang dipakai lembar ini">{labelVersi(lembar.instrumen)}</Badge>
      </div>

      {diLuarMasa && (
        <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" role="status" data-testid="pkg-lembar-luar-masa">
          <CalendarX className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            Di luar masa penilaian
            {lembar.periode?.tanggal_buka && lembar.periode?.tanggal_tutup
              ? ` (${formatWIBPanjang(lembar.periode.tanggal_buka, false)} – ${formatWIBPanjang(lembar.periode.tanggal_tutup, false)})` : ''}.
            {' '}Lembar hanya dapat dilihat.
          </span>
        </div>
      )}

      {lembar.status === 'terkunci' && <HasilAkhirPenilaian hasil={lembar.hasil} kompetensi={lembar.instrumen.kompetensi} isian={isian} />}

      <div className="sticky top-0 z-10 rounded-xl border border-emerald-200 bg-emerald-50/95 p-3 backdrop-blur" data-testid="pkg-lembar-ringkasan">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
          <span>Nilai <span className="text-lg font-bold tabular-nums text-[#006837]">{nilai.total}</span><span className="text-slate-500">/{nilai.maks}</span></span>
          <span>Capaian <span className="font-bold tabular-nums text-[#006837]">{FORMAT_PERSEN.format(nilai.persen)}%</span></span>
          <span className="text-slate-600">Sub-kompetensi dinilai <span className="font-semibold tabular-nums">{nilai.terisi}/{nilai.jumlahSub}</span></span>
          {!terkunci && (
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <StatusSimpanDraf status={draf.status} tersimpanPada={draf.tersimpanPada} onSimpan={simpanManual} />
              <Button type="button" size="sm" variant="outline" className="h-7 bg-white text-xs" onClick={periksaKelengkapan} data-testid="pkg-lembar-periksa">
                Periksa kelengkapan
              </Button>
              <Button type="button" size="sm" className="h-7 gap-1 bg-[#006837] text-xs hover:bg-[#005830]" onClick={kirim}
                disabled={mengirim || draf.status === 'menyimpan'} data-testid="pkg-lembar-kirim">
                {mengirim ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Kirim &amp; Kunci
              </Button>
            </div>
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
                galat={validasi.galat[s.kode]} peringatan={validasi.peringatan[s.kode]} tegas={tegas} />
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
// tingkat & nilai dihitung otomatis (lib/pkgPenilaian -> /pkg/penilaian/*).
export default function PkgLembarPenilaianPage() {
  return (
    <PenjagaMenuPkg menuKey="penilaian">
      <IsiLembar />
    </PenjagaMenuPkg>
  );
}
