import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, Armchair, ArrowLeft, Camera, CameraOff, Download, Eye, IdCard, Loader2, PenLine, RefreshCw } from 'lucide-react';
import AksesDitolak from '@/components/security/AksesDitolak';
import PilihUjian from '@/components/ujian/PilihUjian';
import PratinjauDokumenDialog from '@/components/ujian/PratinjauDokumenDialog';
import { HALAMAN_BERANDA_UJIAN, aksesDitolak, pesanGalat } from '@/lib/ujian';
import { simpanBerkas } from '@/lib/ujianPeserta';
import { FOTO_BAWAAN, HALAMAN_KARTU, JENIS_KARTU, OPSI_FOTO, jenisDariPath, jumlahHalaman, muatPilihanKartu, unduhKartu } from '@/lib/ujianKartu';

const IKON = { peserta: IdCard, meja: Armchair };
const IKON_FOTO = { pakai: Camera, tanpa: CameraOff };
const SEMUA = '';

/** Pengaturan foto kartu: "Pakai foto" atau "Tanpa foto". */
function OpsiFoto({ nilai, onUbah, adaFoto, total }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Foto di kartu</p>
      <div className="inline-flex w-full rounded-lg border border-slate-200 bg-white p-1 sm:w-auto" role="radiogroup" aria-label="Foto di kartu" data-testid="opsi-foto-kartu">
        {Object.entries(OPSI_FOTO).map(([k, o]) => {
          const Ikon = IKON_FOTO[k];
          const aktif = nilai === k;
          return (
            <button key={k} type="button" role="radio" aria-checked={aktif} onClick={() => onUbah(k)} data-testid={`opsi-foto-${k}`}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006837] sm:flex-none ${
                aktif ? 'bg-[#006837] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
              <Ikon className="h-4 w-4 shrink-0" /> {o.label}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-slate-500">
        {OPSI_FOTO[nilai].ket}
        {nilai === 'pakai' && total > 0 && (
          <> <span className={adaFoto < total ? 'text-amber-700' : 'text-emerald-700'} data-testid="info-jumlah-foto">
            {adaFoto} dari {total} peserta sudah punya pas foto
          </span> (diambil dari dokumen Pas Foto siswa).</>
        )}
      </p>
    </div>
  );
}

/** Kartu pilihan ruang (atau "Semua Ruang"): jumlah peserta, halaman A4, dan peserta yang belum bernomor. */
function KartuRuang({ judul, sub, peserta, halaman, tanpaNomor, aktif, onPilih, testid }) {
  const kosong = !peserta;
  return (
    <button type="button" role="radio" aria-checked={aktif} onClick={onPilih} disabled={kosong} data-testid={testid}
      className={`flex flex-col gap-1 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006837] disabled:cursor-not-allowed disabled:opacity-60 ${
        aktif ? 'border-[#006837] bg-emerald-50' : 'border-slate-200 bg-white enabled:hover:border-[#006837]/40'}`}>
      <span className="text-sm font-semibold text-slate-900">{judul}</span>
      {sub && <span className="text-xs text-slate-500">{sub}</span>}
      <span className="text-xs text-slate-500">{kosong ? 'Belum ada peserta' : `${peserta} peserta · ${halaman} halaman A4`}</span>
      {tanpaNomor > 0 && <span className="text-[11px] text-amber-700">{tanpaNomor} belum punya nomor peserta</span>}
    </button>
  );
}

/**
 * Kartu Peserta & Kartu Meja (/ujian/kartu-peserta dan /ujian/kartu-meja, ?ujian=<id>&ruang=<id>): cetak PDF A4 berisi
 * 8 kartu per halaman untuk satu ruang atau semua ruang (tiap ruang mulai halaman baru). Ruang terpilih tersimpan di URL
 * sehingga tetap sama saat berpindah tab. Admin, pimpinan, dan panitia ujian itu.
 */
export default function UjianKartuPage() {
  const lokasi = useLocation();
  const navigasi = useNavigate();
  const jenis = jenisDariPath(lokasi.pathname);
  const [ujian, setUjian] = useState(null);
  const [pilihan, setPilihan] = useState(null);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState('');
  const [ditolak, setDitolak] = useState('');
  const ruangId = new URLSearchParams(lokasi.search).get('ruang') || SEMUA;
  const setRuangId = useCallback((id) => {
    const q = new URLSearchParams(lokasi.search);
    if (id) q.set('ruang', id); else q.delete('ruang');
    navigasi(`${lokasi.pathname}?${q.toString()}`, { replace: true });
  }, [lokasi.pathname, lokasi.search, navigasi]);
  const [proses, setProses] = useState(null);
  const [pratinjau, setPratinjau] = useState(null);
  const [fotoPilih, setFotoPilih] = useState({});
  const foto = fotoPilih[jenis] || pilihan?.foto_bawaan || FOTO_BAWAAN[jenis];

  const muat = useCallback(async (u, j) => {
    if (!u) { setPilihan(null); return; }
    setMemuat(true);
    try {
      setPilihan(await muatPilihanKartu(u.id, j));
      setGalat('');
      setDitolak('');
    } catch (e) {
      setPilihan(null);
      if (aksesDitolak(e)) setDitolak(pesanGalat(e, 'Akses ditolak.'));
      else setGalat(pesanGalat(e, 'Gagal memuat pilihan kartu.'));
    } finally {
      setMemuat(false);
    }
  }, []);
  useEffect(() => { muat(ujian, jenis); }, [ujian, jenis, muat]);
  useEffect(() => {
    if (pilihan && ruangId && !pilihan.ruang.some((r) => r.id === ruangId && r.peserta > 0)) setRuangId(SEMUA);
  }, [pilihan, ruangId, setRuangId]);

  const gantiJenis = (j) => navigasi(`${HALAMAN_KARTU[j]}${lokasi.search}`, { replace: true });
  const perHalaman = pilihan?.kartu_per_halaman || 8;
  const ruangList = pilihan?.ruang || [];
  const terisi = ruangList.filter((r) => r.peserta > 0);
  const dipilih = ruangId ? ruangList.filter((r) => r.id === ruangId) : terisi;
  const totalPeserta = dipilih.reduce((n, r) => n + r.peserta, 0);
  const tanpaNomor = dipilih.reduce((n, r) => n + (r.tanpa_nomor || 0), 0);
  const adaFoto = dipilih.reduce((n, r) => n + (r.ada_foto || 0), 0);
  const namaRuang = ruangId ? dipilih[0]?.nama_ruang : '';
  const judulDok = `${JENIS_KARTU[jenis].label} · ${ruangId ? `Ruang ${namaRuang}` : 'Semua Ruang'} · ${OPSI_FOTO[foto].label}`;

  const ambil = async (aksi) => {
    setProses(aksi);
    try {
      const h = await unduhKartu(ujian.id, jenis, ruangId, namaRuang, foto);
      if (aksi === 'lihat' && !h.tiruan) setPratinjau({ blob: h.blob, nama: h.nama, judul: judulDok });
      else {
        simpanBerkas(h.blob, h.nama);
        setPratinjau(null);
        toast.success(`${judulDok} diunduh${h.tiruan ? ' (contoh)' : ''}`);
      }
    } catch (e) {
      toast.error(pesanGalat(e, 'Gagal membuat kartu.'));
    } finally {
      setProses(null);
    }
  };
  const Ikon = IKON[jenis];

  return (
    <div className="space-y-6" data-testid="ujian-kartu">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <Link to={HALAMAN_BERANDA_UJIAN} className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-[#006837] hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> Beranda Ujian
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2">
            <IdCard className="h-7 w-7 shrink-0 text-[#006837]" /> Kartu Peserta & Kartu Meja
          </h1>
          <p className="text-sm text-slate-600 mt-1">Cetak kartu peserta dan kartu meja ujian per ruang di kertas A4 — 8 kartu per halaman, tinggal digunting.</p>
        </div>
        <Button variant="outline" onClick={() => muat(ujian, jenis)} disabled={memuat || !ujian} className="gap-2 self-start sm:self-auto" data-testid="btn-muat-ulang-kartu">
          {memuat ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Muat Ulang
        </Button>
      </div>

      <PilihUjian onUbah={setUjian} />

      <Tabs value={jenis} onValueChange={gantiJenis}>
        <TabsList>
          <TabsTrigger value="peserta" className="gap-1" data-testid="tab-kartu-peserta"><IdCard className="h-4 w-4" /> Kartu Peserta</TabsTrigger>
          <TabsTrigger value="meja" className="gap-1" data-testid="tab-kartu-meja"><Armchair className="h-4 w-4" /> Kartu Meja</TabsTrigger>
        </TabsList>
      </Tabs>

      {ditolak && <AksesDitolak halaman={JENIS_KARTU[jenis].label} untuk="admin, pimpinan, dan panitia ujian ini" pesan={ditolak} />}
      {pilihan?.tiruan && <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" data-testid="info-tiruan-kartu">Server belum menyediakan layanan kartu — menampilkan data contoh.</p>}
      {galat && <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800" role="alert"><AlertTriangle className="h-4 w-4 shrink-0" /> {galat}</div>}

      {!ditolak && pilihan && (
        <Card data-testid={`panel-kartu-${jenis}`}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Ikon className="h-4 w-4 text-[#006837]" /> Cetak {JENIS_KARTU[jenis].label}</CardTitle>
            <p className="text-xs text-slate-500">{JENIS_KARTU[jenis].ket} Kertas A4 tegak, {perHalaman} kartu per halaman; setiap ruang dimulai di halaman baru.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {!terisi.length ? (
              <p className="py-4 text-center text-sm text-slate-500">
                Belum ada peserta di ruang ujian. Tetapkan peserta di <Link to={`/ujian/ruang${lokasi.search}`} className="font-medium text-[#006837] hover:underline">Ruang & Peserta</Link>.
              </p>
            ) : (
              <>
                {jenis === 'peserta' && (pilihan.ketua ? (
                  <p className="flex items-start gap-2 text-xs text-slate-600" data-testid="info-ketua-kartu">
                    <PenLine className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#006837]" />
                    <span>Ditandatangani Ketua Panitia: <strong>{pilihan.ketua.nama}</strong>{pilihan.ketua.nip ? ` · NIP ${pilihan.ketua.nip}` : ''}</span>
                  </p>
                ) : (
                  <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" data-testid="info-ketua-kosong">
                    Ketua Panitia ujian ini belum ditetapkan — nama penanda tangan kartu dicetak titik-titik. Tetapkan di menu Kepanitiaan.
                  </p>
                ))}
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ruang</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" role="radiogroup" aria-label="Ruang" data-testid="pilih-ruang-kartu">
                    <KartuRuang judul="Semua Ruang" sub={`${terisi.length} ruang`} peserta={terisi.reduce((n, r) => n + r.peserta, 0)}
                      halaman={jumlahHalaman(terisi, perHalaman)} tanpaNomor={terisi.reduce((n, r) => n + (r.tanpa_nomor || 0), 0)}
                      aktif={!ruangId} onPilih={() => setRuangId(SEMUA)} testid="kartu-ruang-semua" />
                    {ruangList.map((r) => (
                      <KartuRuang key={r.id} judul={`Ruang ${r.nama_ruang}`} sub={r.jenjang?.length ? `Kelas ${r.jenjang.join(' & ')}` : ''}
                        peserta={r.peserta} halaman={jumlahHalaman([r], perHalaman)} tanpaNomor={r.tanpa_nomor}
                        aktif={ruangId === r.id} onPilih={() => setRuangId(r.id)} testid={`kartu-ruang-${r.id}`} />
                    ))}
                  </div>
                </div>
                <OpsiFoto nilai={foto} onUbah={(f) => setFotoPilih((x) => ({ ...x, [jenis]: f }))} adaFoto={adaFoto} total={totalPeserta} />
                {tanpaNomor > 0 && (
                  <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" data-testid="info-tanpa-nomor">
                    {tanpaNomor} peserta belum punya nomor peserta — kartunya tetap dicetak dengan nomor "-". Lengkapi di{' '}
                    <Link to={`/ujian/ruang${lokasi.search}`} className="font-medium underline">Ruang & Peserta</Link>.
                  </p>
                )}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button variant="outline" onClick={() => ambil('lihat')} disabled={!!proses || !totalPeserta} className="h-11 gap-2 sm:flex-1" data-testid="btn-pratinjau-kartu">
                    {proses === 'lihat' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />} Pratinjau
                  </Button>
                  <Button onClick={() => ambil('unduh')} disabled={!!proses || !totalPeserta} className="h-11 gap-2 bg-[#006837] hover:bg-[#00552d] sm:flex-[2]" data-testid="btn-unduh-kartu">
                    {proses === 'unduh' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    Unduh PDF {JENIS_KARTU[jenis].label} ({totalPeserta} kartu · {jumlahHalaman(dipilih, perHalaman)} hal.)
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
      {!pilihan && memuat && <div className="p-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#006837]" /></div>}
      <PratinjauDokumenDialog pratinjau={pratinjau} onTutup={() => setPratinjau(null)} mencetak={proses === 'unduh'}
        onCetak={() => { simpanBerkas(pratinjau.blob, pratinjau.nama); toast.success(`${pratinjau.judul} diunduh`); setPratinjau(null); }} labelCetak="Unduh PDF" />
    </div>
  );
}
