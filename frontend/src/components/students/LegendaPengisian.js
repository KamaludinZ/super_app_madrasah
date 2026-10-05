import React from 'react';
import { CalendarDays, CheckSquare, List, ListChecks, Lock, Type } from 'lucide-react';

/**
 * Kelompokkan kolom menurut aturan pengisian yang bisa dibaca dari skema:
 * kunci (penanda baris), tanggal (YYYY-MM-DD), Ya/Tidak, daftar (dipisah ";"),
 * pilihan kode (tertulis di judul dalam kurung, dipisah "/"), dan teks bebas.
 */
export function aturanPengisian(kolom) {
  const aturan = { kunci: [], tanggal: [], yaTidak: [], daftar: [], pilihan: [], teks: [] };
  kolom.forEach((k) => {
    if (k.kunci) aturan.kunci.push(k);
    else if (/YYYY-MM-DD/.test(k.label)) aturan.tanggal.push(k);
    else if (/\(Ya\/Tidak\)/.test(k.label)) aturan.yaTidak.push(k);
    else if (k.daftar) aturan.daftar.push(k);
    else if (/\([^)]*\/[^)]*\)/.test(k.label)) aturan.pilihan.push(k);
    else aturan.teks.push(k);
  });
  return aturan;
}

const ITEM = [
  { id: 'kunci', icon: Lock, warna: 'text-amber-600', judul: 'Kolom identitas terkunci', isi: 'Penanda baris untuk mencocokkan data. Jangan diubah; baris tanpa identitas valid dilewati saat impor.' },
  { id: 'tanggal', icon: CalendarDays, warna: 'text-sky-600', judul: 'Tanggal', isi: 'Format TAHUN-BULAN-TANGGAL, mis. 2012-05-10.' },
  { id: 'yaTidak', icon: CheckSquare, warna: 'text-emerald-600', judul: 'Ya / Tidak', isi: 'Isi "Ya" atau "Tidak".' },
  { id: 'daftar', icon: List, warna: 'text-violet-600', judul: 'Daftar beberapa nilai', isi: 'Pisahkan dengan titik koma, mis. BCG; Polio.' },
  { id: 'pilihan', icon: ListChecks, warna: 'text-rose-600', judul: 'Pilihan tetap', isi: 'Isi salah satu kode yang tertulis di judul kolom (dalam kurung), mis. pns, L, menikah.' },
  { id: 'teks', icon: Type, warna: 'text-slate-500', judul: 'Teks bebas', isi: 'Tulis apa adanya. Nomor (NIK, KK, HP) tetap ditulis lengkap termasuk angka 0 di depan.' },
];

/** Legenda petunjuk pengisian kolom template, dengan contoh kolom tiap aturan. */
export default function LegendaPengisian({ kolom }) {
  const aturan = aturanPengisian(kolom);
  return (
    <div className="rounded-lg border border-slate-200 px-3 py-2" data-testid="legenda-pengisian">
      <div className="mb-1.5 text-sm font-medium text-slate-800">Petunjuk pengisian</div>
      <ul className="space-y-1.5">
        {ITEM.filter((it) => aturan[it.id].length > 0).map(({ id, icon: Icon, warna, judul, isi }) => (
          <li key={id} className="flex gap-2 text-xs text-slate-700">
            <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${warna}`} aria-hidden="true" />
            <div>
              <span className="font-semibold">{judul}</span> <span className="text-slate-500">({aturan[id].length} kolom)</span> — {isi}
              {id !== 'teks' && (
                <div className="mt-0.5 truncate text-slate-500" title={aturan[id].map((k) => k.label).join(', ')}>
                  Contoh: {aturan[id].slice(0, 3).map((k) => k.label.replace(/\s*\([^)]*\)$/, '')).join(', ')}
                  {aturan[id].length > 3 ? ', …' : ''}
                </div>
              )}
            </div>
          </li>
        ))}
        <li className="text-xs text-slate-500">Kolom yang dikosongkan tidak mengubah data tersimpan (mode bawaan impor: hanya mengisi yang kosong).</li>
      </ul>
    </div>
  );
}
