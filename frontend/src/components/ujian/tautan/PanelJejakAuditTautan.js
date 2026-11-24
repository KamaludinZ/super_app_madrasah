import React, { useCallback, useEffect, useState } from 'react';
import { History, Loader2, RefreshCw, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import SaringanAudit from '@/components/ujian/audit/SaringanAudit';
import DetailLogAudit from '@/components/ujian/audit/DetailLogAudit';
import { Button } from '@/components/ui/button';
import { formatWIBPanjang } from '@/lib/datetime';
import { pesanGalat } from '@/lib/ujian';
import { waktuRelatif } from '@/lib/ujianMonitoringPublik';
import { namaMapelUjian } from '@/lib/mapelUjian';
import {
  LABEL_AKSI_TAUTAN, LABEL_HASIL_AKSES, lamaPantau, muatAuditTautan, ringkasPerangkat,
} from '@/lib/ujianTautanPublik';

const NAMA_JENIS = { info: 'Info', monitoring: 'Monitoring', portal: 'Portal' };
const kelasHasil = (h) => (h === 'ok' ? 'bg-emerald-50 text-emerald-700' : h === 'kartu_soal_ditolak' ? 'bg-rose-100 text-rose-700' : 'bg-amber-50 text-amber-800');

function Angka({ label, nilai, nada = 'text-slate-900', testId }) {
  return (
    <div className="min-w-0 flex-1 rounded-lg bg-slate-50 px-3 py-2">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className={`text-lg font-bold tabular-nums ${nada}`} data-testid={testId}>{nilai ?? '-'}</div>
    </div>
  );
}

function Pilih({ label, nilai, onUbah, opsi, testId }) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-slate-600">
      {label}
      <select value={nilai} onChange={(e) => onUbah(e.target.value)} data-testid={testId}
        className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006837]">
        {opsi.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

/**
 * Jejak audit tautan publik satu ujian: ringkasan akses, daftar akses terbaru (tersaring per jenis tautan & hasil) dengan
 * sumber (IP, perangkat) dan lama pemantauan, serta riwayat perubahan pengaturan tautan. Percobaan mengunduh kartu soal
 * disorot agar admin dapat segera menutup tautan.
 */
export default function PanelJejakAuditTautan({ ujianId, segarkan = 0 }) {
  const [saringan, setSaringan] = useState({ jenis: '', hasil: '', aksi: '', dari: '', sampai: '', cari: '' });
  const [data, setData] = useState(null);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState('');
  const [detail, setDetail] = useState(null);

  const muat = useCallback(async () => {
    if (!ujianId) return;
    setMemuat(true);
    try {
      setData(await muatAuditTautan(ujianId, saringan));
      setGalat('');
    } catch (e) {
      setGalat(pesanGalat(e, 'Gagal memuat jejak audit tautan.'));
    } finally {
      setMemuat(false);
    }
  }, [ujianId, saringan]);
  useEffect(() => { muat(); }, [muat, segarkan]);

  const r = data?.ringkasan;
  return (
    <Card data-testid="panel-audit-tautan">
      <CardHeader className="flex flex-col gap-2 pb-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base"><History className="h-4 w-4 text-[#006837]" /> Jejak Audit Tautan</CardTitle>
          <p className="mt-1 text-xs text-slate-500">Setiap pembukaan tautan publik (berhasil maupun ditolak) dan setiap perubahan pengaturannya.</p>
        </div>
        <Button variant="outline" size="sm" onClick={muat} disabled={memuat} className="h-8 gap-1.5 self-start" data-testid="audit-muat-ulang">
          {memuat ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Muat ulang
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {data?.tiruan && <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" data-testid="audit-tiruan">Data contoh — server belum menyediakan jejak audit.</p>}
        {galat && <p className="text-xs text-rose-600" role="alert">{galat}</p>}
        {r && (
          <div className="flex flex-wrap gap-2" data-testid="audit-ringkasan">
            <Angka label="Total akses" nilai={r.total} testId="audit-total" />
            <Angka label="Berhasil" nilai={r.ok} nada="text-emerald-700" testId="audit-ok" />
            <Angka label="Ditolak" nilai={r.ditolak} nada="text-amber-700" testId="audit-ditolak" />
            <Angka label="Coba unduh kartu soal" nilai={r.kartu_soal_ditolak} nada={r.kartu_soal_ditolak ? 'text-rose-700' : 'text-slate-900'} testId="audit-kartu" />
            {r.klik_mengerjakan !== undefined && <Angka label="Klik Mengerjakan" nilai={r.klik_mengerjakan} testId="audit-klik" />}
          </div>
        )}
        {r?.kartu_soal_ditolak > 0 && (
          <p className="flex items-start gap-2 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-800" data-testid="audit-peringatan-kartu">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            Ada {r.kartu_soal_ditolak} percobaan mengunduh kartu soal lewat tautan publik (semuanya ditolak). Bila mencurigakan, tutup atau ganti token tautan.
          </p>
        )}

        <SaringanAudit nilai={saringan} onUbah={setSaringan} testId="audit-saring" />
        <div className="flex flex-wrap items-center gap-3">
          <Pilih label="Tautan" nilai={saringan.jenis} onUbah={(v) => setSaringan((s) => ({ ...s, jenis: v }))} testId="audit-saring-jenis"
            opsi={[['', 'Semua'], ['info', 'Info ujian'], ['monitoring', 'Monitoring'], ['portal', 'Portal ujian']]} />
          <Pilih label="Hasil" nilai={saringan.hasil} onUbah={(v) => setSaringan((s) => ({ ...s, hasil: v }))} testId="audit-saring-hasil"
            opsi={[['', 'Semua'], ['ok', 'Berhasil'], ['ditolak', 'Ditolak']]} />
          <Pilih label="Aksi" nilai={saringan.aksi} onUbah={(v) => setSaringan((s) => ({ ...s, aksi: v }))} testId="audit-saring-aksi"
            opsi={[['', 'Semua'], ['buka_tautan', 'Buka tautan'], ['klik_mengerjakan', 'Klik Mengerjakan']]} />
        </div>

        {data && (data.akses?.length ? (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200" data-testid="audit-akses">
            {data.akses.map((a) => (
              <li key={a.id} data-hasil={a.hasil}>
                <button type="button" onClick={() => setDetail(a)} aria-label="Lihat detail akses" data-testid={`audit-baris-${a.id}`}
                  className="flex w-full flex-wrap items-start gap-x-3 gap-y-1 px-3 py-2 text-left text-xs hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#006837]">
                <time dateTime={a.waktu} title={formatWIBPanjang(a.waktu)} className="w-28 shrink-0 text-slate-500">{waktuRelatif(a.waktu)}</time>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-700">{NAMA_JENIS[a.jenis_tautan] || 'Tidak dikenal'}</span>
                <span className={`rounded px-1.5 py-0.5 font-semibold ${kelasHasil(a.hasil)}`}>{LABEL_HASIL_AKSES[a.hasil] || a.hasil}</span>
                {a.aksi === 'klik_mengerjakan' && (
                  <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-medium text-[#006837]" data-testid={`audit-klik-${a.id}`}>
                    Klik Mengerjakan{a.mapel ? ` · ${a.nama_mapel || namaMapelUjian(a.mapel)}${a.jenjang ? ` Kelas ${a.jenjang}` : ''}` : ''}
                  </span>
                )}
                <span className="min-w-0 flex-1 text-slate-600">
                  {ringkasPerangkat(a.perangkat)}{a.ip ? <span className="text-slate-400"> · {a.ip}</span> : null}
                  {lamaPantau(a) && <span className="block text-slate-500">{lamaPantau(a)}</span>}
                </span>
                </button>
              </li>
            ))}
          </ul>
        ) : <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-xs text-slate-500" data-testid="audit-kosong">Belum ada akses yang cocok dengan saringan.</p>)}

        {data?.perubahan?.length > 0 && (
          <div>
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Perubahan pengaturan</h3>
            <ul className="space-y-1 text-xs" data-testid="audit-perubahan">
              {data.perubahan.map((p) => (
                <li key={p.id} className="flex flex-wrap gap-x-2 text-slate-600">
                  <span className="text-slate-500">{formatWIBPanjang(p.waktu)}</span>
                  <span className="font-medium text-slate-800">{LABEL_AKSI_TAUTAN[p.aksi] || p.aksi} {NAMA_JENIS[p.jenis] || ''}</span>
                  {p.detail && <span>· {p.detail}</span>}
                  {p.oleh_nama && <span className="text-slate-500">· oleh {p.oleh_nama}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
      <DetailLogAudit entri={detail} jenis="akses" onTutup={() => setDetail(null)} />
    </Card>
  );
}
