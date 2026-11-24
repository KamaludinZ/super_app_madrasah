import React, { useMemo } from 'react';
import { Download, FileDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatWIB } from '@/lib/datetime';
import { formatUkuran, kisiKisiJenjang } from '@/lib/ujianInfoPublik';
import { labelJenjang, mapelUntuk } from '@/lib/mapelUjian';
import { BagianInfo, TabJenjang } from './BagianInfo';

const tglPendek = (iso) => formatWIB(iso, 'Date', { day: 'numeric', month: 'short' });

const angka = (n) => Number(n || 0).toLocaleString('id-ID');

function BarisMapel({ baris, jenjang, mengunduh, disorot, onUnduh }) {
  const b = baris.berkas;
  const sibuk = mengunduh === b?.id;
  const baru = !!b && disorot === b.id; // penghitung baru bertambah: sorot sebentar
  return (
    <li className="flex items-center gap-3 px-3 py-2.5" data-testid={`kisi-${jenjang}-${baris.kode}`} data-tersedia={b ? 'ya' : 'tidak'}>
      <span className="w-6 shrink-0 text-right text-xs tabular-nums text-slate-400">{baris.nomor}</span>
      <div className="min-w-0 flex-1">
        <div className={`truncate text-sm font-semibold ${b ? 'text-slate-900' : 'text-slate-400'}`}>{baris.nama}</div>
        <div className="truncate text-xs text-slate-500">
          {b ? <>PDF · {formatUkuran(b.ukuran_byte)} · <span className="hidden sm:inline">diperbarui </span>{tglPendek(b.updated_at)}</> : 'Kisi-kisi belum dikirim guru PJ'}
        </div>
      </div>
      {b ? (
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <Button size="sm" variant="outline" onClick={() => onUnduh(b)} disabled={!!mengunduh}
            className="h-9 gap-1.5 border-emerald-200 text-[#006837] hover:bg-emerald-50 hover:text-[#005830]"
            aria-label={`Unduh kisi-kisi ${baris.nama} ${labelJenjang(jenjang)}`} data-testid={`kisi-${jenjang}-${baris.kode}-unduh`}>
            {sibuk ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Unduh
          </Button>
          <span className={`text-[11px] tabular-nums transition-colors duration-500 ${baru ? 'font-semibold text-[#006837]' : 'text-slate-500'}`}
            title="Jumlah unduhan" aria-live="polite" data-testid={`kisi-${jenjang}-${baris.kode}-jumlah`}>
            {angka(b.jumlah_unduh)}× diunduh
          </span>
        </div>
      ) : (
        <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-500">Belum ada</span>
      )}
    </li>
  );
}

function DaftarKisi({ kisiKisi, mapel, jenjang, mengunduh, disorot, onUnduh }) {
  const baris = useMemo(() => kisiKisiJenjang(kisiKisi, jenjang, mapelUntuk(mapel, jenjang)), [kisiKisi, mapel, jenjang]);
  const tersedia = baris.filter((r) => r.berkas);
  const total = tersedia.reduce((n, r) => n + (r.berkas.jumlah_unduh || 0), 0);
  return (
    <>
      <p className="mb-2 text-xs text-slate-500" data-testid={`kisi-${jenjang}-ringkas`}>
        {tersedia.length} dari {baris.length} mapel {labelJenjang(jenjang)} tersedia · total <span data-testid={`kisi-${jenjang}-total`}>{angka(total)}</span> kali diunduh
      </p>
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200" data-testid={`kisi-jenjang-${jenjang}`}>
        {baris.map((r) => <BarisMapel key={r.kode} baris={r} jenjang={jenjang} mengunduh={mengunduh} disorot={disorot} onUnduh={onUnduh} />)}
      </ul>
    </>
  );
}

/**
 * Kisi-kisi ujian dalam tiga tab jenjang. Tiap tab memuat 15 mapel baku (urutan baku) hanya untuk jenjang itu;
 * mapel yang belum dikirim guru PJ tampil "Belum ada". Setiap klik unduh dihitung server; penghitung yang baru
 * bertambah (`disorot` = id berkas) disorot sebentar.
 */
export default function KisiKisiPerJenjang({ kisiKisi, mapel, jenjang, onUbahJenjang, mengunduh, disorot, onUnduh }) {
  const lencana = (j) => {
    const baris = kisiKisiJenjang(kisiKisi, j, mapelUntuk(mapel, j)); // hanya mapel baku aktif
    return `${baris.filter((r) => r.berkas).length}/${baris.length}`;
  };
  return (
    <BagianInfo id="kisi-kisi" Ikon={FileDown} judul="Kisi-kisi Ujian" keterangan="Unduh kisi-kisi sesuai kelasmu (PDF).">
      <TabJenjang nilai={jenjang} onUbah={onUbahJenjang} testId="kisi" lencana={lencana}
        isi={(j) => <DaftarKisi kisiKisi={kisiKisi} mapel={mapel} jenjang={j} mengunduh={mengunduh} disorot={disorot} onUnduh={onUnduh} />} />
    </BagianInfo>
  );
}
