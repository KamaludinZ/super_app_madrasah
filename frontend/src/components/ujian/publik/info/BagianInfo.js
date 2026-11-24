import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { JENJANG_UJIAN, labelJenjang } from '@/lib/mapelUjian';

/** Satu bagian halaman info ujian publik (kartu ber-judul dengan jangkar #id untuk navigasi cepat). */
export function BagianInfo({ id, Ikon, judul, keterangan, aksi, children }) {
  return (
    <section id={id} className="scroll-mt-16 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-labelledby={`${id}-judul`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-[#006837]"><Ikon className="h-4 w-4" /></span>
          <div className="min-w-0">
            <h2 id={`${id}-judul`} className="text-base font-bold text-slate-900">{judul}</h2>
            {keterangan && <p className="text-sm text-slate-500">{keterangan}</p>}
          </div>
        </div>
        {aksi}
      </div>
      {children}
    </section>
  );
}

/**
 * Tiga tab jenjang (Kelas 7 / 8 / 9). `isi(jenjang)` merender isi satu tab; hanya tab aktif yang dirender sehingga
 * mapel jenjang lain tidak tercampur. `lencana(jenjang)` opsional: ringkasan kecil (mis. "10/15") di bawah label tab pada
 * layar sempit dan di sampingnya pada layar lebar, sehingga kemajuan ketiga jenjang terbaca sekaligus.
 */
export function TabJenjang({ nilai, onUbah, isi, lencana, testId }) {
  return (
    <Tabs value={String(nilai)} onValueChange={(v) => onUbah(Number(v))} data-testid={testId}>
      <TabsList className="grid h-auto w-full grid-cols-3 bg-slate-100 p-1">
        {JENJANG_UJIAN.map((j) => (
          <TabsTrigger key={j} value={String(j)} data-testid={`${testId}-tab-${j}`}
            className={`gap-1.5 data-[state=active]:text-[#006837] ${lencana ? 'h-auto min-h-9 flex-col gap-0 py-1 sm:flex-row sm:gap-1.5' : 'h-9'}`}>
            {labelJenjang(j)}
            {lencana && <span className="text-[10px] font-normal tabular-nums text-slate-500 sm:text-[11px]" data-testid={`${testId}-lencana-${j}`}>{lencana(j)}</span>}
          </TabsTrigger>
        ))}
      </TabsList>
      {JENJANG_UJIAN.map((j) => (
        <TabsContent key={j} value={String(j)} className="mt-3">
          {Number(nilai) === j ? isi(j) : null}
        </TabsContent>
      ))}
    </Tabs>
  );
}

/** Keadaan kosong satu bagian: ikon + judul opsional dan keterangan singkat. */
export function KosongInfo({ Ikon, judul, children, testId }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center" data-testid={testId}>
      {Ikon && <Ikon className="mx-auto mb-2 h-7 w-7 text-slate-300" aria-hidden="true" />}
      {judul && <p className="text-sm font-semibold text-slate-700">{judul}</p>}
      <p className={`text-sm text-slate-500 ${judul ? 'mt-0.5' : ''}`}>{children}</p>
    </div>
  );
}
