import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Loader2, MousePointerClick, RefreshCw, SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KosongInfo, TabJenjang } from '@/components/ujian/publik/info/BagianInfo';
import { formatWIB, formatWIBPanjang } from '@/lib/datetime';
import { labelJenjang, mapelUntuk } from '@/lib/mapelUjian';
import { pesanGalat } from '@/lib/ujian';
import {
  SARINGAN_INTENSITAS, intensitasJenjang, keadaanKlik, muatIntensitasKlik, ringkasIntensitas, saringIntensitas,
} from '@/lib/ujianLinkSoal';

const LENCANA_KEADAAN = {
  tidak_tersentuh: { label: 'Tidak tersentuh', kelas: 'border-amber-300 bg-amber-50 text-amber-800' },
  menunggu: { label: 'Menunggu jadwal', kelas: 'border-slate-200 bg-slate-50 text-slate-500' },
};

const jam = (iso) => formatWIB(iso, 'Time', { hour: '2-digit', minute: '2-digit' });
const tglPendek = (iso) => formatWIB(iso, 'Date', { weekday: 'short', day: 'numeric', month: 'short' });

function KartuAngka({ label, nilai, keterangan, testId }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-3" data-testid={testId}>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-0.5 text-xl font-bold tabular-nums text-slate-900">{nilai}</p>
      {keterangan && <p className="truncate text-xs text-slate-500">{keterangan}</p>}
    </div>
  );
}

/**
 * Satu mapel: jendela & host tautan, jumlah klik dengan batang relatif terhadap mapel tersibuk di jenjang itu (`maks`),
 * klik terakhir, dan lencana bila tautannya terpasang tetapi tidak tersentuh / masih menunggu jadwal.
 */
function BarisIntensitas({ baris, jenjang, maks }) {
  const d = baris.data;
  const n = Number(d?.jumlah_klik) || 0;
  const keadaan = keadaanKlik(d);
  const lencana = LENCANA_KEADAAN[keadaan];
  const persen = maks ? Math.max(n ? 4 : 0, Math.round((n / maks) * 100)) : 0;
  return (
    <li className="flex flex-col gap-1 px-3 py-2.5 sm:grid sm:grid-cols-[1.5rem_minmax(0,10rem)_minmax(0,1fr)_6rem_minmax(0,9rem)] sm:items-center sm:gap-3"
      data-testid={`intensitas-${jenjang}-${baris.kode}`} data-jumlah={n}>
      <span className="hidden text-right text-xs tabular-nums text-slate-400 sm:block">{baris.nomor}</span>
      <span className="flex flex-wrap items-center gap-1.5">
        <span className="text-sm font-semibold text-slate-900">{baris.nama}</span>
        {lencana && (
          <span className={`rounded-full border px-1.5 py-px text-[10px] font-semibold ${lencana.kelas}`} data-testid={`intensitas-${jenjang}-${baris.kode}-keadaan`} data-keadaan={keadaan}>
            {lencana.label}
          </span>
        )}
      </span>
      <span className="min-w-0 text-xs text-slate-600">
        {d?.mulai_at && d?.selesai_at
          ? <span className="tabular-nums">{tglPendek(d.mulai_at)} · {jam(d.mulai_at)}–{jam(d.selesai_at)}</span>
          : <span className="text-slate-400">Belum ada jendela</span>}
        {d?.url_host ? <span className="ml-1.5 font-mono text-slate-500">{d.url_host}</span> : <span className="ml-1.5 text-slate-400">· tautan belum diisi</span>}
      </span>
      <span className="flex items-center gap-2 sm:block" data-testid={`intensitas-${jenjang}-${baris.kode}-jumlah`}>
        <span className="block text-sm tabular-nums sm:text-right">
          <span className={`font-bold ${n ? 'text-slate-900' : 'text-slate-400'}`}>{n.toLocaleString('id-ID')}</span>
          <span className="text-xs text-slate-500"> klik</span>
        </span>
        <span className="block h-1.5 w-24 overflow-hidden rounded-full bg-slate-100 sm:ml-auto sm:mt-1 sm:w-full" aria-hidden="true">
          <span className="block h-full rounded-full bg-[#006837]" style={{ width: `${persen}%` }} />
        </span>
      </span>
      <span className="text-xs text-slate-500" data-testid={`intensitas-${jenjang}-${baris.kode}-terakhir`}>
        {d?.klik_terakhir_at ? <>Terakhir {tglPendek(d.klik_terakhir_at)} {jam(d.klik_terakhir_at)}</> : 'Belum pernah diklik'}
      </span>
    </li>
  );
}

