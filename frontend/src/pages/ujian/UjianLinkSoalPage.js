import React, { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertTriangle, ArrowLeft, CircleDashed, ExternalLink, Info, Link2, Loader2, MonitorPlay, Pencil, PowerOff, RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import AksesDitolak from '@/components/security/AksesDitolak';
import PilihUjian from '@/components/ujian/PilihUjian';
import { TabJenjang } from '@/components/ujian/publik/info/BagianInfo';
import { LencanaStatusTautan } from '@/components/ujian/tautan/KartuTautanPublik';
import DialogLinkSoal from '@/components/ujian/linkSoal/DialogLinkSoal';
import { formatWIB, formatWIBPanjang } from '@/lib/datetime';
import { JENJANG_UJIAN, labelJenjang } from '@/lib/mapelUjian';
import { HALAMAN_BERANDA_UJIAN, aksesDitolak, pesanGalat } from '@/lib/ujian';
import { HALAMAN_TAUTAN_PUBLIK, simpanTautanPublik, statusTautan, urlTautan } from '@/lib/ujianTautanPublik';
import { barisLinkJenjang, hostUrl, ikutJadwal, muatLinkSoal } from '@/lib/ujianLinkSoal';

const jam = (iso) => formatWIB(iso, 'Time', { hour: '2-digit', minute: '2-digit' });
const tglPendek = (iso) => formatWIB(iso, 'Date', { weekday: 'short', day: 'numeric', month: 'short' });

/** Rentang waktu ringkas: "Sen, 30 Nov · 07.30–09.00" (tanggal kedua ikut bila berbeda hari). */
function rentang(mulai, selesai) {
  if (!mulai || !selesai) return null;
  const hariSama = formatWIB(mulai, 'Date') === formatWIB(selesai, 'Date');
  return hariSama ? `${tglPendek(mulai)} · ${jam(mulai)}–${jam(selesai)}` : `${tglPendek(mulai)} ${jam(mulai)} – ${tglPendek(selesai)} ${jam(selesai)}`;
}

/**
 * Status portal siswa + sakelar buka/tutup portal (admin; tersimpan langsung, terpisah dari tautan info & monitoring)
 * dan pintasan membuka portal / mengatur jendela waktunya di menu Tautan Publik.
 */
function StatusPortal({ tautan, ujianId, bolehUbah, onBerubah }) {
  const [sibuk, setSibuk] = useState(false);
  const url = urlTautan(tautan);
  const tampil = tautan ? { ...tautan, ...statusTautan(tautan) } : null;
  const ubahAktif = async (aktif) => {
    setSibuk(true);
    try {
      const r = await simpanTautanPublik(ujianId, 'portal', { aktif });
      onBerubah(r.tautan, r.tiruan);
      const st = statusTautan(r.tautan);
      if (!aktif) {
        toast.success('Portal ujian ditutup. Siswa kini melihat "portal sedang ditutup".', {
          action: { label: 'Urungkan', onClick: () => ubahAktif(true) },
        });
      } else if (!st.berlaku) toast.warning(`Portal dibuka, tetapi belum dapat diakses: ${st.pesan}`);
      else toast.success('Portal ujian dibuka.');
      (r.peringatan || []).forEach((p) => toast.warning(p.pesan));
    } catch (e) {
      toast.error(pesanGalat(e, 'Gagal mengubah status portal.'));
    } finally {
      setSibuk(false);
    }
  };
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between" data-testid="status-portal">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-800">
          Portal ujian siswa {tampil ? <LencanaStatusTautan tautan={tampil} testId="status-tautan-portal" /> : <span className="text-xs text-slate-500">(tautan belum dibuat)</span>}
        </div>
        {tampil && !tampil.berlaku && (
          <p className="text-xs text-slate-500" data-testid="status-portal-pesan">
            {tampil.alasan === 'nonaktif' ? 'Link soal tetap bisa disiapkan. Siswa baru dapat membuka portal setelah portal dibuka.' : tampil.pesan}
          </p>
        )}
        {tampil?.berlaku && (!tautan.mulai_at || !tautan.selesai_at) && (
          <p className="text-xs text-amber-700" data-testid="status-portal-tanpa-batas">Portal terbuka tanpa jendela waktu lengkap — batasi pada masa ujian di menu Tautan Publik.</p>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {tautan && bolehUbah && (
          <label className="mr-1 flex items-center gap-2 text-xs font-medium text-slate-700" htmlFor="sakelar-portal">
            {sibuk ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {tautan.aktif ? 'Portal dibuka' : 'Portal ditutup'}
            <Switch id="sakelar-portal" checked={!!tautan.aktif} disabled={sibuk} onCheckedChange={ubahAktif} data-testid="sakelar-portal" />
          </label>
        )}
        {url && (
          <Button asChild variant="outline" size="sm" className="h-8 gap-1.5">
            <a href={url} target="_blank" rel="noopener noreferrer" data-testid="buka-portal"><ExternalLink className="h-3.5 w-3.5" /> Buka portal</a>
          </Button>
        )}
        <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 text-[#006837]">
          <Link to={`${HALAMAN_TAUTAN_PUBLIK}?ujian=${encodeURIComponent(ujianId || '')}`} data-testid="atur-tautan-portal"><Link2 className="h-3.5 w-3.5" /> Atur tautan</Link>
        </Button>
      </div>
    </div>
  );
}

function LencanaLink({ link }) {
  if (link?.siap) return <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-[#006837]">Siap</span>;
  if (link?.url || link?.url_host) {
    return <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600"><PowerOff className="h-3 w-3" /> Nonaktif</span>;
  }
  return <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-[11px] font-semibold text-slate-500"><CircleDashed className="h-3 w-3" /> Belum siap</span>;
}

function BarisLink({ baris, jenjang, bolehUbah, onAtur }) {
  const l = baris.link;
  const host = l?.url_host || hostUrl(l?.url);
  const jendela = rentang(l?.mulai_at, l?.selesai_at);
  let tandaJendela = null;
  if (jendela && l?.jadwal) tandaJendela = ikutJadwal(l) ? 'Mengikuti jadwal' : 'Disesuaikan';
  return (
    <li className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:gap-3" data-testid={`link-${jenjang}-${baris.kode}`} data-siap={l?.siap ? 'ya' : 'tidak'}>
      <span className="hidden w-6 shrink-0 text-right text-xs tabular-nums text-slate-400 sm:block">{baris.nomor}</span>
      <div className="min-w-0 flex-1 sm:grid sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_minmax(0,12rem)] sm:items-center sm:gap-3">
        <div className="flex items-center justify-between gap-2 sm:block">
          <div className="text-sm font-semibold text-slate-900">{baris.nama}</div>
          <span className="sm:hidden"><LencanaLink link={l} /></span>
        </div>
        <div className="min-w-0 text-xs text-slate-600" data-testid={`link-${jenjang}-${baris.kode}-jendela`}>
          {jendela ? (
            <>
              <span className="tabular-nums text-slate-800">{jendela}</span>
              {tandaJendela && <span className={`ml-1.5 text-[11px] ${tandaJendela === 'Disesuaikan' ? 'font-semibold text-amber-700' : 'text-slate-500'}`}>{tandaJendela}</span>}
            </>
          ) : <span className="text-slate-500">{l?.jadwal ? 'Jendela belum diisi' : 'Belum ada di jadwal ujian'}</span>}
        </div>
        <div className="min-w-0 truncate text-xs" title={l?.url || host || undefined}>
          {host ? <span className="font-mono text-slate-700">{host}</span> : <span className="text-slate-400">Tautan belum diisi</span>}
        </div>
      </div>
      <div className="flex shrink-0 items-center justify-end gap-2 sm:w-44">
        <span className="hidden sm:inline-flex"><LencanaLink link={l} /></span>
        {bolehUbah && (
          <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => onAtur({ jenjang, kode: baris.kode, nama: baris.nama, link: l })}
            data-testid={`atur-link-${jenjang}-${baris.kode}`}>
            <Pencil className="h-3.5 w-3.5" /> {l?.id ? 'Ubah' : 'Atur'}
          </Button>
        )}
      </div>
    </li>
  );
}

function IsiJenjang({ data, jenjang, bolehUbah, onAtur }) {
  const { baris, ringkas } = useMemo(() => barisLinkJenjang(data.link, data.mapel, jenjang), [data.link, data.mapel, jenjang]);
  const terakhir = useMemo(() => baris.map((b) => b.link).filter((l) => l?.diperbarui_pada)
    .sort((a, b) => String(b.diperbarui_pada).localeCompare(String(a.diperbarui_pada)))[0], [baris]);
  return (
    <>
      <p className="mb-2 text-xs text-slate-500" data-testid={`ringkas-link-${jenjang}`}>
        <span className="font-semibold text-slate-700">{ringkas.siap}/{ringkas.total}</span> mapel {labelJenjang(jenjang)} siap dikerjakan
        {ringkas.terjadwal < ringkas.total && <> · {ringkas.total - ringkas.terjadwal} belum punya jendela waktu</>}
        {terakhir && <> · terakhir diubah {formatWIBPanjang(terakhir.diperbarui_pada)}{terakhir.diperbarui_oleh_nama ? ` oleh ${terakhir.diperbarui_oleh_nama}` : ''}</>}
      </p>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="hidden border-b border-slate-200 bg-slate-50 py-2 pl-12 pr-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:grid sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_minmax(0,12rem)_11rem] sm:gap-3" aria-hidden="true">
          <span>Mata pelajaran</span><span>Jendela pengerjaan</span><span>Tautan soal</span><span className="text-right">Status</span>
        </div>
        <ul className="divide-y divide-slate-100" data-testid={`daftar-link-${jenjang}`}>
          {baris.map((b) => <BarisLink key={b.kode} baris={b} jenjang={jenjang} bolehUbah={bolehUbah} onAtur={onAtur} />)}
        </ul>
      </div>
    </>
  );
}

const jenjangSah = (v) => (JENJANG_UJIAN.includes(Number(v)) ? Number(v) : JENJANG_UJIAN[0]);

/**
 * Link Soal (/ujian/link-soal?ujian=<id>&kelas=7|8|9): tautan soal eksternal & jendela waktu tombol "Mengerjakan" per
 * jenjang per mapel baku untuk Portal Ujian siswa. Jendela awalnya mengikuti jadwal ujian; admin boleh
 * mempersempitnya. Tiap baris disimpan sendiri lewat dialog dengan cek versi agar dua admin tidak saling menimpa.
 * Kepala madrasah, waka kurikulum, serta ketua & sekretaris panitia melihat tanpa alamat soal lengkap.
 */
export default function UjianLinkSoalPage() {
  const [params, setParams] = useSearchParams();
  const [ujian, setUjian] = useState(null);
  const [data, setData] = useState(null);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState('');
  const [ditolak, setDitolak] = useState('');
  const [sasaran, setSasaran] = useState(null);
  const jenjang = jenjangSah(params.get('kelas'));

  const muat = useCallback(async (u) => {
    if (!u) { setData(null); return; }
    setMemuat(true);
    try {
      setData(await muatLinkSoal(u.id));
      setGalat('');
      setDitolak('');
    } catch (e) {
      setData(null);
      if (aksesDitolak(e)) setDitolak(pesanGalat(e, 'Akses ditolak.'));
      else setGalat(pesanGalat(e, 'Gagal memuat link soal.'));
    } finally {
      setMemuat(false);
    }
  }, []);
  const gantiUjian = useCallback((u) => { setUjian(u); setSasaran(null); muat(u); }, [muat]);
  const ubahJenjang = (j) => setParams((p) => { const n = new URLSearchParams(p); n.set('kelas', String(j)); return n; }, { replace: true });

  const tersimpan = (link, tiruan) => {
    setData((d) => ({
      ...d, tiruan: d.tiruan || tiruan,
      link: d.link.map((l) => (Number(l.jenjang) === Number(link.jenjang) && l.mapel === link.mapel ? link : l)),
    }));
    setSasaran(null);
  };

  const bolehUbah = !!data?.boleh_ubah;
  const lencana = (j) => {
    if (!data) return '';
    const { ringkas } = barisLinkJenjang(data.link, data.mapel, j);
    return `${ringkas.siap}/${ringkas.total} siap`;
  };

  return (
    <div className="space-y-6" data-testid="ujian-link-soal">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link to={HALAMAN_BERANDA_UJIAN} className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-[#006837] hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> Beranda Ujian
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 sm:text-3xl">
            <MonitorPlay className="h-7 w-7 text-[#006837]" /> Link Soal
          </h1>
          <p className="mt-1 text-sm text-slate-600">Tautan soal CBT dan jam tombol Mengerjakan per jenjang per mapel di Portal Ujian siswa.</p>
        </div>
        <Button variant="outline" onClick={() => muat(ujian)} disabled={memuat || !ujian} className="gap-2 self-start sm:self-auto" data-testid="btn-muat-ulang-link">
          {memuat ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Muat Ulang
        </Button>
      </div>

      <PilihUjian onUbah={gantiUjian} />

      {ditolak && <AksesDitolak halaman="Link Soal" untuk="admin, pimpinan, serta ketua dan sekretaris panitia ujian ini" pesan={ditolak} />}
      {data?.tiruan && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" data-testid="info-tiruan-link-soal">
          Server belum menyediakan menu Link Soal — menampilkan contoh untuk mencoba tampilan. Isian hanya tersimpan di tab ini.
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
          <StatusPortal tautan={data.tautan_portal} ujianId={ujian?.id} bolehUbah={bolehUbah}
            onBerubah={(t, tiruan) => setData((d) => ({ ...d, tiruan: d.tiruan || tiruan, tautan_portal: t }))} />
          {!bolehUbah && (
            <p className="flex items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800" data-testid="link-hanya-lihat">
              <Info className="h-4 w-4 shrink-0" /> Anda melihat sebagai pemantau. Link soal hanya dapat diatur admin; alamat soal lengkap tidak ditampilkan.
            </p>
          )}
          <TabJenjang nilai={jenjang} onUbah={ubahJenjang} testId="link" lencana={lencana}
            isi={(j) => <IsiJenjang data={data} jenjang={j} bolehUbah={bolehUbah} onAtur={setSasaran} />} />
        </>
      )}

      <DialogLinkSoal ujianId={ujian?.id} sasaran={sasaran} onTutup={() => setSasaran(null)} onTersimpan={tersimpan}
        onBentrok={() => { setSasaran(null); muat(ujian); }} />
    </div>
  );
}
