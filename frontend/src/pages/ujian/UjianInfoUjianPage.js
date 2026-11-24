import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertTriangle, ArrowLeft, BookOpenText, ExternalLink, Eye, Info, Link2, Loader2, MonitorPlay, RefreshCw, Save, ScrollText, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import AksesDitolak from '@/components/security/AksesDitolak';
import PilihUjian from '@/components/ujian/PilihUjian';
import PanelPdfPanduan from '@/components/ujian/info/PanelPdfPanduan';
import TataTertibUjian from '@/components/ujian/publik/info/TataTertibUjian';
import PanduanCbt from '@/components/ujian/publik/info/PanduanCbt';
import { LencanaStatusTautan } from '@/components/ujian/tautan/KartuTautanPublik';
import { formatWIBPanjang } from '@/lib/datetime';
import { HALAMAN_BERANDA_UJIAN, aksesDitolak, pesanGalat } from '@/lib/ujian';
import { TATA_TERTIB_CONTOH, urlVideoAman } from '@/lib/ujianInfoPublik';
import { HALAMAN_TAUTAN_PUBLIK, urlTautan } from '@/lib/ujianTautanPublik';
import {
  PANDUAN_KETERANGAN_MAKS, TATA_TERTIB_MAKS, bukaPanduanPdfAdmin, galatIsianInfo, isianDariKonten, isianSama, muatInfoKonten,
  rapikanTataTertib, simpanInfoKonten,
} from '@/lib/ujianInfoKonten';

function Penghitung({ nilai, maks, testId }) {
  const lewat = nilai > maks;
  return (
    <span className={`text-xs tabular-nums ${lewat ? 'font-semibold text-rose-600' : 'text-slate-400'}`} data-testid={testId}>
      {nilai.toLocaleString('id-ID')} / {maks.toLocaleString('id-ID')}
    </span>
  );
}

function GalatField({ pesan, id }) {
  return pesan ? <p id={id} className="text-xs text-rose-600" role="alert">{pesan}</p> : null;
}

