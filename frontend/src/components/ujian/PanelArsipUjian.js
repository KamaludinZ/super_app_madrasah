import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Archive, Download, Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import CariUjianArsip from '@/components/ujian/CariUjianArsip';
import DetailArsipSheet from '@/components/ujian/DetailArsipSheet';
import { formatWIBPanjang } from '@/lib/datetime';
import { aksesDitolak, pesanGalat } from '@/lib/ujian';
import { simpanBerkas } from '@/lib/ujianPeserta';
import { JENIS_DOKUMEN, muatArsip, ukuranBerkas, unduhArsip } from '@/lib/ujianCetak';
import AksesDitolak from '@/components/security/AksesDitolak';

/**
 * Arsip Administrasi Ujian: dokumen ujian yang pernah dicetak (terbaru dulu) dan dapat diunduh ulang. Ujian dapat dicari
 * di antara semester ini dan semester-semester lalu; dokumen dapat disaring menurut teks (jenis, ruang, kelas, sesi).
 */
export default function PanelArsipUjian({ ujian: ujianAwal }) {
  const [ujianPilih, setUjianPilih] = useState(null);
  const ujian = ujianPilih || ujianAwal;
  const [cari, setCari] = useState('');
  const [data, setData] = useState(null);
  const [ditolak, setDitolak] = useState('');
  const [unduh, setUnduh] = useState(null);
  const [detail, setDetail] = useState(null);

  const muat = useCallback(async () => {
    if (!ujian) return;
    setData(null);
    try {
      setData(await muatArsip(ujian.id));
      setDitolak('');
    } catch (e) {
      if (aksesDitolak(e)) setDitolak(pesanGalat(e, 'Akses ditolak.'));
      else toast.error(pesanGalat(e, 'Gagal memuat arsip.'));
    }
  }, [ujian]);
  useEffect(() => { muat(); }, [muat]);

  const ambil = async (a) => {
    setUnduh(a.id);
    try {
      const h = await unduhArsip(a);
      simpanBerkas(h.blob, h.nama);
    } catch (e) {
      toast.error(pesanGalat(e, 'Gagal mengunduh arsip.'));
    } finally {
      setUnduh(null);
    }
  };

  const tampil = useMemo(() => {
    const q = cari.toLowerCase().trim();
    if (!q || !data) return data?.items || [];
    return data.items.filter((a) => `${JENIS_DOKUMEN[a.jenis_dokumen]?.label || ''} ruang ${a.nama_ruang} kelas ${a.jenjang} ${a.sesi_label} ${a.nama_berkas} ${a.dibuat_oleh_nama}`
      .toLowerCase().includes(q));
  }, [data, cari]);

  if (ditolak) return <AksesDitolak halaman="Arsip Administrasi Ujian" untuk="admin, waka kurikulum, kepala madrasah, serta ketua dan sekretaris panitia" pesan={ditolak} />;
  return (
    <Card data-testid="panel-arsip">
      <CardHeader className="space-y-3 pb-3">
        <CardTitle className="text-base flex items-center gap-2"><Archive className="h-4 w-4 text-[#006837]" /> Arsip Administrasi Ujian</CardTitle>
        <div className="flex flex-col gap-2 sm:flex-row">
          <CariUjianArsip nilai={ujian} onPilih={setUjianPilih} />
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Saring: berita acara, ruang 01, kelas 7…" className="pl-9" aria-label="Saring dokumen arsip" data-testid="saring-arsip" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {data?.tiruan && <p className="mb-2 text-xs text-amber-700">Data contoh.</p>}
        {!data ? <div className="p-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-[#006837]" /></div>
          : data.items.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">Belum ada dokumen yang dicetak untuk ujian ini.</p>
          : tampil.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">Tidak ada dokumen yang cocok dengan saringan.</p> : (
            <ul className="divide-y divide-slate-100" data-testid="daftar-arsip">
              {tampil.map((a) => (
                <li key={a.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center" data-testid={`arsip-${a.id}`}>
                  <button type="button" onClick={() => setDetail(a)} className="min-w-0 flex-1 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006837]" data-testid={`buka-detail-${a.id}`}>
                    <div className="text-sm font-medium text-slate-900 hover:text-[#006837]">{JENIS_DOKUMEN[a.jenis_dokumen]?.label || a.jenis_dokumen} · Ruang {a.nama_ruang} · Kelas {a.jenjang}</div>
                    <div className="text-xs text-slate-500">{a.sesi_label} · {a.format?.toUpperCase()} · {ukuranBerkas(a.ukuran)} · {a.dibuat_oleh_nama} · {formatWIBPanjang(a.waktu)}</div>
                  </button>
                  <Button variant="outline" size="sm" onClick={() => ambil(a)} disabled={unduh === a.id} className="shrink-0 gap-1 self-start sm:self-auto">
                    {unduh === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Unduh
                  </Button>
                </li>
              ))}
            </ul>
          )}
      </CardContent>
      <DetailArsipSheet arsip={detail} semua={data?.items || []} ujian={ujian} onTutup={() => setDetail(null)} onPilih={setDetail} />
    </Card>
  );
}
