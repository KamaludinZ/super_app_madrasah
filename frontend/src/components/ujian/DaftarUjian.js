import React, { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { CalendarRange, DoorClosed, UsersRound, BadgeCheck } from 'lucide-react';
import BadgeStatusFormulir from '@/components/ujian/BadgeStatusFormulir';
import { formatWIB } from '@/lib/datetime';
import { hariIniWIB } from '@/lib/tanggal';
import { JENIS_UJIAN, LABEL_JABATAN } from '@/lib/ujian';

const tgl = (v, opsi) => formatWIB(v, 'Date', opsi);

export function rentangTanggal(mulai, selesai) {
  if (!mulai) return '-';
  if (!selesai || selesai === mulai) return tgl(mulai, { day: 'numeric', month: 'long', year: 'numeric' });
  return `${tgl(mulai, { day: 'numeric', month: 'short' })} – ${tgl(selesai, { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

// Masa ujian menurut tanggal WIB hari ini: 'berlangsung' | 'akan_datang' | 'lewat'.
export function masaUjian(ujian, hariIni = hariIniWIB()) {
  if (ujian.mulai && hariIni < ujian.mulai) return 'akan_datang';
  if (ujian.selesai && hariIni > ujian.selesai) return 'lewat';
  return 'berlangsung';
}

const LABEL_MASA = {
  berlangsung: { label: 'Berlangsung', kelas: 'text-emerald-700' },
  akan_datang: { label: 'Akan datang', kelas: 'text-sky-700' },
  lewat: { label: 'Sudah lewat', kelas: 'text-slate-400' },
};

function BarisUjian({ ujian, hariIni }) {
  const jenis = JENIS_UJIAN[ujian.jenis] || JENIS_UJIAN.UTS;
  const masa = LABEL_MASA[masaUjian(ujian, hariIni)];
  return (
    <li className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between" data-testid={`ujian-baris-${ujian.id}`}>
      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={jenis.kelas} title={jenis.nama}>{jenis.label}</Badge>
          <h3 className="text-sm font-semibold text-slate-900 sm:text-base">{ujian.nama}</h3>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <CalendarRange className="h-3.5 w-3.5" /> {rentangTanggal(ujian.mulai, ujian.selesai)}
            <span className={`font-medium ${masa.kelas}`}>· {masa.label}</span>
          </span>
          <span className="inline-flex items-center gap-1"><DoorClosed className="h-3.5 w-3.5" /> {ujian.jumlah_ruang ?? 0} ruang</span>
          <span className="inline-flex items-center gap-1"><UsersRound className="h-3.5 w-3.5" /> {ujian.jumlah_peserta ?? 0} peserta</span>
          {ujian.jabatan_saya && (
            <span className="inline-flex items-center gap-1 font-medium text-[#006837]">
              <BadgeCheck className="h-3.5 w-3.5" /> {LABEL_JABATAN[ujian.jabatan_saya] || ujian.jabatan_saya}
            </span>
          )}
        </div>
      </div>
      <div className="shrink-0">
        <BadgeStatusFormulir formulir={ujian.formulir} />
      </div>
    </li>
  );
}

const SARINGAN = [
  { key: 'semua', label: 'Semua' },
  { key: 'UTS', label: 'UTS' },
  { key: 'UAS', label: 'UAS' },
];

/**
 * Daftar Ujian: seluruh UTS & UAS dalam satu daftar yang mudah dipindai — urut tanggal mulai, dapat disaring per
 * jenis, dengan status formulir dan masa ujian (berlangsung / akan datang / sudah lewat) pada tiap baris.
 */
export default function DaftarUjian({ items = [], saring = true }) {
  const [jenis, setJenis] = useState('semua');
  const hariIni = hariIniWIB();
  const urut = useMemo(
    () => [...items].sort((a, b) => (a.mulai || '').localeCompare(b.mulai || '') || (a.nama || '').localeCompare(b.nama || '')),
    [items],
  );
  const tampil = jenis === 'semua' ? urut : urut.filter((u) => u.jenis === jenis);
  const jumlah = (k) => (k === 'semua' ? items.length : items.filter((u) => u.jenis === k).length);

  return (
    <div className="space-y-4">
      {saring && (
      <div role="group" aria-label="Saring jenis ujian" className="flex flex-wrap gap-1.5" data-testid="saring-jenis-ujian">
        {SARINGAN.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setJenis(s.key)}
            aria-pressed={jenis === s.key}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006837] ${
              jenis === s.key ? 'border-[#006837] bg-[#006837] text-white' : 'border-slate-200 text-slate-600 hover:bg-emerald-50'}`}
            data-testid={`saring-jenis-${s.key}`}
          >
            {s.label} <span className="opacity-70">({jumlah(s.key)})</span>
          </button>
        ))}
      </div>
      )}
      {tampil.length ? (
        <ul className="divide-y divide-slate-100" data-testid="daftar-ujian">
          {tampil.map((u) => <BarisUjian key={u.id} ujian={u} hariIni={hariIni} />)}
        </ul>
      ) : (
        <p className="py-6 text-center text-sm text-slate-500">Tidak ada ujian {jenis} pada semester ini.</p>
      )}
    </div>
  );
}
