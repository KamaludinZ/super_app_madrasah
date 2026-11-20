import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ArrowLeft, CheckCircle2, ClipboardCheck, Loader2, LockOpen, PenLine, RefreshCw, UserX } from 'lucide-react';
import AksesDitolak from '@/components/security/AksesDitolak';
import PilihUjian from '@/components/ujian/PilihUjian';
import TandaiStatusDialog from '@/components/ujian/TandaiStatusDialog';
import BukaKunciDialog from '@/components/ujian/BukaKunciDialog';
import { formatWIB } from '@/lib/datetime';
import { HALAMAN_BERANDA_UJIAN, aksesDitolak, pesanGalat } from '@/lib/ujian';
import { STATUS_HADIR, muatDaftarHadir, urlTtdKehadiran } from '@/lib/ujianKehadiran';

const teksSesi = (s) => `${formatWIB(s.tanggal, 'Date', { weekday: 'short', day: 'numeric', month: 'short' })} · Sesi ${s.sesi_ke} · ${s.jam_mulai}–${s.jam_selesai}`;

export function BadgeStatusHadir({ status }) {
  const s = STATUS_HADIR[status || 'belum'];
  return <Badge className={`${s.kelas} whitespace-nowrap`} data-testid="badge-status-hadir" data-status={status || 'belum'}>{s.label}</Badge>;
}

function TtdKecil({ ujianId, item, tiruan }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!item.ada_ttd || tiruan || !item.id) return undefined;
    let hidup = true;
    let dibuat = null;
    urlTtdKehadiran(ujianId, item.id).then((u) => { dibuat = u; if (hidup) setUrl(u); }).catch(() => {});
    return () => { hidup = false; if (dibuat) URL.revokeObjectURL(dibuat); };
  }, [ujianId, item.id, item.ada_ttd, tiruan]);
  if (!item.ada_ttd) return <span className="text-slate-300">—</span>;
  return url ? <img src={url} alt={`Tanda tangan ${item.nama}`} className="h-8 max-w-[7rem] object-contain" /> : <PenLine className="h-4 w-4 text-slate-400" aria-label="Ada tanda tangan" />;
}

/**
 * Daftar Hadir (/ujian/daftar-hadir?ujian=<id>): pantauan kehadiran peserta per sesi & per ruang dari formulir publik
 * — status hadir (waktu & tanda tangan), izin, sakit, tanpa keterangan, atau belum mengisi — serta rekap kelengkapan tiap
 * ruang (syarat pengisian berita acara).
 */
