import React from 'react';
import { CalendarDays, CheckSquare, List, ListChecks, Lock, Type } from 'lucide-react';
import { labelOpsi, opsiKolom } from '@/lib/pilihanDataMaster';

/**
 * Kelompokkan kolom menurut aturan pengisian yang bisa dibaca dari skema:
 * kunci (penanda baris), tanggal (YYYY-MM-DD), Ya/Tidak, daftar (dipisah ";"),
 * pilihan (isian yang tersedia di aplikasi, lihat lib/pilihanDataMaster.js), dan teks bebas.
 */
export function aturanPengisian(kolom) {
  const aturan = { kunci: [], tanggal: [], yaTidak: [], daftar: [], pilihan: [], teks: [] };
  kolom.forEach((k) => {
    if (k.kunci) aturan.kunci.push(k);
    else if (/YYYY-MM-DD/.test(k.label)) aturan.tanggal.push(k);
    else if (/\(Ya\/Tidak\)/.test(k.label)) aturan.yaTidak.push(k);
    else if (k.daftar) aturan.daftar.push(k);
    else if (opsiKolom(k).length) aturan.pilihan.push(k);
    else aturan.teks.push(k);
  });
  return aturan;
}

const ITEM = [
  { id: 'kunci', icon: Lock, warna: 'text-amber-600', judul: 'Kolom identitas terkunci', isi: 'Penanda baris untuk mencocokkan data. Jangan diubah; baris tanpa identitas valid dilewati saat impor.' },
  { id: 'tanggal', icon: CalendarDays, warna: 'text-sky-600', judul: 'Tanggal', isi: 'Format TAHUN-BULAN-TANGGAL, mis. 2012-05-10.' },
  { id: 'yaTidak', icon: CheckSquare, warna: 'text-emerald-600', judul: 'Ya / Tidak', isi: 'Isi "Ya" atau "Tidak".' },
  { id: 'daftar', icon: List, warna: 'text-violet-600', judul: 'Daftar beberapa nilai', isi: 'Pisahkan dengan titik koma, mis. BCG; Polio.' },
  { id: 'pilihan', icon: ListChecks, warna: 'text-rose-600', judul: 'Pilihan tetap', isi: 'Isi salah satu isian yang tersedia di aplikasi (dropdown di sel). Isian lain ditolak saat impor.' },
  { id: 'teks', icon: Type, warna: 'text-slate-500', judul: 'Teks bebas', isi: 'Tulis apa adanya. Nomor (NIK, KK, HP) tetap ditulis lengkap termasuk angka 0 di depan.' },
];

/** Daftar isian yang tersedia per kolom pilihan (kolom senama, mis. Ayah/Ibu/Wali - Pekerjaan, digabung). */
function DaftarPilihan({ kolom }) {
  const grup = [];
  kolom.forEach((k) => {
    const opsi = labelOpsi(k).join(' / ');
    const nama = k.label.replace(/\s*\([^)]*\)$/, '').replace(/^(Ayah|Ibu|Wali|Alamat Ayah|Alamat Ibu|Alamat Wali|Siswa) - /, '');
    const ada = grup.find((g) => g.opsi === opsi && g.nama === nama);
    if (ada) ada.label.push(k.label); else grup.push({ nama, opsi, label: [k.label] });
  });
  return (
    <details className="mt-1">
      <summary className="cursor-pointer text-slate-500 hover:text-slate-700">Lihat isian yang tersedia ({grup.length} jenis)</summary>
      <ul className="mt-1 max-h-56 space-y-1 overflow-y-auto pr-1" data-testid="daftar-pilihan-legenda">
        {grup.map((g) => (
          <li key={g.nama + g.opsi} title={g.label.join(', ')}>
            <span className="font-medium text-slate-700">{g.nama}</span>
            {g.label.length > 1 && <span className="text-slate-400"> ({g.label.length} kolom)</span>}: <span className="text-slate-600">{g.opsi}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

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
              {id === 'pilihan' && <DaftarPilihan kolom={aturan.pilihan} />}
              {id !== 'teks' && id !== 'pilihan' && (
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
