import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, Loader2, Pencil } from 'lucide-react';
import { aksesDitolak, pesanGalat } from '@/lib/ujian';
import { muatPilihanNilai, muatRekapNilai } from '@/lib/ujianNilai';
import AksesDitolak from '@/components/security/AksesDitolak';
import { Button } from '@/components/ui/button';
import FormEditNilaiKelas from '@/components/ujian/nilai/FormEditNilaiKelas';

/**
 * Panel utama Nilai UAS: pilih mata pelajaran & jenjang, lalu lihat keterisian nilai UAS tiap kelas pada jenjang itu
 * (jumlah terisi, rata-rata, guru pengampu). `anak(pilihan)` merender aksi tambahan (template, impor) untuk pilihan aktif.
 */
export default function PanelNilaiUas({ ujian, segarkan = 0, anak }) {
  const [pilihan, setPilihan] = useState(null);
  const [mapelId, setMapelId] = useState('');
  const [jenjang, setJenjang] = useState('');
  const [rekap, setRekap] = useState(null);
  const [ditolak, setDitolak] = useState('');
  const [edit, setEdit] = useState(null);

  useEffect(() => {
    let hidup = true;
    setPilihan(null);
    muatPilihanNilai(ujian.id).then((p) => {
      if (!hidup) return;
      setPilihan(p);
      setMapelId((m) => m || p.mapel[0]?.id || '');
      setJenjang((j) => j || String(p.jenjang[0]?.jenjang || ''));
    }).catch((e) => {
      if (!hidup) return;
      if (aksesDitolak(e)) setDitolak(pesanGalat(e, 'Akses ditolak.'));
      else toast.error(pesanGalat(e, 'Gagal memuat pilihan nilai.'));
    });
    return () => { hidup = false; };
  }, [ujian]);

  const muatRekap = useCallback(async () => {
    if (!mapelId || !jenjang) return;
    setRekap(null);
    try {
      setRekap(await muatRekapNilai(ujian.id, mapelId, jenjang));
    } catch (e) {
      toast.error(pesanGalat(e, 'Gagal memuat rekap nilai.'));
    }
  }, [ujian, mapelId, jenjang]);
  useEffect(() => { muatRekap(); }, [muatRekap, segarkan]);

  if (ditolak) return <AksesDitolak halaman="Nilai UAS" untuk="admin serta ketua dan sekretaris panitia" pesan={ditolak} />;
  if (!pilihan) return <div className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-[#006837]" /></div>;
  const mapel = pilihan.mapel.find((m) => m.id === mapelId);
  const kelas = rekap?.kelas || [];

  return (
    <div className="space-y-4" data-testid="panel-nilai-uas">
      {pilihan.tiruan && <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">Server belum menyediakan data nilai — menampilkan data contoh.</p>}
      {!pilihan.boleh_impor && pilihan.pesan && (
        <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700" role="status" data-testid="nilai-tidak-bisa-impor">{pilihan.pesan}</p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="nilai-mapel" className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mata pelajaran</label>
          <select id="nilai-mapel" value={mapelId} onChange={(e) => setMapelId(e.target.value)} data-testid="nilai-pilih-mapel"
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006837]">
            {pilihan.mapel.map((m) => <option key={m.id} value={m.id}>{m.nama}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Jenjang</span>
          <div role="radiogroup" aria-label="Jenjang" className="flex gap-2">
            {pilihan.jenjang.map((j) => (
              <button key={j.jenjang} type="button" role="radio" aria-checked={String(j.jenjang) === jenjang} onClick={() => setJenjang(String(j.jenjang))}
                className={`h-10 flex-1 rounded-md border text-sm font-medium ${String(j.jenjang) === jenjang ? 'border-[#006837] bg-[#006837] text-white' : 'border-slate-200 hover:bg-emerald-50'}`}
                data-testid={`nilai-jenjang-${j.jenjang}`}>
                Kelas {j.jenjang} <span className="opacity-70">({j.kelas.length})</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {anak && mapel && jenjang && anak({ mapel, jenjang: Number(jenjang), kelas: pilihan.jenjang.find((j) => String(j.jenjang) === jenjang)?.kelas || [], boleh: pilihan.boleh_impor, muatRekap })}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><BookOpen className="h-4 w-4 text-[#006837]" /> Nilai UAS {mapel?.nama} · Kelas {jenjang}</CardTitle>
        </CardHeader>
        <CardContent>
          {!rekap ? <div className="p-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-[#006837]" /></div>
            : kelas.length === 0 ? <p className="py-4 text-center text-sm text-slate-500">Belum ada kelas pada jenjang ini.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="rekap-nilai-kelas">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="py-2 pr-2 font-semibold">Kelas</th><th className="py-2 pr-2 font-semibold">Guru mapel</th>
                      <th className="py-2 pr-2 text-right font-semibold">Terisi</th><th className="py-2 pr-2 text-right font-semibold">Rata-rata</th>
                      <th className="py-2 pr-2 text-right font-semibold" title="Baris rapor siswa yang sudah memuat nilai UAS ini">Di rapor</th>
                      <th className="py-2"><span className="sr-only">Aksi</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {kelas.map((k) => (
                      <tr key={k.kelas_id} className="border-b border-slate-100 last:border-0">
                        <td className="py-2 pr-2 font-medium">{k.nama}</td>
                        <td className="py-2 pr-2 text-slate-600">{k.guru_nama || '—'}</td>
                        <td className={`py-2 pr-2 text-right tabular-nums ${k.terisi < k.total ? 'text-amber-700' : 'text-emerald-700'}`}>{k.terisi}/{k.total}</td>
                        <td className="py-2 pr-2 text-right tabular-nums">{k.rata != null ? k.rata.toFixed(1) : '—'}</td>
                        <td className={`py-2 pr-2 text-right tabular-nums ${(k.tersinkron ?? k.terisi) < k.terisi ? 'text-amber-700' : 'text-slate-600'}`}>
                          {k.tersinkron ?? k.terisi}/{k.terisi}
                        </td>
                        <td className="py-2 text-right">
                          <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={() => setEdit({ kelas: k, mapel })} data-testid={`btn-edit-nilai-${k.kelas_id}`}>
                            <Pencil className="h-3.5 w-3.5" /> Nilai
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </CardContent>
      </Card>
      <FormEditNilaiKelas ujianId={ujian.id} sasaran={edit} onTutup={() => setEdit(null)} onTersimpan={() => { setEdit(null); muatRekap(); }} />
    </div>
  );
}
