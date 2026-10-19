import React, { useMemo, useState } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { formatPersen, porsiBobot } from '@/lib/pkgInstrumen';

// Warna penanda level 1–5 (dari "memahami" sampai "membimbing rekan sejawat").
const WARNA_LEVEL = {
  1: 'bg-slate-100 text-slate-700',
  2: 'bg-sky-100 text-sky-700',
  3: 'bg-amber-100 text-amber-800',
  4: 'bg-emerald-100 text-emerald-700',
  5: 'bg-violet-100 text-violet-700',
};

const cocok = (teks, kata) => (teks || '').toLowerCase().includes(kata);

// Saring hierarki: kompetensi/sub yang namanya cocok tampil utuh; selain itu hanya indikator yang cocok.
function saring(kompetensi, kata) {
  if (!kata) return kompetensi;
  return kompetensi.map((k) => {
    if (cocok(k.nama, kata)) return k;
    const sub = k.sub.map((s) => {
      if (cocok(s.nama, kata) || cocok(s.kode, kata)) return s;
      const indikator = s.indikator.filter((i) => cocok(i.teks, kata));
      return indikator.length ? { ...s, indikator } : null;
    }).filter(Boolean);
    return sub.length ? { ...k, sub } : null;
  }).filter(Boolean);
}

function TeksSorot({ teks, kata }) {
  if (!kata) return teks;
  const i = teks.toLowerCase().indexOf(kata);
  if (i < 0) return teks;
  return (
    <>
      {teks.slice(0, i)}
      <mark className="rounded bg-amber-200/70 px-0.5">{teks.slice(i, i + kata.length)}</mark>
      {teks.slice(i + kata.length)}
    </>
  );
}

// Hierarki instrumen PKG: kompetensi -> sub-kompetensi (bobot & porsi terhadap total bobot) -> indikator perilaku
// Level 1–5. `kompetensi` = [{ kode, nama, sub: [{ kode, nama, bobot, indikator: [{ level, teks }] }] }].
export default function HierarkiInstrumen({ kompetensi = [] }) {
  const [cari, setCari] = useState('');
  const kata = cari.trim().toLowerCase();

  const totalBobot = useMemo(
    () => kompetensi.flatMap((k) => k.sub).reduce((n, s) => n + (Number(s.bobot) || 0), 0),
    [kompetensi],
  );
  const tampil = useMemo(() => saring(kompetensi, kata), [kompetensi, kata]);
  const porsi = (bobot) => formatPersen(porsiBobot(bobot, totalBobot));
  const bobotKompetensi = (k) => k.sub.reduce((n, s) => n + (Number(s.bobot) || 0), 0);

  // Saat mencari, semua bagian yang cocok dibuka; selain itu pengguna membuka sendiri.
  const terbukaCari = kata ? tampil.map((k) => k.kode) : undefined;
  const subTerbukaCari = kata ? tampil.flatMap((k) => k.sub.map((s) => s.kode)) : undefined;

  return (
    <div className="space-y-3" data-testid="pkg-hierarki-instrumen">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari kompetensi atau indikator" className="pl-8 h-9" data-testid="pkg-hierarki-cari" />
      </div>
      {tampil.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Tidak ada kompetensi atau indikator yang cocok.</p>}

      {/* key berganti antara mode cari (terkontrol) dan biasa agar Accordion dipasang ulang dengan bersih. */}
      <Accordion key={kata ? `cari:${kata}` : 'biasa'} type="multiple" {...(terbukaCari ? { value: terbukaCari } : {})} className="space-y-3">
        {tampil.map((k) => (
          <AccordionItem key={k.kode} value={k.kode} className="rounded-xl border border-slate-200 bg-white px-4" data-testid={`pkg-hierarki-${k.kode}`}>
            <AccordionTrigger className="hover:no-underline">
              <div className="flex flex-1 items-center gap-3 text-left">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-sm font-bold text-[#006837]">{k.kode}</span>
                <span className="font-semibold text-slate-900"><TeksSorot teks={k.nama} kata={kata} /></span>
                <span className="ml-auto mr-2 hidden sm:flex items-center gap-2 text-xs font-normal text-slate-500">
                  {k.sub.length} sub · bobot <span className="tabular-nums font-semibold text-slate-700">{porsi(bobotKompetensi(k))}</span>
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <Accordion key={kata ? `cari:${kata}` : 'biasa'} type="multiple" {...(subTerbukaCari ? { value: subTerbukaCari } : {})} className="space-y-2 pb-1">
                {k.sub.map((s) => (
                  <AccordionItem key={s.kode} value={s.kode} className="rounded-lg border border-slate-200 px-3" data-testid={`pkg-hierarki-sub-${s.kode}`}>
                    <AccordionTrigger className="py-2.5 hover:no-underline">
                      <div className="flex flex-1 items-start gap-3 text-left">
                        <span className="shrink-0 font-mono text-xs font-semibold text-slate-500 mt-0.5">{s.kode}</span>
                        <span className="min-w-0 flex-1 text-sm text-slate-800"><TeksSorot teks={s.nama} kata={kata} /></span>
                        <Badge variant="outline" className="mr-2 shrink-0 tabular-nums" title={`Bobot ${s.bobot} dari total ${totalBobot}`}>
                          {porsi(s.bobot)}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <ol className="space-y-1.5 pb-1">
                        {s.indikator.map((i) => (
                          <li key={i.level} className="flex items-start gap-2 text-sm text-slate-700">
                            <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold ${WARNA_LEVEL[i.level] || WARNA_LEVEL[1]}`}>Level {i.level}</span>
                            <span><TeksSorot teks={i.teks} kata={kata} /></span>
                          </li>
                        ))}
                      </ol>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
