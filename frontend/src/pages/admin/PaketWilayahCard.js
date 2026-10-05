import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, CheckCircle2, CloudDownload, Database, FileUp, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { TINGKAT_WILAYAH, pratinjauPaketWilayah, resetModeWilayah } from '@/lib/wilayah';

/**
 * Kartu admin untuk mengunggah paket data wilayah (CSV/XLSX: kode, nama, kode_pos) dan melihat
 * ringkasan isi master wilayah per tingkat. Unggah ulang memperbarui/menambah data (tidak menghapus).
 */
export default function PaketWilayahCard() {
  const [ringkasan, setRingkasan] = useState(null); // { provinsi, kabupaten, kecamatan, desa, dengan_kode_pos } | null
  const [serverSiap, setServerSiap] = useState(true);
  const [file, setFile] = useState(null);
  const [pratinjau, setPratinjau] = useState(null);
  const [memuat, setMemuat] = useState(false);
  const [unggah, setUnggah] = useState(null); // { persen } saat mengunggah
  const [hasil, setHasil] = useState(null);
  const [memuatResmi, setMemuatResmi] = useState(false);
  const inputRef = useRef(null);

  const muatRingkasan = () => api.get('/wilayah/ringkasan')
    .then(({ data }) => { setRingkasan(data); setServerSiap(true); })
    .catch((e) => { setServerSiap(e?.response?.status !== 404); setRingkasan(null); });

  useEffect(() => { muatRingkasan(); }, []);

  const pilih = async (f) => {
    setFile(f || null); setPratinjau(null); setHasil(null);
    if (!f) return;
    if (!/\.(csv|xlsx)$/i.test(f.name)) { toast.error('Paket wilayah harus berformat .csv atau .xlsx'); setFile(null); return; }
    if (f.size > 30 * 1024 * 1024) { toast.error('Ukuran paket maksimal 30 MB'); setFile(null); return; }
    setMemuat(true);
    try {
      setPratinjau(await pratinjauPaketWilayah(f));
    } catch (e) {
      toast.error('Berkas tidak bisa dibaca');
    } finally {
      setMemuat(false);
    }
  };

  const kirim = async () => {
    setUnggah({ persen: 0 });
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post('/wilayah/impor', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (ev) => ev.total && setUnggah({ persen: Math.round((ev.loaded / ev.total) * 90) }),
      });
      setHasil(data);
      resetModeWilayah();
      toast.success(`Paket wilayah dimuat: ${data.baru ?? 0} baru, ${data.diperbarui ?? 0} diperbarui${data.gagal ? `, ${data.gagal} baris gagal` : ''}`);
      muatRingkasan();
    } catch (e) {
      const st = e?.response?.status;
      toast.error(st === 404 ? 'Fitur unggah paket wilayah belum tersedia di server'
        : st === 403 ? 'Hanya admin yang dapat memuat paket wilayah' : (e?.response?.data?.detail || 'Gagal memuat paket wilayah'));
    } finally {
      setUnggah(null);
    }
  };

  // Server mengunduh & memuat data resmi (provinsi s.d. desa/kelurahan + kode pos) sekaligus.
  const muatResmi = async () => {
    setMemuatResmi(true); setHasil(null);
    try {
      const { data } = await api.post('/wilayah/muat-resmi', null, { timeout: 300000 });
      setHasil(data);
      resetModeWilayah();
      toast.success(`Data wilayah resmi dimuat: ${(data.baru ?? 0).toLocaleString('id-ID')} baru, ${(data.diperbarui ?? 0).toLocaleString('id-ID')} diperbarui`);
      muatRingkasan();
    } catch (e) {
      const st = e?.response?.status;
      toast.error(st === 404 ? 'Fitur muat data resmi belum tersedia di server'
        : st === 403 ? 'Hanya admin yang dapat memuat data wilayah' : (e?.response?.data?.detail || 'Gagal memuat data wilayah resmi'));
    } finally {
      setMemuatResmi(false);
    }
  };

  return (
    <Card data-testid="kartu-paket-wilayah">
      <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Database className="h-5 w-5 text-[#006837]" /> Paket Data Wilayah</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" data-testid="ringkasan-wilayah">
          {TINGKAT_WILAYAH.map((t) => (
            <div key={t.key} className="rounded-lg border border-slate-200 px-3 py-2">
              <div className="text-xs text-slate-500">{t.label}</div>
              <div className="text-xl font-bold tabular-nums text-slate-900">{ringkasan ? (ringkasan[t.key] ?? 0).toLocaleString('id-ID') : '-'}</div>
            </div>
          ))}
        </div>
        {!serverSiap && <p className="text-xs text-amber-700">Server belum menyediakan master wilayah; form alamat memakai data contoh.</p>}
        {ringkasan && ringkasan.desa === 0 && <p className="text-xs text-amber-700">Master wilayah masih kosong — unggah paket data wilayah resmi.</p>}

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#006837]/20 bg-[#006837]/5 px-3 py-2 text-xs text-slate-700">
          <span>
            <b>Data resmi lengkap:</b> 38 provinsi s.d. ±83 ribu desa/kelurahan + kode pos (kode Kepmendagri 300.2.2-2138/2025,
            sumber terbuka cahyadsn/wilayah). Server mengunduh & memuatnya otomatis; aman diulang.
          </span>
          <Button size="sm" onClick={muatResmi} disabled={memuatResmi || !!unggah} className="gap-2 bg-[#006837] hover:bg-[#005830]" data-testid="btn-muat-wilayah-resmi">
            {memuatResmi ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudDownload className="h-4 w-4" />} {memuatResmi ? 'Memuat… (±1 menit)' : 'Muat Data Resmi'}
          </Button>
        </div>

        <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 space-y-1">
          <div className="font-medium text-slate-800">Atau unggah paket sendiri — format (.csv atau .xlsx, kolom berurutan):</div>
          <div><span className="font-mono">kode</span> — kode Kemendagri bertitik: <span className="font-mono">35</span> (provinsi), <span className="font-mono">35.73</span> (kab/kota), <span className="font-mono">35.73.05</span> (kecamatan), <span className="font-mono">35.73.05.1001</span> (desa/kelurahan)</div>
          <div><span className="font-mono">nama</span> — nama wilayah; <span className="font-mono">kode_pos</span> — 5 digit, diisi untuk desa/kelurahan (opsional)</div>
          <div>Baris judul boleh ada. Mengunggah ulang menambah/memperbarui data tanpa menghapus yang sudah ada.</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input ref={inputRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={(e) => pilih(e.target.files?.[0])} data-testid="input-paket-wilayah" />
          <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={!!unggah} className="gap-2"><FileUp className="h-4 w-4" /> Pilih Paket</Button>
          {file && <span className="text-sm text-slate-700">{file.name} <span className="text-xs text-slate-500">({(file.size / 1024).toFixed(0)} KB)</span></span>}
          {memuat && <Loader2 className="h-4 w-4 animate-spin text-[#006837]" />}
        </div>

        {pratinjau && (
          <div className="space-y-2" data-testid="pratinjau-paket-wilayah">
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline" className="gap-1 border-emerald-300 text-emerald-700"><CheckCircle2 className="h-3 w-3" /> {pratinjau.total.toLocaleString('id-ID')} baris valid</Badge>
              {TINGKAT_WILAYAH.map((t) => <Badge key={t.key} variant="outline">{t.label}: {pratinjau.perTingkat[t.key].toLocaleString('id-ID')}</Badge>)}
              {pratinjau.salah.length > 0 && <Badge variant="outline" className="border-rose-300 text-rose-700">{pratinjau.salah.length} baris bermasalah</Badge>}
            </div>
            {pratinjau.salah.length > 0 && (
              <ul className="max-h-32 overflow-y-auto rounded border border-rose-100 bg-rose-50 px-2 py-1 text-xs text-rose-800">
                {pratinjau.salah.slice(0, 50).map((s) => <li key={s.baris}><AlertTriangle className="mr-1 inline h-3 w-3" />Baris {s.baris}: {s.pesan}</li>)}
              </ul>
            )}
            <div className="flex justify-end">
              <Button onClick={kirim} disabled={!!unggah || pratinjau.total === 0} className="gap-2 bg-[#006837] hover:bg-[#005830]" data-testid="btn-unggah-paket-wilayah">
                {unggah ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Muat ke Master Wilayah
              </Button>
            </div>
            {unggah && <Progress value={unggah.persen} className="h-2" />}
          </div>
        )}

        {hasil && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800" data-testid="hasil-paket-wilayah">
            Selesai: {hasil.baru ?? 0} baru, {hasil.diperbarui ?? 0} diperbarui, {hasil.gagal ?? 0} gagal dari {hasil.total ?? 0} baris.
            {hasil.yatim > 0 && <div className="text-amber-700">{hasil.yatim} wilayah belum punya induk (mis. desa tanpa kecamatan) — lengkapi paketnya.</div>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
