import React from 'react';
import { Badge } from '@/components/ui/badge';
import { DoorClosed, MapPin, UsersRound } from 'lucide-react';
import { labelJenjang } from '@/lib/ujianRuang';

const WARNA_JENJANG = { 7: 'bg-sky-100 text-sky-800 border-sky-200', 8: 'bg-amber-100 text-amber-800 border-amber-200', 9: 'bg-violet-100 text-violet-800 border-violet-200' };
const BATANG_JENJANG = { 7: 'bg-sky-500', 8: 'bg-amber-500', 9: 'bg-violet-500' };

export function BadgeJenjang({ jenjang, jumlah }) {
  return (
    <Badge className={`${WARNA_JENJANG[jenjang] || 'bg-slate-100 text-slate-700 border-slate-200'} font-medium`}>
      Kelas {jenjang}{jumlah !== undefined && <span className="ml-1 opacity-70">· {jumlah}</span>}
    </Badge>
  );
}

function KartuRuang({ ruang, aksi, onPilih, dipilih }) {
  const penuh = ruang.jumlah_peserta >= ruang.kapasitas;
  const persen = Math.min(100, Math.round((ruang.jumlah_peserta / Math.max(ruang.kapasitas, 1)) * 100));
  const Wadah = onPilih ? 'button' : 'div';
  return (
    <Wadah
      {...(onPilih ? { type: 'button', onClick: () => onPilih(ruang), 'aria-pressed': dipilih } : {})}
      className={`flex w-full flex-col gap-3 rounded-xl border p-4 text-left transition-colors ${dipilih ? 'border-[#006837] bg-emerald-50/60' : 'border-slate-200'} ${onPilih ? 'hover:border-[#006837]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006837]' : ''}`}
      data-testid={`ruang-${ruang.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-[#006837]"><DoorClosed className="h-5 w-5" /></div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900">Ruang {ruang.nama_ruang}</div>
            <div className="text-xs font-medium text-slate-600">{labelJenjang(ruang.jenjang)}</div>
            {ruang.keterangan && (
              <div className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-500" title={ruang.keterangan}>
                <MapPin className="h-3 w-3 shrink-0" /> {ruang.keterangan}
              </div>
            )}
          </div>
        </div>
        {aksi}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {ruang.jenjang.map((j) => <BadgeJenjang key={j} jenjang={j} jumlah={ruang.per_jenjang?.[j] ?? 0} />)}
        {ruang.jenjang.length > 1 && <Badge variant="outline" className="font-normal text-slate-500">Campuran 2 jenjang</Badge>}
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="inline-flex items-center gap-1 text-slate-600"><UsersRound className="h-3.5 w-3.5" /> {ruang.jumlah_peserta} / {ruang.kapasitas} peserta</span>
          <span className={penuh ? 'font-semibold text-amber-700' : 'text-slate-400'}>{penuh ? 'Penuh' : `${persen}%`}</span>
        </div>
        {/* Batang keterisian dibagi per jenjang (warna sama dengan badge) agar ruang campuran terlihat proporsinya. */}
        <div className="flex h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={persen} aria-valuemin={0} aria-valuemax={100}
          aria-label={`Keterisian ruang ${ruang.nama_ruang}: ${ruang.jenjang.map((j) => `kelas ${j} ${ruang.per_jenjang?.[j] ?? 0}`).join(', ')}`}>
          {ruang.jenjang.map((j) => (
            <div key={j} className={`h-full ${BATANG_JENJANG[j] || 'bg-[#006837]'}`} style={{ width: `${Math.min(100, ((ruang.per_jenjang?.[j] ?? 0) / Math.max(ruang.kapasitas, 1)) * 100)}%` }} />
          ))}
        </div>
      </div>
    </Wadah>
  );
}

const SARING_JENJANG = [
  { key: 'semua', label: 'Semua', cocok: () => true },
  { key: '7', label: 'Kelas 7', cocok: (r) => r.jenjang.includes(7) },
  { key: '8', label: 'Kelas 8', cocok: (r) => r.jenjang.includes(8) },
  { key: '9', label: 'Kelas 9', cocok: (r) => r.jenjang.includes(9) },
  { key: 'campuran', label: 'Campuran 2 jenjang', cocok: (r) => r.jenjang.length > 1 },
];

/**
 * Daftar Ruang Ujian: kartu per ruang dengan penanda satu/dua jenjang (badge + batang keterisian per jenjang) dan
 * saringan jenjang. `aksi(ruang)` menambah tombol per kartu; `onPilih` membuat kartu dapat dipilih.
 */
export default function DaftarRuang({ items = [], aksi, onPilih, dipilihId, saring = true }) {
  const [jenjang, setJenjang] = React.useState('semua');
  const aturan = SARING_JENJANG.find((x) => x.key === jenjang) || SARING_JENJANG[0];
  // Urut nama ruang secara alami (01, 02, …, 10) agar sesuai nomor ruang di lapangan.
  const tampil = items.filter(aturan.cocok).sort((a, b) => a.nama_ruang.localeCompare(b.nama_ruang, 'id', { numeric: true }));
  return (
    <div className="space-y-3">
      {saring && items.length > 1 && (
        <div role="group" aria-label="Saring ruang per jenjang" className="flex flex-wrap gap-1.5">
          {SARING_JENJANG.map((x) => {
            const n = items.filter(x.cocok).length;
            if (x.key !== 'semua' && !n) return null;
            return (
              <button key={x.key} type="button" onClick={() => setJenjang(x.key)} aria-pressed={jenjang === x.key}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006837] ${
                  jenjang === x.key ? 'border-[#006837] bg-[#006837] text-white' : 'border-slate-200 text-slate-600 hover:bg-emerald-50'}`}
                data-testid={`saring-ruang-${x.key}`}>
                {x.label} <span className="opacity-70">({n})</span>
              </button>
            );
          })}
        </div>
      )}
      {tampil.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500" data-testid="ruang-saring-kosong">
          Tidak ada ruang untuk {aturan.label.toLowerCase()}.
        </p>
      ) : (
        <div className={`grid grid-cols-1 gap-3 ${onPilih ? '' : 'sm:grid-cols-2 xl:grid-cols-3'}`} data-testid="daftar-ruang">
          {tampil.map((r) => <KartuRuang key={r.id} ruang={r} aksi={aksi?.(r)} onPilih={onPilih} dipilih={dipilihId === r.id} />)}
        </div>
      )}
    </div>
  );
}
