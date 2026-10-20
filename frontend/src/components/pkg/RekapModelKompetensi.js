import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calculator } from 'lucide-react';

const FORMAT = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Rekapitulasi hasil penilaian model kompetensi guru (sheet 04-RKAP-PKG): nilai rating & tingkat per sub-kompetensi
// dikelompokkan per kompetensi, jumlah skor, dan capaian tingkat kompetensi. `model` dari lib/pkgRekap.ambilModelKompetensi.
export function TabelModelKompetensi({ model }) {
  return (
    <Card data-testid="pkg-model-kompetensi">
      <CardHeader className="pb-3"><CardTitle className="text-base">Rekapitulasi Model Kompetensi Guru</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="w-10 py-1.5 pr-2 font-medium">No</th>
              <th className="py-1.5 pr-3 font-medium">Kompetensi</th>
              <th className="py-1.5 px-2 text-center font-medium">Tingkat kompetensi</th>
              <th className="py-1.5 pl-2 text-right font-medium">Nilai rating</th>
            </tr>
          </thead>
          <tbody>
            {model.kompetensi.map((k, i) => (
              <React.Fragment key={k.kode}>
                <tr className="bg-emerald-50/60">
                  <td className="py-1.5 pr-2 font-semibold text-[#006837]">{String.fromCharCode(65 + i)}.</td>
                  <td className="py-1.5 pr-3 font-semibold text-slate-900" colSpan={2}>{k.nama || k.label}</td>
                  <td className="py-1.5 pl-2 text-right font-semibold tabular-nums">{k.jumlah_skor}<span className="text-xs font-normal text-slate-500">/{k.skor_maks}</span></td>
                </tr>
                {k.sub.map((s) => (
                  <tr key={s.kode} className="border-b border-slate-100" data-testid={`pkg-model-sub-${s.kode}`}>
                    <td className="py-1.5 pr-2 tabular-nums text-slate-500">{s.no}</td>
                    <td className="py-1.5 pr-3 text-slate-800">{s.nama || s.kode}</td>
                    <td className="py-1.5 px-2 text-center">{s.tingkat ? <Badge variant="outline">{s.tingkat}</Badge> : '-'}</td>
                    <td className="py-1.5 pl-2 text-right tabular-nums">{s.nilai_rating}</td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 font-semibold">
              <td colSpan={3} className="py-2 pr-3">Jumlah (hasil penilaian kompetensi profesional guru)</td>
              <td className="py-2 pl-2 text-right tabular-nums">{model.total_skor}</td>
            </tr>
            <tr className="font-semibold">
              <td colSpan={2} className="py-1 pr-3">Capaian tingkat kompetensi</td>
              <td className="py-1 px-2 text-center">{model.level_capaian || '-'}</td>
              <td className="py-1 pl-2 text-right tabular-nums">{FORMAT.format(model.nkg)}</td>
            </tr>
          </tfoot>
        </table>
        <p className="mt-2 text-xs text-slate-500">Nilai rating per sub = jumlah indikator yang terpenuhi (minimum 1, maksimum 5).</p>
      </CardContent>
    </Card>
  );
}

// Format penghitungan NKG (sheet 05-RKAP-PKGR): jumlah skor per kompetensi, total, lalu NKG = total / skor maks x 100.
// `tambahan` (opsional) dirender di bawahnya untuk langkah lanjutan (komponen 360° & kehadiran).
export function FormatPenghitungan({ model, tambahan = null }) {
  return (
    <Card data-testid="pkg-format-penghitungan">
      <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Calculator className="h-4 w-4 text-[#006837]" /> Format Penghitungan</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="w-8 py-1.5 font-medium">No</th>
              <th className="py-1.5 pr-3 font-medium">Kompetensi profesional guru</th>
              <th className="py-1.5 pr-3 font-medium">Kode PKG</th>
              <th className="py-1.5 text-right font-medium">Jumlah skor</th>
            </tr>
          </thead>
          <tbody>
            {model.kompetensi.map((k, i) => (
              <tr key={k.kode} className="border-b border-slate-100">
                <td className="py-1.5">{String.fromCharCode(65 + i)}.</td>
                <td className="py-1.5 pr-3 text-slate-800">{k.nama || '-'}</td>
                <td className="py-1.5 pr-3 text-xs text-slate-500">{k.label}</td>
                <td className="py-1.5 text-right tabular-nums">{k.jumlah_skor}</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td />
              <td className="py-1.5 pr-3" colSpan={2}>Total</td>
              <td className="py-1.5 text-right tabular-nums">{model.total_skor}</td>
            </tr>
          </tbody>
        </table>
        <div className="rounded-lg bg-slate-50 p-3 text-sm">
          <div className="text-xs text-slate-500">NKG = (Total skor / {model.skor_maks}) × 100</div>
          <div className="mt-1 font-mono tabular-nums text-slate-800">
            ({model.total_skor} / {model.skor_maks}) × 100 = <span className="font-bold text-[#006837]">{FORMAT.format(model.nkg)}</span>
          </div>
          <div className="mt-1 text-xs text-slate-600">{model.level_capaian || '-'} · {model.predikat || '-'}</div>
        </div>
        {tambahan}
      </CardContent>
    </Card>
  );
}

// Level guru seperti lembar 01-LAPORN: Normal (04-RKAP-PKG), Plus 360 (05-RKAP-PKGR), simpulan rata-rata keduanya
// (template mengosongkan simpulan bila rata-ratanya pecahan), dan deskripsi capaian dari RUBRIK-CAPAIAN.
// `levelGuru` = { normal, plus_360, rata, simpulan, deskripsi: { umum, pedagogik, ... } | null }.
export function KartuLevelGuru({ levelGuru }) {
  if (!levelGuru) return null;
  const sel = [
    ['Normal', levelGuru.normal, 'Dari capaian kompetensi (04-RKAP-PKG)'],
    ['Plus 360', levelGuru.plus_360, 'Dari nilai akhir dengan 360° & kehadiran (05-RKAP-PKGR)'],
    ['Simpulan', levelGuru.simpulan, levelGuru.rata != null ? `Rata-rata ${String(levelGuru.rata).replace('.', ',')}` : 'Rata-rata level'],
  ];
  return (
    <Card data-testid="pkg-level-guru">
      <CardHeader className="pb-3"><CardTitle className="text-base">Tingkat Kompetensi &amp; Level Guru</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {sel.map(([label, nilai, ket]) => (
            <div key={label} className="rounded-lg border border-slate-200 p-3">
              <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
              <div className="text-xl font-bold text-[#006837]">{nilai || '-'}</div>
              <div className="text-xs text-slate-500">{ket}</div>
            </div>
          ))}
        </div>
        {!levelGuru.plus_360 && (
          <p className="text-xs text-slate-500">Level Plus 360 tersedia setelah data angket 360° dan kehadiran guru diinput.</p>
        )}
        {levelGuru.rata != null && !levelGuru.simpulan && (
          <p className="text-xs text-amber-700">Rata-rata level berupa pecahan; sesuai template resmi, hasil evaluasi dikosongkan.</p>
        )}
        {levelGuru.deskripsi?.umum && (
          <div className="rounded-lg bg-emerald-50 p-3 text-sm text-slate-700">
            <div className="mb-1 text-xs font-semibold text-emerald-800">Deskripsi capaian ({levelGuru.simpulan})</div>
            {levelGuru.deskripsi.umum}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Lanjutan format penghitungan (05-RKAP-PKGR baris 34–44): komponen atasan & rerata kuesioner 360° x proporsi,
// nilai kompetensi guru, indeks kehadiran, dan nilai akhir PK Guru. `akhir` dari backend pkg_nilai_akhir.
export function NilaiAkhir360({ akhir, tautanKomponen }) {
  if (!akhir) return null;
  return (
    <div className="space-y-3" data-testid="pkg-nilai-akhir-360">
      <div className="text-sm font-semibold text-slate-900">Penilaian 360 derajat &amp; kehadiran</div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="w-8 py-1.5 font-medium">No</th>
              <th className="py-1.5 pr-3 font-medium">Penilaian</th>
              <th className="py-1.5 pr-3 text-right font-medium">Hasil penilaian</th>
              <th className="py-1.5 pr-3 text-right font-medium">Proporsi</th>
              <th className="py-1.5 text-right font-medium">Nilai</th>
            </tr>
          </thead>
          <tbody>
            {akhir.komponen.map((k, i) => (
              <tr key={k.kunci} className="border-b border-slate-100">
                <td className="py-1.5">{i + 1}.</td>
                <td className="py-1.5 pr-3 text-slate-800">
                  {k.label}
                  {k.kunci !== 'atasan' && <span className="ml-1 text-xs text-slate-500">({k.jumlah_responden || 0} responden)</span>}
                </td>
                <td className={`py-1.5 pr-3 text-right tabular-nums ${k.hasil == null ? 'text-amber-700' : ''}`}>{k.hasil != null ? FORMAT.format(k.hasil) : 'belum ada'}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{Math.round(k.proporsi * 100)}%</td>
                <td className="py-1.5 text-right tabular-nums">{FORMAT.format(k.nilai)}</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td />
              <td className="py-1.5 pr-3">Nilai Kompetensi Guru</td>
              <td />
              <td className="py-1.5 pr-3 text-right tabular-nums">{Math.round(akhir.jumlah_proporsi * 100)}%</td>
              <td className="py-1.5 text-right tabular-nums">{FORMAT.format(akhir.nilai_kompetensi)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
        <div className="rounded-lg bg-slate-50 p-3">
          <dt className="text-xs text-slate-500">Ketidakhadiran (hari, termasuk konversi menit)</dt>
          <dd className="font-semibold tabular-nums">{FORMAT.format(akhir.tidak_hadir_hari || 0)}</dd>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <dt className="text-xs text-slate-500">Persentase nilai dari kehadiran</dt>
          <dd className="font-semibold tabular-nums">{FORMAT.format(akhir.indeks_kehadiran_persen)}%</dd>
        </div>
        <div className="rounded-lg bg-[#006837] p-3 text-white">
          <dt className="text-xs text-emerald-100">Nilai Akhir PK Guru</dt>
          <dd className="text-xl font-bold tabular-nums">{FORMAT.format(akhir.nilai_akhir)}</dd>
          <dd className="text-xs text-emerald-100">{akhir.level_teks || '-'}</dd>
        </div>
      </dl>
      <p className="text-xs text-slate-600">Tingkat capaian: {akhir.predikat || '-'} {akhir.level_teks || ''}</p>
      {!akhir.lengkap && (
        <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
          {akhir.angket_kurang?.length > 0 && <>Angket {akhir.angket_kurang.join(', ')} belum memiliki responden (dihitung 0). </>}
          {!akhir.kehadiran_terisi && <>Rekap kehadiran belum diinput (dihitung 100%). </>}
          {tautanKomponen}
        </p>
      )}
    </div>
  );
}