/** Status tautan info + pintasan membuka halaman siswa dan mengatur tautannya. */
function StatusHalamanSiswa({ tautan, ujianId }) {
  if (!tautan) return null;
  const url = urlTautan(tautan);
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between" data-testid="status-halaman-siswa">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-800">
          Halaman informasi ujian siswa <LencanaStatusTautan tautan={tautan} testId="status-tautan-info" />
        </div>
        {!tautan.berlaku && (
          <p className="text-xs text-slate-500">Isian tetap bisa disiapkan. Siswa baru dapat membukanya setelah tautan dibuka di menu Tautan Publik.</p>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {url && (
          <Button asChild variant="outline" size="sm" className="h-8 gap-1.5">
            <a href={url} target="_blank" rel="noopener noreferrer" data-testid="buka-halaman-siswa"><ExternalLink className="h-3.5 w-3.5" /> Buka halaman siswa</a>
          </Button>
        )}
        <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 text-[#006837]">
          <Link to={`${HALAMAN_TAUTAN_PUBLIK}?ujian=${encodeURIComponent(ujianId)}`} data-testid="atur-tautan-info"><Link2 className="h-3.5 w-3.5" /> Atur tautan</Link>
        </Button>
      </div>
    </div>
  );
}

/**
 * Info Ujian (/ujian/info-ujian?ujian=<id>): isi tata tertib dan panduan CBT (tautan video, keterangan, PDF) yang tampil di
 * halaman informasi ujian siswa (/publik/info-ujian/:token), dengan pratinjau langsung. Admin mengubah; kepala madrasah,
 * waka kurikulum, serta ketua & sekretaris panitia melihat. Teks disimpan dengan tombol Simpan (dicek versi agar tidak
 * menimpa isian admin lain); PDF panduan langsung tersimpan saat diunggah/dihapus.
 */
export default function UjianInfoUjianPage() {
  const [ujian, setUjian] = useState(null);
  const [data, setData] = useState(null);
  const [isian, setIsian] = useState(isianDariKonten(null));
  const [memuat, setMemuat] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);
  const [galat, setGalat] = useState('');
  const [galatSimpan, setGalatSimpan] = useState(null); // { pesan, bentrok }
  const [ditolak, setDitolak] = useState('');

  const muat = useCallback(async (u) => {
    if (!u) { setData(null); return; }
    setMemuat(true);
    try {
      const d = await muatInfoKonten(u.id);
      setData(d);
      setIsian(isianDariKonten(d.konten));
      setGalat('');
      setGalatSimpan(null);
      setDitolak('');
    } catch (e) {
      setData(null);
      if (aksesDitolak(e)) setDitolak(pesanGalat(e, 'Akses ditolak.'));
      else setGalat(pesanGalat(e, 'Gagal memuat info ujian.'));
    } finally {
      setMemuat(false);
    }
  }, []);
  const gantiUjian = useCallback((u) => { setUjian(u); muat(u); }, [muat]);

  const bolehUbah = !!data?.boleh_ubah;
  const tersimpan = useMemo(() => isianDariKonten(data?.konten), [data?.konten]);
  const berubah = !!data && bolehUbah && !isianSama(isian, tersimpan);
  const galatIsian = galatIsianInfo(isian);
  const adaGalat = Object.keys(galatIsian).length > 0;

  // Peringatan saat menutup/memuat ulang tab dengan perubahan yang belum disimpan.
  useEffect(() => {
    if (!berubah) return undefined;
    const tahan = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', tahan);
    return () => window.removeEventListener('beforeunload', tahan);
  }, [berubah]);

  const ubah = (field) => (e) => { setIsian((s) => ({ ...s, [field]: e.target.value })); setGalatSimpan(null); };

  const simpan = async () => {
    if (!berubah || adaGalat || menyimpan) return;
    setMenyimpan(true);
    try {
      const r = await simpanInfoKonten(ujian.id, isian, data.konten?.versi);
      setData((d) => ({ ...d, tiruan: d.tiruan || r.tiruan, konten: r.konten }));
      setIsian(isianDariKonten(r.konten));
      setGalatSimpan(null);
      toast.success('Info ujian disimpan', { description: 'Tata tertib dan panduan langsung tampil di halaman siswa.' });
    } catch (e) {
      setGalatSimpan({ pesan: pesanGalat(e, 'Gagal menyimpan info ujian.'), bentrok: e?.response?.status === 409 });
    } finally {
      setMenyimpan(false);
    }
  };

  // PDF tersimpan sendiri: perbarui data tersimpan tanpa menimpa isian teks yang sedang diketik.
  const pdfBerubah = (konten, tiruan) => setData((d) => ({ ...d, tiruan: d.tiruan || tiruan, konten: { ...d.konten, panduan_pdf: konten.panduan_pdf } }));

  const pdf = data?.konten?.panduan_pdf || null;
  const pratinjauPanduan = {
    ada_pdf: !!pdf && pdf.ada_di_disk !== false,
    nama_file: pdf?.nama_file,
    video_url: urlVideoAman(isian.panduan_video_url.trim()) ? isian.panduan_video_url.trim() : null,
    keterangan: isian.panduan_keterangan.trim() || null,
  };
  const bukaPdf = async () => {
    try { await bukaPanduanPdfAdmin(ujian.id, data?.tiruan); } catch (e) { toast.error(pesanGalat(e, 'PDF panduan tidak dapat dibuka.')); }
  };

  return (
    <div className="space-y-6" data-testid="ujian-info-ujian">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link to={HALAMAN_BERANDA_UJIAN} className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-[#006837] hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> Beranda Ujian
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 sm:text-3xl">
            <BookOpenText className="h-7 w-7 text-[#006837]" /> Info Ujian
          </h1>
          <p className="mt-1 text-sm text-slate-600">Tata tertib dan panduan CBT yang dibaca siswa di halaman informasi ujian.</p>
        </div>
        <Button variant="outline" onClick={() => muat(ujian)} disabled={memuat || !ujian} className="gap-2 self-start sm:self-auto" data-testid="btn-muat-ulang-info">
          {memuat ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Muat Ulang
        </Button>
      </div>

      <PilihUjian onUbah={gantiUjian} />

      {ditolak && <AksesDitolak halaman="Info Ujian" untuk="admin, pimpinan, serta ketua dan sekretaris panitia ujian ini" pesan={ditolak} />}
      {data?.tiruan && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" data-testid="info-tiruan-info-ujian">
          Server belum menyediakan menu Info Ujian — menampilkan contoh untuk mencoba tampilan. Isian hanya tersimpan di tab ini.
        </p>
      )}
      {galat && (
        <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800" role="alert">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {galat}
        </div>
      )}
      {!data && memuat && <div className="p-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-[#006837]" /></div>}

      {!ditolak && data && (
        <>
          <StatusHalamanSiswa tautan={data.tautan_info} ujianId={ujian?.id} />
          {!bolehUbah && (
            <p className="flex items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800" data-testid="info-hanya-lihat">
              <Info className="h-4 w-4 shrink-0" /> Anda melihat sebagai pemantau. Info ujian hanya dapat diubah admin.
            </p>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
            <div className="min-w-0 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base"><ScrollText className="h-4 w-4 text-[#006837]" /> Tata Tertib Ujian</CardTitle>
                  <p className="text-xs text-slate-500">Awali baris dengan <b>1.</b> atau <b>-</b> agar tampil sebagai daftar bernomor atau berbutir. Baris lain tampil sebagai paragraf.</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Textarea value={isian.tata_tertib} onChange={ubah('tata_tertib')} readOnly={!bolehUbah} rows={14}
                    placeholder={bolehUbah ? 'Contoh:\n1. Hadir 15 menit sebelum ujian dimulai.\n2. Membawa kartu peserta ujian.' : 'Belum diisi.'}
                    className="font-mono text-sm leading-relaxed" aria-label="Tata tertib ujian" aria-invalid={!!galatIsian.tata_tertib}
                    aria-describedby={galatIsian.tata_tertib ? 'galat-tata-tertib' : undefined} data-testid="isian-tata-tertib" />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {bolehUbah && !isian.tata_tertib.trim() ? (
                      <Button type="button" variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs text-[#006837]"
                        onClick={() => setIsian((s) => ({ ...s, tata_tertib: TATA_TERTIB_CONTOH }))} data-testid="isi-contoh-tata-tertib">
                        <Sparkles className="h-3.5 w-3.5" /> Isi dengan contoh
                      </Button>
                    ) : <span />}
                    <Penghitung nilai={rapikanTataTertib(isian.tata_tertib).length} maks={TATA_TERTIB_MAKS} testId="hitung-tata-tertib" />
                  </div>
                  <GalatField pesan={galatIsian.tata_tertib} id="galat-tata-tertib" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base"><MonitorPlay className="h-4 w-4 text-[#006837]" /> Panduan CBT</CardTitle>
                  <p className="text-xs text-slate-500">Cara memakai aplikasi ujian berbasis komputer: video, PDF, atau keduanya.</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="isian-video">Tautan video panduan</Label>
                    <Input id="isian-video" type="url" inputMode="url" value={isian.panduan_video_url} onChange={ubah('panduan_video_url')} readOnly={!bolehUbah}
                      placeholder="https://www.youtube.com/watch?v=…" aria-invalid={!!galatIsian.panduan_video_url}
                      aria-describedby={galatIsian.panduan_video_url ? 'galat-video' : 'bantuan-video'} data-testid="isian-video" />
                    {galatIsian.panduan_video_url
                      ? <GalatField pesan={galatIsian.panduan_video_url} id="galat-video" />
                      : <p id="bantuan-video" className="text-xs text-slate-500">Video YouTube dapat diputar langsung di halaman siswa; tautan lain dibuka di tab baru. Kosongkan bila tidak ada.</p>}
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="isian-keterangan">Keterangan singkat</Label>
                      <Penghitung nilai={isian.panduan_keterangan.trim().length} maks={PANDUAN_KETERANGAN_MAKS} testId="hitung-keterangan" />
                    </div>
                    <Input id="isian-keterangan" value={isian.panduan_keterangan} onChange={ubah('panduan_keterangan')} readOnly={!bolehUbah}
                      placeholder="Mis. Tonton sebelum hari pertama ujian." aria-invalid={!!galatIsian.panduan_keterangan} data-testid="isian-keterangan" />
                    <GalatField pesan={galatIsian.panduan_keterangan} id="galat-keterangan" />
                  </div>
                  <PanelPdfPanduan ujianId={ujian?.id} pdf={pdf} bolehUbah={bolehUbah} tiruan={!!data.tiruan} onBerubah={pdfBerubah} />
                </CardContent>
              </Card>

              {bolehUbah && (
                <div className="sticky bottom-3 z-10 flex flex-col gap-2 rounded-xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between"
                  data-testid="bilah-simpan-info">
                  <div className="min-w-0 text-xs">
                    {galatSimpan ? (
                      <span className="flex flex-wrap items-center gap-x-2 text-rose-700" role="alert" data-testid="galat-simpan-info">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {galatSimpan.pesan}
                        {galatSimpan.bentrok && <button type="button" className="font-semibold underline" onClick={() => muat(ujian)}>Muat ulang</button>}
                      </span>
                    ) : berubah ? (
                      <span className="font-medium text-amber-700" data-testid="info-belum-disimpan">Ada perubahan yang belum disimpan.</span>
                    ) : data.konten?.diperbarui_pada ? (
                      <span className="text-slate-500">Tersimpan {formatWIBPanjang(data.konten.diperbarui_pada)}{data.konten.diperbarui_oleh_nama ? ` oleh ${data.konten.diperbarui_oleh_nama}` : ''}.</span>
                    ) : (
                      <span className="text-slate-500">Belum pernah diisi.</span>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {berubah && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => { setIsian(tersimpan); setGalatSimpan(null); }} disabled={menyimpan} data-testid="batal-info">
                        Batalkan
                      </Button>
                    )}
                    <Button type="button" size="sm" onClick={simpan} disabled={!berubah || adaGalat || menyimpan} className="gap-1.5 bg-[#006837] hover:bg-[#005830]" data-testid="simpan-info">
                      {menyimpan ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <aside className="min-w-0 space-y-3 lg:sticky lg:top-4 lg:self-start" aria-label="Pratinjau halaman siswa" data-testid="pratinjau-info">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <Eye className="h-3.5 w-3.5" /> Pratinjau halaman siswa
              </div>
              <div className="space-y-4 rounded-2xl bg-slate-100 p-3 sm:p-4">
                <TataTertibUjian teks={rapikanTataTertib(isian.tata_tertib)} />
                <PanduanCbt panduan={pratinjauPanduan} tiruan={!!data.tiruan} onBukaPdf={bukaPdf} />
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
