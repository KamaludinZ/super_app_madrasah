import React, { useCallback, useEffect, useState } from 'react';
import { History, Loader2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import SaringanAudit from '@/components/ujian/audit/SaringanAudit';
import DetailLogAudit from '@/components/ujian/audit/DetailLogAudit';
import { Button } from '@/components/ui/button';
import { formatWIBPanjang } from '@/lib/datetime';
import { pesanGalat } from '@/lib/ujian';
import { LABEL_JENIS, LABEL_MODE_UNDUH, muatRiwayatUnduhan } from '@/lib/ujianBerkasAdmin';
import { waktuRelatif } from '@/lib/ujianMonitoringPublik';
import { ringkasPerangkat } from '@/lib/ujianTautanPublik';
import { namaMapelUjian } from '@/lib/mapelUjian';

const kelasMode = { publik: 'bg-sky-50 text-sky-700', tunggal: 'bg-slate-100 text-slate-700', zip_jenjang: 'bg-violet-50 text-violet-700' };

function Angka({ label, nilai, testId, nada = 'text-slate-900' }) {
  return (
    <div className="min-w-0 flex-1 rounded-lg bg-slate-50 px-3 py-2">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className={`text-lg font-bold tabular-nums ${nada}`} data-testid={testId}>{nilai ?? '-'}</div>
    </div>
  );
}

/**
 * Riwayat audit unduhan berkas satu ujian (ujian_unduh_log): unduhan publik kisi-kisi lewat tautan info, unduhan admin
 * satu berkas, dan ZIP per jenjang — siapa, kapan, apa, dari perangkat mana. Unduhan kartu soal ditandai.
 */
export default function PanelRiwayatUnduhan({ ujianId, segarkan = 0 }) {
  const [saringan, setSaringan] = useState({ mode: '', jenis: '', dari: '', sampai: '', cari: '' });
  const [data, setData] = useState(null);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState('');
  const [detail, setDetail] = useState(null);

  const muat = useCallback(async () => {
    if (!ujianId) return;
    setMemuat(true);
    try {
      setData(await muatRiwayatUnduhan(ujianId, saringan));
      setGalat('');
    } catch (e) {
      setGalat(pesanGalat(e, 'Gagal memuat riwayat unduhan.'));
    } finally {
      setMemuat(false);
    }
  }, [ujianId, saringan]);
  useEffect(() => { muat(); }, [muat, segarkan]);

  const r = data?.ringkasan;
  const pilih = (k) => (e) => setSaringan((s) => ({ ...s, [k]: e.target.value }));
  return (
    <Card data-testid="panel-riwayat-unduhan">
      <CardHeader className="flex flex-col gap-2 pb-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base"><History className="h-4 w-4 text-[#006837]" /> Riwayat Unduhan</CardTitle>
          <p className="mt-1 text-xs text-slate-500">Setiap unduhan kisi-kisi & kartu soal tercatat: siapa, kapan, dan dari perangkat mana.</p>
        </div>
        <Button variant="outline" size="sm" onClick={muat} disabled={memuat} className="h-8 gap-1.5 self-start" data-testid="unduhan-muat-ulang">
          {memuat ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Muat ulang
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {data?.tiruan && <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" data-testid="unduhan-tiruan">Data contoh — server belum menyediakan riwayat unduhan.</p>}
        {galat && <p className="text-xs text-rose-600" role="alert">{galat}</p>}
        {r && (
          <div className="flex flex-wrap gap-2">
            <Angka label="Total unduhan" nilai={r.total} testId="unduhan-total" />
            <Angka label="Publik (kisi-kisi)" nilai={r.publik} testId="unduhan-publik" />
            <Angka label="Admin satu berkas" nilai={r.tunggal} testId="unduhan-tunggal" />
            <Angka label="ZIP jenjang" nilai={r.zip_jenjang} testId="unduhan-zip" />
            <Angka label="Kartu soal" nilai={r.kartu_soal} testId="unduhan-kartu" nada={r.kartu_soal ? 'text-rose-700' : 'text-slate-900'} />
          </div>
        )}
        <SaringanAudit nilai={saringan} onUbah={setSaringan} testId="unduhan-saring" />
        <div className="flex flex-wrap gap-3 text-xs text-slate-600">
          <label className="flex items-center gap-1.5">Siapa
            <select value={saringan.mode} onChange={pilih('mode')} className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs" data-testid="unduhan-saring-mode">
              <option value="">Semua</option>{Object.entries(LABEL_MODE_UNDUH).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1.5">Jenis
            <select value={saringan.jenis} onChange={pilih('jenis')} className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs" data-testid="unduhan-saring-jenis">
              <option value="">Semua</option>{Object.entries(LABEL_JENIS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
        </div>
        {data && (data.items?.length ? (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200" data-testid="unduhan-daftar">
            {data.items.map((x) => (
              <li key={x.id} data-mode={x.mode} data-jenis={x.jenis_berkas}>
                <button type="button" onClick={() => setDetail(x)} aria-label="Lihat detail unduhan" data-testid={`unduhan-baris-${x.id}`}
                  className="flex w-full flex-wrap items-start gap-x-3 gap-y-1 px-3 py-2 text-left text-xs hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#006837]">
                <time dateTime={x.waktu} title={`${formatWIBPanjang(x.waktu)} WIB`} className="w-28 shrink-0 text-slate-500">{waktuRelatif(x.waktu)}</time>
                <span className={`rounded px-1.5 py-0.5 font-medium ${kelasMode[x.mode] || 'bg-slate-100 text-slate-700'}`}>{LABEL_MODE_UNDUH[x.mode] || x.mode}</span>
                <span className={`rounded px-1.5 py-0.5 font-semibold ${x.jenis_berkas === 'kartu_soal' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                  {LABEL_JENIS[x.jenis_berkas] || x.jenis_berkas}
                </span>
                <span className="text-slate-700">Kelas {x.jenjang}{x.mapel ? ` · ${namaMapelUjian(x.mapel)}` : ' · semua mapel'}</span>
                <span className="min-w-0 flex-1 text-slate-500">
                  {x.pengunduh_nama || 'Pengunjung tanpa login'} · {ringkasPerangkat(x.perangkat)}{x.ip ? ` · ${x.ip}` : ''}
                </span>
                </button>
              </li>
            ))}
          </ul>
        ) : <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-xs text-slate-500" data-testid="unduhan-kosong">Belum ada unduhan yang cocok dengan saringan.</p>)}
      </CardContent>
      <DetailLogAudit entri={detail} jenis="unduh" onTutup={() => setDetail(null)} />
    </Card>
  );
}