export default function UjianDaftarHadirPage() {
  const [ujian, setUjian] = useState(null);
  const [sesiId, setSesiId] = useState('');
  const [ruangId, setRuangId] = useState('');
  const [data, setData] = useState(null);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState('');
  const [ditolak, setDitolak] = useState('');
  const [tandai, setTandai] = useState(null);
  const [buka, setBuka] = useState(null);

  const muat = useCallback(async (u, pilihan = {}) => {
    if (!u) { setData(null); return; }
    setMemuat(true);
    try {
      const d = await muatDaftarHadir(u.id, pilihan);
      setData(d);
      setSesiId(d.sesi_id || '');
      setRuangId(d.ruang_id || pilihan.ruangId || d.ruang?.[0]?.id || '');
      setGalat('');
      setDitolak('');
    } catch (e) {
      if (aksesDitolak(e)) setDitolak(pesanGalat(e, 'Akses ditolak.'));
      else setGalat(pesanGalat(e, 'Gagal memuat daftar hadir.'));
    } finally {
      setMemuat(false);
    }
  }, []);

  const gantiUjian = useCallback((u) => { setUjian(u); setSesiId(''); setRuangId(''); muat(u); }, [muat]);
  const pilih = (ubah) => muat(ujian, { sesiId, ruangId, ...ubah });

  const items = data?.items || [];
  const rekapRuang = (data?.rekap || []).find((r) => r.ruang_id === ruangId);

  return (
    <div className="space-y-6" data-testid="ujian-daftar-hadir">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link to={HALAMAN_BERANDA_UJIAN} className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-[#006837] hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> Beranda Ujian
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2">
            <ClipboardCheck className="h-7 w-7 text-[#006837]" /> Daftar Hadir Peserta
          </h1>
          <p className="text-sm text-slate-600 mt-1">Kehadiran dari formulir publik per sesi dan ruang, termasuk izin dan sakit yang ditandai panitia.</p>
        </div>
        <Button variant="outline" onClick={() => pilih({})} disabled={memuat || !ujian} className="gap-2 self-start sm:self-auto" data-testid="btn-muat-ulang-dh">
          {memuat ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Muat Ulang
        </Button>
      </div>

      <PilihUjian onUbah={gantiUjian} />

      {ditolak && <AksesDitolak halaman="Daftar Hadir" untuk="admin, pimpinan, dan panitia ujian ini" pesan={ditolak} />}
      {data?.tiruan && <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" data-testid="info-tiruan-dh-admin">Server belum menyediakan daftar hadir — menampilkan data contoh.</p>}
      {galat && <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800" role="alert"><AlertTriangle className="h-4 w-4 shrink-0" /> {galat}</div>}

      {!ditolak && data && (
        data.sesi.length === 0 ? (
          <Card><CardContent className="p-6 text-center text-sm text-slate-500">Belum ada jadwal sesi. Atur jadwal di Pengaturan Formulir.</CardContent></Card>
        ) : (
          <>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label htmlFor="pilih-sesi-dh" className="text-sm font-medium text-slate-700">Sesi</label>
              <select id="pilih-sesi-dh" value={sesiId} onChange={(e) => pilih({ sesiId: e.target.value })}
                className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006837]" data-testid="pilih-sesi-dh">
                {data.sesi.map((s) => <option key={s.id} value={s.id}>{teksSesi(s)}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" role="group" aria-label="Rekap per ruang" data-testid="rekap-ruang-dh">
              {data.rekap.map((r) => (
                <button key={r.ruang_id} type="button" onClick={() => pilih({ ruangId: r.ruang_id })} aria-pressed={r.ruang_id === ruangId}
                  className={`rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006837] ${
                    r.ruang_id === ruangId ? 'border-[#006837] bg-emerald-50' : 'border-slate-200 bg-white hover:border-[#006837]/40'}`}>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-sm font-semibold text-slate-900">Ruang {r.nama_ruang}</span>
                    {r.lengkap ? <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-label="Lengkap" /> : <span className="text-[11px] font-medium text-amber-700">{r.belum} belum</span>}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{r.hadir}/{r.total} hadir{r.izin + r.sakit + r.alpa ? ` · ${r.izin + r.sakit + r.alpa} tidak hadir` : ''}</div>
                </button>
              ))}
            </div>

            <Card>
              <CardHeader className="flex flex-col gap-1 pb-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-base">Ruang {rekapRuang?.nama_ruang}</CardTitle>
                {rekapRuang && (
                  <p className={`text-xs font-medium ${rekapRuang.lengkap ? 'text-emerald-700' : 'text-amber-700'}`} data-testid="status-lengkap-dh">
                    {rekapRuang.lengkap ? 'Daftar hadir lengkap — berita acara dapat diisi' : `Belum lengkap: ${rekapRuang.belum} peserta belum mengisi atau ditandai`}
                  </p>
                )}
              </CardHeader>
              <CardContent>
                {items.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">Ruang ini belum berisi peserta.</p> : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[40rem] text-sm" data-testid="tabel-daftar-hadir">
                      <thead>
                        <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                          <th className="py-2 pr-2 font-semibold">No. Peserta</th>
                          <th className="py-2 pr-2 font-semibold">Nama</th>
                          <th className="py-2 pr-2 font-semibold">Kelas</th>
                          <th className="py-2 pr-2 font-semibold">Status</th>
                          <th className="py-2 pr-2 font-semibold">Waktu / Catatan</th>
                          <th className="py-2 pr-2 font-semibold">TTD</th>
                          {data.boleh_ubah && <th className="py-2 font-semibold"><span className="sr-only">Aksi</span></th>}
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((it) => (
                          <tr key={it.peserta_id} className="border-b border-slate-100 last:border-0" data-testid={`dh-baris-${it.peserta_id}`}>
                            <td className="py-2 pr-2 font-mono text-xs">{it.nomor_peserta || '—'}</td>
                            <td className="py-2 pr-2 text-slate-900">{it.nama}</td>
                            <td className="py-2 pr-2">{it.kelas}</td>
                            <td className="py-2 pr-2"><BadgeStatusHadir status={it.status} /></td>
                            <td className="py-2 pr-2 text-xs text-slate-500">
                              {it.status === 'hadir' && it.waktu_kirim ? `${formatWIB(it.waktu_kirim, 'Time', { hour: '2-digit', minute: '2-digit' })} WIB` : it.catatan || ''}
                              {it.riwayat_buka?.length > 0 && <span className="block text-[11px] text-sky-700">Kunci pernah dibuka {it.riwayat_buka.length}x</span>}
                            </td>
                            <td className="py-2 pr-2"><TtdKecil ujianId={ujian?.id} item={it} tiruan={data.tiruan} /></td>
                            {data.boleh_ubah && (
                              <td className="py-2 text-right">
                                {it.status === 'hadir' && (
                                  <Button variant="ghost" size="sm" className="h-8 gap-1" data-testid={`btn-buka-kunci-${it.peserta_id}`}
                                    onClick={() => setBuka({ item: it, sesiId })}>
                                    <LockOpen className="h-4 w-4" /> Buka kunci
                                  </Button>
                                )}
                                {it.status !== 'hadir' && (
                                  <Button variant="ghost" size="sm" className="h-8 gap-1" data-testid={`btn-tandai-${it.peserta_id}`}
                                    onClick={() => setTandai({ item: it, tanggal: data.sesi.find((s) => s.id === sesiId)?.tanggal })}>
                                    <UserX className="h-4 w-4" /> {it.status ? 'Ubah' : 'Izin/Sakit'}
                                  </Button>
                                )}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )
      )}
      {!data && memuat && <div className="p-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#006837]" /></div>}
      {ujian && <BukaKunciDialog ujianId={ujian.id} sasaran={buka} onTutup={() => setBuka(null)} onTersimpan={() => { setBuka(null); pilih({}); }} />}
      {ujian && <TandaiStatusDialog ujianId={ujian.id} sasaran={tandai} onTutup={() => setTandai(null)} onTersimpan={() => { setTandai(null); pilih({}); }} />}
    </div>
  );
}
