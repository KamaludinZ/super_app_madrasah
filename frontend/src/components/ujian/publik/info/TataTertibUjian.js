import React, { useMemo } from 'react';
import { ScrollText } from 'lucide-react';
import { pecahTataTertib } from '@/lib/ujianInfoPublik';
import { BagianInfo, KosongInfo } from './BagianInfo';

/**
 * Tata tertib ujian dari teks polos panitia: baris bernomor/berbutir menjadi daftar, sisanya paragraf. Teks kosong
 * (belum diisi panitia) menampilkan keadaan kosong beserta arahan bagi siswa.
 */
export default function TataTertibUjian({ teks }) {
  const blok = useMemo(() => pecahTataTertib(teks), [teks]);
  return (
    <BagianInfo id="tata-tertib" Ikon={ScrollText} judul="Tata Tertib Ujian" keterangan="Baca sampai selesai sebelum mengerjakan ujian.">
      {blok.length ? (
        <div className="space-y-3 text-sm leading-relaxed text-slate-700" data-testid="tata-tertib-isi">
          {blok.map((b, i) => (b.jenis === 'daftar' ? (
            <ol key={`d-${i}`} className="space-y-2">
              {b.butir.map((t, k) => (
                <li key={`b-${k}`} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-bold text-[#006837]">{k + 1}</span>
                  <span className="pt-0.5">{t}</span>
                </li>
              ))}
            </ol>
          ) : <p key={`p-${i}`}>{b.teks}</p>))}
        </div>
      ) : (
        <KosongInfo Ikon={ScrollText} judul="Tata tertib belum diumumkan" testId="tata-tertib-kosong">
          Panitia akan menambahkannya sebelum ujian dimulai. Sementara itu, ikuti arahan pengawas di ruang ujian.
        </KosongInfo>
      )}
    </BagianInfo>
  );
}
