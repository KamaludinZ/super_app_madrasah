import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { pesanGalat } from '@/lib/ujian';
import { galatJadwal, simpanJadwal } from '@/lib/ujianFormulir';
import { formatWIB } from '@/lib/datetime';

const JENJANG = ['7', '8', '9'];
const kosong = (tanggal) => ({ tanggal: tanggal || '', sesi_ke: 1, jam_mulai: '07:30', jam_selesai: '09:30', mapel: {} });

/**
 * Editor Jadwal Sesi: tiap sesi = tanggal (dalam masa ujian), sesi ke-, jam mulai–selesai, dan mata pelajaran per
 * jenjang. Mengisi "Hari, tanggal", "Pukul", dan "Mata Pelajaran" pada daftar hadir & berita acara; daftar hadir
 * publik juga memakai sesi ini (satu kiriman per peserta per sesi).
 */
export default function JadwalSesiEditor({ ujian, jadwal = [], bolehUbah, onTersimpan }) {
  const [sesi, setSesi] = useState([]);
  const [mapelList, setMapelList] = useState([]);
  const [menyimpan, setMenyimpan] = useState(false);

  useEffect(() => { setSesi(jadwal.map((s) => ({ ...s, mapel: { ...(s.mapel || {}) } }))); }, [jadwal]);
  useEffect(() => {
    if (!bolehUbah) return;
    api.get('/subjects').then(({ data }) => setMapelList((Array.isArray(data) ? data : data?.items || []).map((m) => m.name).filter(Boolean))).catch(() => {});
  }, [bolehUbah]);

  const galat = useMemo(() => galatJadwal(sesi, ujian?.mulai || '', ujian?.selesai || '9999'), [sesi, ujian]);
  const berubah = JSON.stringify(sesi) !== JSON.stringify(jadwal);
  const ubah = (i, kunci, nilai) => setSesi((d) => d.map((s, j) => (j === i ? { ...s, [kunci]: nilai } : s)));
  const ubahMapel = (i, j, nilai) => setSesi((d) => d.map((s, k) => (k === i ? { ...s, mapel: { ...s.mapel, [j]: nilai } } : s)));

  const tambah = () => setSesi((d) => {
    const akhir = d[d.length - 1];
    if (!akhir) return [kosong(ujian?.mulai)];
    return [...d, { ...kosong(akhir.tanggal), sesi_ke: Number(akhir.sesi_ke) + 1, jam_mulai: akhir.jam_selesai, jam_selesai: akhir.jam_selesai }];
  });

  const simpan = async () => {
    setMenyimpan(true);
    try {
      const bersih = sesi.map(({ tanggal, sesi_ke: ke, jam_mulai: mulai, jam_selesai: selesai, mapel }) => ({
        tanggal, sesi_ke: Number(ke), jam_mulai: mulai, jam_selesai: selesai,
        mapel: Object.fromEntries(Object.entries(mapel || {}).map(([k, v]) => [k, (v || '').trim()]).filter(([, v]) => v)),
      }));
      const h = await simpanJadwal(ujian.id, bersih);
      toast.success(`Jadwal ${h.jadwal.length} sesi disimpan${h.tiruan ? ' (contoh)' : ''}`);
      onTersimpan?.(h);
    } catch (e) {
      toast.error(pesanGalat(e, 'Gagal menyimpan jadwal.'));
    } finally {
      setMenyimpan(false);
    }
  };

  return (
    <div className="space-y-3" data-testid="jadwal-sesi">
      {sesi.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">Belum ada sesi terjadwal.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-2 font-semibold">Tanggal</th>
                <th className="py-2 pr-2 font-semibold">Sesi</th>
                <th className="py-2 pr-2 font-semibold">Pukul (WIB)</th>
                {JENJANG.map((j) => <th key={j} className="py-2 pr-2 font-semibold">Mapel kelas {j}</th>)}
                {bolehUbah && <th className="py-2"><span className="sr-only">Hapus</span></th>}
              </tr>
            </thead>
            <tbody>
              {sesi.map((s, i) => (
                <tr key={s.id || `baru-${i}`} className="border-b border-slate-100 align-top last:border-0">
                  <td className="py-2 pr-2">
                    {bolehUbah ? (
                      <Input type="date" value={s.tanggal} min={ujian?.mulai} max={ujian?.selesai} onChange={(e) => ubah(i, 'tanggal', e.target.value)} className="h-9 w-40" aria-label={`Tanggal sesi ${i + 1}`} />
                    ) : formatWIB(s.tanggal, 'Date', { weekday: 'long', day: 'numeric', month: 'short' })}
                  </td>
                  <td className="py-2 pr-2">
                    {bolehUbah ? <Input type="number" min={1} max={6} value={s.sesi_ke} onChange={(e) => ubah(i, 'sesi_ke', e.target.value)} className="h-9 w-16" aria-label={`Sesi ke ${i + 1}`} /> : s.sesi_ke}
                  </td>
                  <td className="whitespace-nowrap py-2 pr-2">
                    {bolehUbah ? (
                      <div className="flex items-center gap-1">
                        <Input type="time" value={s.jam_mulai} onChange={(e) => ubah(i, 'jam_mulai', e.target.value)} className="h-9 w-28" aria-label={`Jam mulai sesi ${i + 1}`} />
                        <span>–</span>
                        <Input type="time" value={s.jam_selesai} onChange={(e) => ubah(i, 'jam_selesai', e.target.value)} className="h-9 w-28" aria-label={`Jam selesai sesi ${i + 1}`} />
                      </div>
                    ) : `${s.jam_mulai}–${s.jam_selesai}`}
                  </td>
                  {JENJANG.map((j) => (
                    <td key={j} className="py-2 pr-2">
                      {bolehUbah ? (
                        <Input list="daftar-mapel-ujian" value={s.mapel?.[j] || ''} maxLength={80} onChange={(e) => ubahMapel(i, j, e.target.value)}
                          placeholder="—" className="h-9 min-w-[9rem]" aria-label={`Mapel kelas ${j} sesi ${i + 1}`} />
                      ) : (s.mapel?.[j] || <span className="text-slate-300">—</span>)}
                    </td>
                  ))}
                  {bolehUbah && (
                    <td className="py-2">
                      <Button variant="ghost" size="icon" className="h-9 w-9 text-rose-600 hover:bg-rose-50" onClick={() => setSesi((d) => d.filter((_, k) => k !== i))} aria-label={`Hapus sesi ${i + 1}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <datalist id="daftar-mapel-ujian">{mapelList.map((m) => <option key={m} value={m} />)}</datalist>
        </div>
      )}
      {galat.length > 0 && (
        <ul className="list-inside list-disc rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" role="alert">
          {galat.map((g) => <li key={g}>{g}</li>)}
        </ul>
      )}
      {bolehUbah && (
        <div className="flex flex-wrap justify-between gap-2">
          <Button variant="outline" size="sm" onClick={tambah} className="gap-1" data-testid="btn-tambah-sesi"><Plus className="h-4 w-4" /> Tambah Sesi</Button>
          <Button onClick={simpan} disabled={menyimpan || !berubah || galat.length > 0} className="gap-2 bg-[#006837] hover:bg-[#00552d]" data-testid="btn-simpan-jadwal">
            {menyimpan ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan Jadwal
          </Button>
        </div>
      )}
    </div>
  );
}
