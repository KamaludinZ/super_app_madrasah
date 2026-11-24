import React, { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertTriangle, ArrowLeft, CheckCircle2, CircleDashed, Download, FolderDown, Info, Loader2, Lock, RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import AksesDitolak from '@/components/security/AksesDitolak';
import PilihUjian from '@/components/ujian/PilihUjian';
import PanelZipJenjang from '@/components/ujian/berkas/PanelZipJenjang';
import FormUnduhTunggal from '@/components/ujian/berkas/FormUnduhTunggal';
import PanelRiwayatUnduhan from '@/components/ujian/berkas/PanelRiwayatUnduhan';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { formatWIBPanjang } from '@/lib/datetime';
import { HALAMAN_BERANDA_UJIAN, aksesDitolak, pesanGalat } from '@/lib/ujian';
import { formatUkuranBerkas } from '@/lib/ujianBerkas';
import { muatStatusBerkas, unduhBerkasTunggal, unduhZipJenjang } from '@/lib/ujianBerkasAdmin';
import { waktuRelatif } from '@/lib/ujianMonitoringPublik';
import { JENJANG_UJIAN, labelJenjang } from '@/lib/mapelUjian';

const JENIS = ['kisi_kisi', 'kartu_soal'];

function SelBerkas({ meta, jenis, bolehUnduh, sibuk, onUnduh, testId }) {
  if (!meta) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500" data-testid={testId} data-status="belum">
        <CircleDashed className="h-3.5 w-3.5" /> Belum
      </span>
    );
  }
  return (
    <div className="min-w-0 space-y-1" data-testid={testId} data-status="terkirim">
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-[#006837]">
        <CheckCircle2 className="h-3.5 w-3.5" /> Terkirim {jenis === 'kartu_soal' && <Lock className="h-3 w-3 opacity-70" aria-label="rahasia" />}
      </span>
      {jenis === 'kartu_soal' && !bolehUnduh ? (
        // Mode pemantau: metadata kartu soal (nama berkas, ukuran) disembunyikan — nama berkas dapat memuat petunjuk isi soal.
        <p className="text-[11px] text-slate-500" title={`${formatWIBPanjang(meta.updated_at)} WIB`} data-testid={`${testId}-meta`}>{waktuRelatif(meta.updated_at)}</p>
      ) : (
        <p className="truncate text-[11px] text-slate-500" title={`${meta.nama_file} · ${formatWIBPanjang(meta.updated_at)} WIB`} data-testid={`${testId}-meta`}>
          {formatUkuranBerkas(meta.ukuran_byte)} · {waktuRelatif(meta.updated_at)}
          {jenis === 'kisi_kisi' && <> · {meta.jumlah_unduh || 0}× diunduh</>}
        </p>
      )}
      {meta.ada_di_disk === false && (
        <p className="flex items-center gap-1 text-[11px] font-medium text-rose-700" data-testid={`${testId}-hilang`}>
          <AlertTriangle className="h-3 w-3" /> Berkas hilang di server — minta PJ mengunggah ulang
        </p>
      )}
      {bolehUnduh && meta.ada_di_disk !== false && (
        <Button type="button" size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" disabled={sibuk} onClick={() => onUnduh(meta)}
          aria-label={`Unduh ${meta.nama_file}`} data-testid={`${testId}-unduh`}>
          {sibuk ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />} Unduh
        </Button>
      )}
    </div>
  );
}

/**
 * Berkas Soal (/ujian/berkas-soal?ujian=<id>): status kisi-kisi & kartu soal per jenjang × mapel baku beserta nama PJ,
 * dan bundel unduh admin — ZIP kisi-kisi / ZIP kartu soal per jenjang (semua mapel) serta unduh tunggal per mapel.
 * Pimpinan serta ketua & sekretaris panitia hanya melihat status; isi berkas (terutama kartu soal rahasia) hanya admin.
 */
