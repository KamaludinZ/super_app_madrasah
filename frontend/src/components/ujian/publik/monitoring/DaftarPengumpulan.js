import React, { useMemo, useState } from 'react';
import { CheckCircle2, CircleDashed, ClipboardList, Lock, PartyPopper, SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatWIB } from '@/lib/datetime';
import { labelJenjang, mapelUntuk } from '@/lib/mapelUjian';
import {
  SARINGAN_STATUS, pengumpulanJenjang, ringkasPengumpulan, saringPengumpulan, teksPj, updateTerakhir, waktuRelatif,
} from '@/lib/ujianMonitoringPublik';
import { BagianInfo, KosongInfo, TabJenjang } from '@/components/ujian/publik/info/BagianInfo';

const waktuLengkap = (iso) => `${formatWIB(iso, '', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} WIB`;

/** Waktu relatif ("2 jam lalu") dengan waktu lengkap WIB pada tooltip & untuk pembaca layar. */
function Waktu({ iso, className = '' }) {
  return <time dateTime={iso} title={waktuLengkap(iso)} className={className}>{waktuRelatif(iso)}</time>;
}

/**
 * Status satu berkas. Di layar lebar kolomnya sudah berjudul, jadi label jenis disembunyikan dan waktu update berkas itu
 * ditampilkan di bawahnya. Kartu soal diberi ikon gembok: isinya rahasia, publik hanya melihat status.
 */
