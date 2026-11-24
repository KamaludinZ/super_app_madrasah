import React, { useEffect, useMemo, useState } from 'react';
import { Download, FileDown, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LABEL_JENIS } from '@/lib/ujianBerkasAdmin';
import { formatUkuranBerkas } from '@/lib/ujianBerkas';
import { JENJANG_UJIAN, labelJenjang } from '@/lib/mapelUjian';

const kelasPilih = 'h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006837] disabled:bg-slate-50';

/**
 * Unduh tunggal satu berkas: pilih jenis, jenjang, lalu mapel (yang belum mengirim tampil "(belum)" dan tidak dapat
 * dipilih). `status` = respons /berkas/status; `onUnduh(meta, jenis, jenjang, mapel)` — kartu soal dikonfirmasi pemanggil.
 */
export default function FormUnduhTunggal({ status, jenjangAwal, bolehUnduh, sibuk, onUnduh }) {
  const [jenis, setJenis] = useState('kisi_kisi');
  const [jenjang, setJenjang] = useState(jenjangAwal || JENJANG_UJIAN[0]);
  const [mapel, setMapel] = useState('');
  useEffect(() => { if (jenjangAwal) setJenjang(jenjangAwal); }, [jenjangAwal]);
  const baris = useMemo(() => status?.jenjang?.[String(jenjang)]?.baris || [], [status, jenjang]);
  useEffect(() => { // mapel terpilih harus terkirim untuk jenis & jenjang ini
    if (!baris.some((b) => b.kode === mapel && b[jenis])) setMapel(baris.find((b) => b[jenis])?.kode || '');
  }, [baris, jenis, mapel]);
  const pilihan = baris.find((b) => b.kode === mapel);
  const meta = pilihan?.[jenis];

  return (
    <Card data-testid="form-unduh-tunggal">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base"><FileDown className="h-4 w-4 text-[#006837]" /> Unduh satu berkas</CardTitle>
        <p className="text-xs text-slate-500">Pilih jenis, jenjang, dan mata pelajaran.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <label className="text-xs text-slate-600">Jenis
            <select value={jenis} onChange={(e) => setJenis(e.target.value)} className={`mt-1 ${kelasPilih}`} data-testid="tunggal-jenis">
              {Object.entries(LABEL_JENIS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
          <label className="text-xs text-slate-600">Jenjang
            <select value={jenjang} onChange={(e) => setJenjang(Number(e.target.value))} className={`mt-1 ${kelasPilih}`} data-testid="tunggal-jenjang">
              {JENJANG_UJIAN.map((j) => <option key={j} value={j}>{labelJenjang(j)}</option>)}
            </select>
          </label>
          <label className="text-xs text-slate-600">Mata pelajaran
            <select value={mapel} onChange={(e) => setMapel(e.target.value)} className={`mt-1 ${kelasPilih}`} data-testid="tunggal-mapel"
              disabled={!baris.some((b) => b[jenis])}>
              {!baris.some((b) => b[jenis]) && <option value="">Belum ada yang terkirim</option>}
              {baris.map((b) => <option key={b.kode} value={b.kode} disabled={!b[jenis]}>{b.nama}{b[jenis] ? '' : ' (belum)'}</option>)}
            </select>
          </label>
        </div>
        {meta && (
          <p className="truncate text-xs text-slate-500" data-testid="tunggal-info">
            {meta.nama_file} · {formatUkuranBerkas(meta.ukuran_byte)}{meta.guru_pj_nama ? ` · PJ ${meta.guru_pj_nama}` : ''}
          </p>
        )}
        <Button type="button" disabled={!bolehUnduh || !meta || sibuk} onClick={() => onUnduh(meta, jenis, jenjang, pilihan)}
          className="gap-1.5 bg-[#006837] hover:bg-[#005830]" data-testid="tunggal-unduh">
          {sibuk ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Unduh {LABEL_JENIS[jenis].toLowerCase()}
        </Button>
      </CardContent>
    </Card>
  );
}