export default function UjianBerkasSoalPage() {
  const [ujian, setUjian] = useState(null);
  const [data, setData] = useState(null);
  const [jenjang, setJenjang] = useState(JENJANG_UJIAN[0]);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState('');
  const [ditolak, setDitolak] = useState('');
  const [sibuk, setSibuk] = useState(null); // id berkas / 'zip:<jenis>' yang sedang diunduh
  const [kartuTunggal, setKartuTunggal] = useState(null); // { meta, judul } kartu soal yang menunggu konfirmasi
  const [segarkanRiwayat, setSegarkanRiwayat] = useState(0);

  const muat = useCallback(async (u) => {
    if (!u) { setData(null); return; }
    setMemuat(true);
    try {
      setData(await muatStatusBerkas(u.id));
      setGalat(''); setDitolak('');
    } catch (e) {
      setData(null);
      if (aksesDitolak(e)) setDitolak(pesanGalat(e, 'Akses ditolak.'));
      else setGalat(pesanGalat(e, 'Gagal memuat status berkas soal.'));
    } finally {
      setMemuat(false);
    }
  }, []);
  const gantiUjian = useCallback((u) => { setUjian(u); muat(u); }, [muat]);

  const unduh = async (kunci, fn) => {
    setSibuk(kunci);
    try {
      const r = await fn();
      toast.success(`${r.nama} diunduh.`);
    } catch (e) {
      toast.error(pesanGalat(e, 'Gagal mengunduh berkas.'));
    } finally {
      setSibuk(null);
      setSegarkanRiwayat((n) => n + 1); // unduhan baru tampil di riwayat
    }
  };

  // Unduh tunggal: kisi-kisi langsung; kartu soal (rahasia) dikonfirmasi dulu.
  const unduhTunggal = (meta, jenis, j, b) => {
    if (jenis === 'kartu_soal') { setKartuTunggal({ meta, judul: `${b?.nama || ''} ${labelJenjang(j)}` }); return; }
    unduh(meta.id, () => unduhBerkasTunggal(ujian?.id, meta, jenis));
  };

  const bolehUnduh = !!data?.boleh_unduh_kartu;
  const isi = data?.jenjang?.[String(jenjang)];
  const baris = isi?.baris || [];

  return (
    <div className="space-y-6" data-testid="ujian-berkas-soal">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link to={HALAMAN_BERANDA_UJIAN} className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-[#006837] hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> Beranda Ujian
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 sm:text-3xl"><FolderDown className="h-7 w-7 text-[#006837]" /> Berkas Soal</h1>
          <p className="mt-1 text-sm text-slate-600">Status kisi-kisi & kartu soal tiap mapel, dan unduhan bundel per jenjang.</p>
        </div>
        <Button variant="outline" onClick={() => muat(ujian)} disabled={memuat || !ujian} className="gap-2 self-start sm:self-auto" data-testid="btn-muat-ulang-berkas-soal">
          {memuat ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Muat Ulang
        </Button>
      </div>

      <PilihUjian onUbah={gantiUjian} />

      {ditolak && <AksesDitolak halaman="Berkas Soal" untuk="admin, pimpinan, serta ketua dan sekretaris panitia ujian ini" pesan={ditolak} />}
      {data?.tiruan && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" data-testid="info-tiruan-berkas-soal">
          Server belum menyediakan status berkas soal — menampilkan data contoh. Unduhan berupa berkas contoh.
        </p>
      )}
      {galat && (
        <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800" role="alert">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {galat}
        </div>
      )}
      {!data && memuat && <div className="p-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-[#006837]" /></div>}

      {data && !ditolak && (
        <>
          {bolehUnduh ? (
            <p className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800" data-testid="berkas-soal-mode-admin">
              <Lock className="h-4 w-4 shrink-0" /> <span><strong>Mode admin:</strong> Anda dapat mengunduh kartu soal yang rahasia. Setiap unduhan tercatat atas nama Anda di riwayat unduhan.</span>
            </p>
          ) : (
            <p className="flex items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800" data-testid="berkas-soal-hanya-lihat">
              <Info className="h-4 w-4 shrink-0" /> Anda melihat sebagai pemantau: hanya status. Nama & isi kartu soal yang rahasia serta semua unduhan hanya untuk admin.
            </p>
          )}
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1 sm:inline-grid" role="tablist" aria-label="Jenjang">
            {JENJANG_UJIAN.map((j) => {
              const r = data.jenjang?.[String(j)]?.ringkasan;
              return (
                <button key={j} type="button" role="tab" aria-selected={jenjang === j} onClick={() => setJenjang(j)} data-testid={`berkas-soal-tab-${j}`}
                  className={`flex flex-col items-center rounded-md px-4 py-1.5 text-sm font-medium sm:flex-row sm:gap-1.5 ${jenjang === j ? 'bg-white text-[#006837] shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
                  {labelJenjang(j)}<span className="text-[10px] font-normal tabular-nums text-slate-500 sm:text-[11px]">{r ? `${r.lengkap}/${r.total} lengkap` : ''}</span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" data-testid={`berkas-soal-zip-${jenjang}`}>
            {JENIS.map((jenis) => (
              <PanelZipJenjang key={`${jenis}-${jenjang}`} jenis={jenis} jenjang={jenjang} baris={baris} bolehUnduh={bolehUnduh}
                sibuk={!!sibuk} mengunduh={sibuk === `zip:${jenis}`}
                onUnduh={(daftar) => unduh(`zip:${jenis}`, () => unduhZipJenjang(ujian?.id, jenis, jenjang, ujian?.nama, daftar))} />
            ))}
          </div>

          {bolehUnduh && <FormUnduhTunggal status={data} jenjangAwal={jenjang} bolehUnduh={bolehUnduh} sibuk={!!sibuk} onUnduh={unduhTunggal} />}

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[640px] text-sm" data-testid={`berkas-soal-tabel-${jenjang}`}>
              <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <tr><th className="w-8 px-3 py-2">No</th><th className="px-3 py-2">Mata pelajaran</th><th className="px-3 py-2">Kisi-kisi</th>
                  <th className="px-3 py-2">Kartu soal</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {baris.map((b) => (
                  <tr key={b.kode} data-testid={`berkas-soal-${jenjang}-${b.kode}`} className="align-top">
                    <td className="px-3 py-2.5 text-xs tabular-nums text-slate-400">{b.nomor}</td>
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-slate-900">{b.nama}</div>
                      <div className="text-xs text-slate-500">{b.pj?.length ? `PJ ${b.pj.join(' & ')}` : 'Belum ada PJ (belum mengirim)'}</div>
                    </td>
                    {JENIS.map((jenis) => (
                      <td key={jenis} className="px-3 py-2.5">
                        <SelBerkas meta={b[jenis]} jenis={jenis} bolehUnduh={bolehUnduh} sibuk={!!sibuk} testId={`berkas-soal-${jenjang}-${b.kode}-${jenis}`}
                          onUnduh={(m) => unduhTunggal(m, jenis, jenjang, b)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <PanelRiwayatUnduhan ujianId={ujian?.id} segarkan={segarkanRiwayat} />
        </>
      )}

      <AlertDialog open={!!kartuTunggal} onOpenChange={(o) => { if (!o) setKartuTunggal(null); }}>
        <AlertDialogContent data-testid="konfirmasi-kartu-tunggal">
          <AlertDialogHeader>
            <AlertDialogTitle>Unduh kartu soal {kartuTunggal?.judul}?</AlertDialogTitle>
            <AlertDialogDescription>
              Kartu soal bersifat rahasia. Unduhan ini tercatat atas nama Anda; simpan di perangkat yang aman dan jangan dibagikan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="konfirmasi-kartu-tunggal-batal">Batal</AlertDialogCancel>
            <AlertDialogAction className="bg-[#006837] hover:bg-[#005830]" data-testid="konfirmasi-kartu-tunggal-ya"
              onClick={() => { const m = kartuTunggal.meta; setKartuTunggal(null); unduh(m.id, () => unduhBerkasTunggal(ujian?.id, m, 'kartu_soal')); }}>
              Ya, unduh
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
