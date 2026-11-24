import React, { useMemo } from 'react';
import { ScrollText } from 'lucide-react';
import { pecahTataTertib } from '@/lib/ujianInfoPublik';
import { BagianInfo, KosongInfo } from './BagianInfo';

/** Penanda satu butir: tingkat teratas bernomor = lencana bulat; sub-butir = label asli ("a.", "1)"); butir = titik. */
function Penanda({ butir, tingkat }) {
  if (!butir.label) {
    return <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${tingkat ? 'bg-slate-400' : 'bg-[#006837]'}`} aria-hidden="true" />;
  }
  if (!tingkat) {
    return (
      <span className="flex h-6 min-w-[1.5rem] shrink-0 items-center justify-center rounded-full bg-emerald-50 px-1 text-xs font-bold tabular-nums text-[#006837]" aria-hidden="true">
        {butir.label}
      </span>
    );
  }
  return <span className="w-6 shrink-0 pt-px text-right font-semibold tabular-nums text-slate-500" aria-hidden="true">{butir.label}{butir.tanda}</span>;
}

/**
 * Daftar bertingkat; label asli dari teks panitia dipertahankan dan dibacakan pembaca layar. Sengaja fungsi render
 * biasa (bukan komponen yang me-render <Daftar> di dalam dirinya): plugin Babel visual-edits pada `craco start`/test
 * mengalami stack overflow pada komponen JSX rekursif.
 */
function renderDaftar(daftar, tingkat, kunci) {
  const Tag = daftar.penanda === 'butir' ? 'ul' : 'ol';
  return (
    <Tag key={kunci} className={tingkat ? 'mt-1.5 space-y-1.5' : 'space-y-2.5'} data-tingkat={tingkat}>
      {daftar.butir.map((b, k) => (
        <li key={`${tingkat}-${k}`} className={`flex ${tingkat ? 'gap-2' : 'gap-3'}`}>
          <Penanda butir={b} tingkat={tingkat} />
          <div className="min-w-0 flex-1 pt-0.5">
            {b.label && <span className="sr-only">{b.label}{b.tanda || '.'} </span>}
            {b.teks}
            {b.anak && renderDaftar(b.anak, tingkat + 1)}
          </div>
        </li>
      ))}
    </Tag>
  );
}

/**
 * Tata tertib ujian dari teks polos panitia: baris bernomor/berhuruf/berbutir menjadi daftar bertingkat (mis. 1. → a.),
 * sisanya paragraf. Teks kosong (belum diisi panitia) menampilkan keadaan kosong beserta arahan bagi siswa.
 */
export default function TataTertibUjian({ teks }) {
  const blok = useMemo(() => pecahTataTertib(teks), [teks]);
  return (
    <BagianInfo id="tata-tertib" Ikon={ScrollText} judul="Tata Tertib Ujian" keterangan="Baca sampai selesai sebelum mengerjakan ujian.">
      {blok.length ? (
        <div className="space-y-3 text-sm leading-relaxed text-slate-700" data-testid="tata-tertib-isi">
          {blok.map((b, i) => (b.jenis === 'daftar'
            ? renderDaftar(b, 0, `d-${i}`)
            : <p key={`p-${i}`}>{b.teks}</p>))}
        </div>
      ) : (
        <KosongInfo Ikon={ScrollText} judul="Tata tertib belum diumumkan" testId="tata-tertib-kosong">
          Panitia akan menambahkannya sebelum ujian dimulai. Sementara itu, ikuti arahan pengawas di ruang ujian.
        </KosongInfo>
      )}
    </BagianInfo>
  );
}