function StatusBerkas({ label, berkas, rahasia, testId }) {
  const ok = !!berkas;
  return (
    <span className="inline-flex flex-col items-start gap-0.5 sm:w-full" title={rahasia ? 'Isi kartu soal rahasia — hanya admin yang dapat membukanya' : undefined}>
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${ok ? 'bg-emerald-50 text-[#006837]' : 'bg-slate-100 text-slate-500'}`}
        data-testid={testId} data-status={ok ? 'terkirim' : 'belum'}>
        {ok ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : <CircleDashed className="h-3.5 w-3.5" aria-hidden="true" />}
        <span className="sm:hidden">{label}</span> {ok ? 'Terkirim' : 'Belum'}
        {rahasia && <Lock className="h-3 w-3 opacity-70" aria-hidden="true" />}
        {rahasia && <span className="sr-only">(isi rahasia, hanya status yang ditampilkan)</span>}
      </span>
      {ok && berkas.updated_at && <Waktu iso={berkas.updated_at} className="hidden pl-1 text-[11px] text-slate-500 sm:block" />}
    </span>
  );
}

const KOLOM = 'sm:grid sm:grid-cols-[minmax(0,1fr)_8.5rem_8.5rem] sm:items-start sm:gap-3';

function KepalaKolom() {
  return (
    <div className={`hidden border-b border-slate-200 bg-slate-50 py-2 pl-12 pr-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 ${KOLOM}`} aria-hidden="true">
      <span>Mata pelajaran</span><span>Kisi-kisi</span><span className="inline-flex items-center gap-1">Kartu soal <Lock className="h-3 w-3" /></span>
    </div>
  );
}

function BarisMapel({ baris, jenjang }) {
  const pj = teksPj(baris);
  return (
    <li className="flex gap-3 px-3 py-2.5" data-testid={`pantau-${jenjang}-${baris.kode}`} data-lengkap={baris.lengkap ? 'ya' : 'tidak'}>
      <span className="hidden w-6 shrink-0 pt-0.5 text-right text-xs tabular-nums text-slate-400 sm:block">{baris.nomor}</span>
      <div className={`min-w-0 flex-1 ${KOLOM}`}>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">{baris.nama}</div>
          <p className="text-xs text-slate-500">
            {pj.length ? (
              <>
                {pj.map((p, i) => (
                  <span key={p.label || 'pj'} data-testid={`pantau-${jenjang}-${baris.kode}-pj`}>
                    {i > 0 && ' · '}PJ {p.label && <>{p.label.toLowerCase()} </>}<span className="text-slate-700">{p.nama}</span>
                  </span>
                ))}
                <span className="sm:hidden"> · <Waktu iso={baris.terakhir} /></span>
              </>
            ) : 'Belum ada berkas yang dikirim'}
          </p>
        </div>
        <div className="mt-1 flex flex-wrap gap-1.5 sm:contents">
          <StatusBerkas label="Kisi-kisi" berkas={baris.kisi_kisi} testId={`pantau-${jenjang}-${baris.kode}-kisi`} />
          <StatusBerkas label="Kartu soal" berkas={baris.kartu_soal} rahasia testId={`pantau-${jenjang}-${baris.kode}-kartu`} />
        </div>
      </div>
    </li>
  );
}

function Kemajuan({ label, nilai, total }) {
  const persen = total ? Math.round((nilai / total) * 100) : 0;
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="tabular-nums text-slate-500">{nilai}/{total}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={nilai} aria-valuemin={0} aria-valuemax={total} aria-label={`${label} terkirim`}>
        <div className="h-full rounded-full bg-[#006837]" style={{ width: `${persen}%` }} />
      </div>
    </div>
  );
}

/** Saringan mapel (15 mapel baku) & status; berlaku untuk semua tab agar satu mapel mudah dibandingkan antarjenjang. */
function BarisSaringan({ saringan, onUbah, mapel }) {
  return (
    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center" data-testid="pantau-saringan">
      <label className="flex min-w-0 flex-1 items-center gap-2 text-xs text-slate-600">
        <span className="shrink-0 font-medium">Mapel</span>
        <select value={saringan.mapel} onChange={(e) => onUbah({ ...saringan, mapel: e.target.value })} data-testid="pantau-saring-mapel"
          className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006837]">
          <option value="">Semua mata pelajaran</option>
          {mapel.map((m) => <option key={m.kode} value={m.kode}>{m.nama}</option>)}
        </select>
      </label>
      <div className="flex shrink-0 rounded-lg bg-slate-100 p-0.5" role="group" aria-label="Saring status">
        {SARINGAN_STATUS.map((st) => (
          <button key={st.kode} type="button" onClick={() => onUbah({ ...saringan, status: st.kode })} aria-pressed={saringan.status === st.kode}
            data-testid={`pantau-saring-${st.kode}`}
            className={`flex-1 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006837] ${saringan.status === st.kode ? 'bg-white text-[#006837] shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
            {st.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function IsiJenjang({ berkas, mapel, jenjang, saringan, onUbahSaringan }) {
  const daftarMapel = useMemo(() => mapelUntuk(mapel, jenjang), [mapel, jenjang]);
  const baris = useMemo(() => pengumpulanJenjang(berkas, jenjang, daftarMapel), [berkas, jenjang, daftarMapel]);
  const tampil = useMemo(() => saringPengumpulan(baris, saringan), [baris, saringan]);
  const r = ringkasPengumpulan(baris);
  const akhir = updateTerakhir(baris);
  const disaring = !!saringan.mapel || saringan.status !== 'semua';
  const hapusSaringan = () => onUbahSaringan({ mapel: '', status: 'semua' });
  let kosong = null;
  if (!tampil.length) {
    kosong = saringan.status === 'belum' && !saringan.mapel && r.lengkap === r.total
      ? <KosongInfo Ikon={PartyPopper} judul="Semua mapel sudah lengkap" testId="pantau-kosong">Kisi-kisi dan kartu soal {labelJenjang(jenjang)} sudah terkirim seluruhnya.</KosongInfo>
      : (
        <KosongInfo Ikon={SearchX} judul="Tidak ada mapel yang cocok" testId="pantau-kosong">
          Tidak ada mapel {labelJenjang(jenjang)} yang sesuai saringan.
          <Button variant="link" size="sm" onClick={hapusSaringan} className="h-auto p-0 pl-1 text-[#006837]" data-testid="pantau-hapus-saringan">Hapus saringan</Button>
        </KosongInfo>
      );
  }
  return (
    <>
      <div className="mb-3 rounded-xl bg-slate-50 p-3" data-testid={`pantau-ringkas-${jenjang}`}>
        <div className="flex gap-4">
          <Kemajuan label="Kisi-kisi" nilai={r.kisi_kisi} total={r.total} />
          <Kemajuan label="Kartu soal" nilai={r.kartu_soal} total={r.total} />
        </div>
        {akhir ? (
          <p className="mt-2 text-xs text-slate-500" data-testid={`pantau-terakhir-${jenjang}`}>
            Update terakhir: <span className="text-slate-700">{akhir.jenis} {akhir.nama}</span>
            {akhir.guru_pj_nama && <> oleh <span className="text-slate-700">{akhir.guru_pj_nama}</span></>}, <Waktu iso={akhir.updated_at} />
          </p>
        ) : (
          <p className="mt-2 text-xs text-slate-500" data-testid={`pantau-belum-ada-${jenjang}`}>Belum ada berkas yang dikirim untuk {labelJenjang(jenjang)}.</p>
        )}
      </div>
      <BarisSaringan saringan={saringan} onUbah={onUbahSaringan} mapel={daftarMapel} />
      {kosong || (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <KepalaKolom />
          <ul className="divide-y divide-slate-100" data-testid={`pantau-jenjang-${jenjang}`}>
            {tampil.map((b) => <BarisMapel key={b.kode} baris={b} jenjang={jenjang} />)}
          </ul>
        </div>
      )}
      <p className="mt-2 text-xs text-slate-500" aria-live="polite" data-testid={`pantau-keterangan-${jenjang}`}>
        {disaring && tampil.length ? `Menampilkan ${tampil.length} dari ${r.total} mapel · ` : ''}
        {r.lengkap} dari {r.total} mapel {labelJenjang(jenjang)} sudah lengkap (kisi-kisi & kartu soal).
      </p>
    </>
  );
}

/**
 * Status pengumpulan kisi-kisi & kartu soal dalam tiga tab jenjang; tiap tab memuat 15 mapel baku jenjang itu saja,
 * dapat disaring per mapel dan status (saringan berlaku untuk semua tab). Kartu soal hanya ditampilkan statusnya
 * (tanpa tombol, tautan, atau pratinjau isi).
 */
export default function DaftarPengumpulan({ berkas, mapel, jenjang, onUbahJenjang }) {
  const [saringan, setSaringan] = useState({ mapel: '', status: 'semua' });
  const lencana = (j) => {
    const r = ringkasPengumpulan(pengumpulanJenjang(berkas, j, mapelUntuk(mapel, j)));
    return `${r.lengkap}/${r.total} lengkap`;
  };
  return (
    <BagianInfo id="pengumpulan" Ikon={ClipboardList} judul="Status Pengumpulan" keterangan="Kisi-kisi & kartu soal per mata pelajaran.">
      <TabJenjang nilai={jenjang} onUbah={onUbahJenjang} testId="pantau" lencana={lencana}
        isi={(j) => <IsiJenjang berkas={berkas} mapel={mapel} jenjang={j} saringan={saringan} onUbahSaringan={setSaringan} />} />
    </BagianInfo>
  );
}