/** Saringan mapel (15 mapel baku) & status; berlaku untuk semua tab agar satu mapel mudah dibandingkan antarjenjang. */
function BarisSaringan({ saringan, onUbah, mapel }) {
  return (
    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center" data-testid="intensitas-saringan">
      <label className="flex min-w-0 flex-1 items-center gap-2 text-xs text-slate-600">
        <span className="shrink-0 font-medium">Mapel</span>
        <select value={saringan.mapel} onChange={(e) => onUbah({ ...saringan, mapel: e.target.value })} data-testid="intensitas-saring-mapel"
          className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006837]">
          <option value="">Semua mata pelajaran</option>
          {mapel.map((m) => <option key={m.kode} value={m.kode}>{m.nama}</option>)}
        </select>
      </label>
      <div className="flex shrink-0 rounded-lg bg-slate-100 p-0.5" role="group" aria-label="Saring status klik">
        {SARINGAN_INTENSITAS.map((st) => (
          <button key={st.kode} type="button" onClick={() => onUbah({ ...saringan, status: st.kode })} aria-pressed={saringan.status === st.kode}
            data-testid={`intensitas-saring-${st.kode}`}
            className={`flex-1 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006837] ${saringan.status === st.kode ? 'bg-white text-[#006837] shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
            {st.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function IsiJenjang({ data, mapel, jenjang, saringan, onUbahSaringan }) {
  const baris = useMemo(() => intensitasJenjang(data.intensitas, mapel, jenjang), [data.intensitas, mapel, jenjang]);
  const tampil = useMemo(() => saringIntensitas(baris, saringan), [baris, saringan]);
  const r = ringkasIntensitas(baris.map((b) => b.data).filter(Boolean));
  const maks = Math.max(0, ...baris.map((b) => Number(b.data?.jumlah_klik) || 0));
  const tidakTersentuh = baris.filter((b) => keadaanKlik(b.data) === 'tidak_tersentuh').length;
  const disaring = !!saringan.mapel || saringan.status !== 'semua';
  return (
    <>
      <p className="mb-2 text-xs text-slate-500" data-testid={`ringkas-intensitas-${jenjang}`}>
        <span className="font-semibold text-slate-700">{r.total_klik.toLocaleString('id-ID')} klik</span> pada {r.mapel_diklik} dari {baris.length} mapel {labelJenjang(jenjang)}
        {tidakTersentuh > 0 && <> · <span className="font-semibold text-amber-700">{tidakTersentuh} tidak tersentuh</span></>}
        {disaring && <> · menampilkan {tampil.length} mapel</>}
      </p>
      <BarisSaringan saringan={saringan} onUbah={onUbahSaringan} mapel={mapelUntuk(mapel, jenjang)} />
      {!tampil.length ? (
        <KosongInfo Ikon={SearchX} judul="Tidak ada mapel yang cocok" testId={`intensitas-kosong-saring-${jenjang}`}>
          {saringan.status === 'tidak_tersentuh' && !saringan.mapel
            ? `Semua mapel ${labelJenjang(jenjang)} yang tautannya terpasang sudah pernah dikerjakan.`
            : `Tidak ada mapel ${labelJenjang(jenjang)} yang sesuai saringan.`}
          <Button variant="link" size="sm" onClick={() => onUbahSaringan({ mapel: '', status: 'semua' })} className="h-auto p-0 pl-1 text-[#006837]"
            data-testid="intensitas-hapus-saringan">Hapus saringan</Button>
        </KosongInfo>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="hidden border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:grid sm:grid-cols-[1.5rem_minmax(0,10rem)_minmax(0,1fr)_6rem_minmax(0,9rem)] sm:gap-3" aria-hidden="true">
            <span /><span>Mata pelajaran</span><span>Jendela & tautan</span><span className="text-right">Klik</span><span>Klik terakhir</span>
          </div>
          <ul className="divide-y divide-slate-100" data-testid={`daftar-intensitas-${jenjang}`}>
            {tampil.map((b) => <BarisIntensitas key={b.kode} baris={b} jenjang={jenjang} maks={maks} />)}
          </ul>
        </div>
      )}
    </>
  );
}

/**
 * Panel intensitas klik "Mengerjakan" untuk admin & pemantau: ringkasan seluruh ujian, lalu per tab jenjang 15 mapel
 * baku dengan jendela pengerjaan, tautan soal (host), jumlah klik, dan klik terakhir. Angka diagregasi server dari jejak
 * audit (ujian_akses_log), bukan dari cache di portal, sehingga tetap dapat ditelusuri setelah ujian selesai.
 * `mapel` = daftar mapel baku per jenjang dari respons link soal; `jenjang`/`onUbahJenjang` dibagi dengan tampilan pengaturan.
 */
export default function PanelIntensitasKlik({ ujianId, mapel, jenjang, onUbahJenjang }) {
  const [data, setData] = useState(null);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState('');
  const [saringan, setSaringan] = useState({ mapel: '', status: 'semua' });

  const muat = useCallback(async () => {
    if (!ujianId) return;
    setMemuat(true);
    try {
      setData(await muatIntensitasKlik(ujianId));
      setGalat('');
    } catch (e) {
      setGalat(pesanGalat(e, 'Gagal memuat intensitas klik.'));
    } finally {
      setMemuat(false);
    }
  }, [ujianId]);
  useEffect(() => { setData(null); muat(); }, [muat]);

  const r = data?.ringkasan;
  const lencana = (j) => {
    if (!data) return '';
    const rj = ringkasIntensitas(intensitasJenjang(data.intensitas, mapel, j).map((b) => b.data).filter(Boolean));
    return `${rj.total_klik.toLocaleString('id-ID')} klik`;
  };

  return (
    <section className="space-y-4" aria-labelledby="judul-intensitas" data-testid="panel-intensitas-klik">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="judul-intensitas" className="flex items-center gap-1.5 text-base font-semibold text-slate-900">
            <Activity className="h-4 w-4 text-[#006837]" /> Intensitas klik Mengerjakan
          </h2>
          <p className="text-xs text-slate-500">Dihitung dari jejak audit klik yang sah — mapel mana yang benar-benar dikerjakan dan mana yang belum tersentuh.</p>
        </div>
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" onClick={muat} disabled={memuat} data-testid="muat-ulang-intensitas">
          {memuat ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Muat ulang
        </Button>
      </div>

      {galat && (
        <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800" role="alert">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {galat}
        </div>
      )}
      {!data && memuat && <div className="p-8 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-[#006837]" /></div>}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KartuAngka label="Total klik" nilai={r.total_klik.toLocaleString('id-ID')} keterangan="Semua jenjang" testId="intensitas-total" />
            <KartuAngka label="Mapel dikerjakan" nilai={r.mapel_diklik} keterangan={`dari ${data.intensitas.length} mapel`} testId="intensitas-mapel-diklik" />
            <KartuAngka label="Tautan siap" nilai={r.mapel_siap} keterangan="Tombol dapat dipakai" testId="intensitas-siap" />
            <KartuAngka label="Klik terakhir" nilai={r.klik_terakhir_at ? jam(r.klik_terakhir_at) : '–'}
              keterangan={r.klik_terakhir_at ? formatWIBPanjang(r.klik_terakhir_at, false) : 'Belum ada klik'} testId="intensitas-terakhir" />
          </div>
          {r.total_klik === 0 && (
            <p className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600" data-testid="intensitas-kosong">
              <MousePointerClick className="h-4 w-4 shrink-0 text-slate-400" /> Belum ada klik Mengerjakan yang tercatat untuk ujian ini.
            </p>
          )}
          <TabJenjang nilai={jenjang} onUbah={onUbahJenjang} testId="intensitas" lencana={lencana}
            isi={(j) => <IsiJenjang data={data} mapel={mapel} jenjang={j} saringan={saringan} onUbahSaringan={setSaringan} />} />
        </>
      )}
    </section>
  );
}
