import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import { api } from '@/lib/api';
import RingkasanImpor from './RingkasanImpor';
import { bacaBerkasImpor, pesanGalatServer, prosesImporBatch, unggahBerkasImpor, validasiBerkas } from '@/lib/imporDataMaster';

/**
 * Hasil tiruan proses impor (sebelum endpoint server tersedia): baris tanpa kolom
 * identitas dianggap gagal, sisanya berhasil. Bentuknya sama dengan kontrak server:
 * { ringkasan: { total, berhasil, gagal }, hasil: [{ baris, identitas, status, pesan }] }.
 */
export const MODE_IMPOR = [
  {
    value: 'isi_kosong',
    label: 'Isi hanya yang kosong (disarankan)',
    desc: 'Hanya field yang masih kosong di aplikasi yang diisi. Data yang sudah terisi tidak berubah.',
  },
  {
    value: 'timpa',
    label: 'Timpa nilai yang berbeda',
    desc: 'Field kosong diisi, dan nilai di aplikasi yang berbeda dengan berkas diganti dengan isi berkas. Sel kosong di berkas tidak menghapus data.',
  },
];

export function hasilImporTiruan(baris, kolom, mode = 'isi_kosong') {
  const kunci = kolom.filter((k) => k.kunci).map((k) => k.key);
  const hasil = baris.map((b) => {
    const identitas = kunci.map((k) => b.data[k]).filter(Boolean).join(' / ');
    return identitas
      ? { baris: b.baris, identitas, status: 'berhasil', pesan: mode === 'timpa' ? 'Siap diproses: isi kosong & timpa nilai berbeda (tiruan)' : 'Siap diproses: isi field kosong (tiruan)' }
      : { baris: b.baris, identitas: '-', kolom: kolom.filter((k) => k.kunci).map((k) => k.label).join(' / '), status: 'gagal', pesan: 'Kolom identitas kosong; baris tidak bisa dicocokkan' };
  });
  const berhasil = hasil.filter((h) => h.status === 'berhasil').length;
  return { mode, ringkasan: { total: hasil.length, berhasil, gagal: hasil.length - berhasil }, hasil };
}

/**
 * Tombol "Import" + modal unggah berkas hasil pelengkapan (Data Siswa / Data GTK).
 * Berkas dibaca di browser, judul kolom dicek terhadap skema baku, lalu baris
 * ditampilkan sebelum diproses.
 */
export default function ImportDataMasterButton({ kolom, sheet, endpoint, judul = 'Import Pelengkapan Data', namaData = 'data', disabled, testid, onSelesai }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [baca, setBaca] = useState(null); // hasil bacaBerkasImpor
  const [galat, setGalat] = useState('');
  const [memuat, setMemuat] = useState(false);
  const [hasil, setHasil] = useState(null);
  const [seret, setSeret] = useState(false);
  const [mode, setMode] = useState('isi_kosong');
  const [setujuTimpa, setSetujuTimpa] = useState(false);
  const [progres, setProgres] = useState(null); // { selesai, total, barisSaatIni, hasil }
  const [berjalan, setBerjalan] = useState(false);
  const batalRef = useRef(false);
  const inputRef = useRef(null);

  const kunci = kolom.filter((k) => k.kunci);

  const reset = () => { setFile(null); setBaca(null); setGalat(''); setHasil(null); if (inputRef.current) inputRef.current.value = ''; };
  const tutup = () => { if (!memuat && !berjalan) { setProgres(null); setOpen(false); reset(); setMode('isi_kosong'); setSetujuTimpa(false); } };

  const pilihBerkas = async (f) => {
    reset();
    const err = validasiBerkas(f);
    if (err) { setGalat(err); return; }
    setFile(f);
    setMemuat(true);
    try {
      const r = await bacaBerkasImpor(f, kolom, sheet);
      setBaca(r);
      if (r.masalahHeader.length) setGalat('Susunan kolom berkas tidak sesuai template.');
      else if (!r.baris.length) setGalat('Tidak ada baris data yang bisa diimpor (berkas hanya berisi judul/keterangan).');
    } catch (e) {
      setGalat('Berkas tidak bisa dibaca. Pastikan berkas Excel .xlsx yang valid.');
    } finally {
      setMemuat(false);
    }
  };

  const proses = async () => {
    batalRef.current = false;
    setBerjalan(true);
    setHasil(null);
    setProgres({ selesai: 0, total: baca.baris.length, barisSaatIni: null, hasil: [] });
    try {
      // 1) Server memvalidasi berkas & membuat sesi impor (riwayat). null = endpoint belum ada -> tiruan.
      const sesi = await unggahBerkasImpor({ api, endpoint, file, mode });
      if (sesi && sesi.total !== baca.baris.length) {
        toast.warning(`Server membaca ${sesi.total} baris, browser ${baca.baris.length} baris; hasil mengikuti baris yang dikirim.`);
      }
      // 2) Kirim baris per batch dengan impor_id.
      const h = await prosesImporBatch({
        api,
        endpoint,
        mode,
        imporId: sesi?.impor_id,
        baris: baca.baris,
        onProgress: setProgres,
        batal: () => batalRef.current,
        cadangan: (batch, m) => hasilImporTiruan(batch, kolom, m).hasil,
      });
      setHasil(h);
      const r = h.ringkasan;
      const teks = `${r.berhasil} berhasil, ${r.gagal} gagal${r.tanpa_perubahan ? `, ${r.tanpa_perubahan} tanpa perubahan` : ''}`;
      if (h.tiruan) toast.info(`Tiruan impor (data belum disimpan): ${teks}.`);
      else if (h.dibatalkan) toast.warning(`Impor dihentikan setelah ${r.diproses} dari ${r.total} baris: ${teks}.`);
      else if (r.gagal) toast.warning(`Impor selesai: ${teks}.`);
      else toast.success(`Impor selesai: ${teks}.`);
      onSelesai?.(h);
    } catch (e) {
      const st = e?.response?.status;
      toast.error(st === 403 ? 'Anda tidak berhak mengimpor data ini (khusus admin)'
        : st === 401 ? 'Sesi berakhir, silakan login kembali'
          : pesanGalatServer(e, 'Impor dihentikan karena kesalahan'));
      setProgres(null);
    } finally {
      setBerjalan(false);
    }
  };

  const siap = baca && !baca.masalahHeader.length && baca.baris.length > 0;
  const bolehProses = siap && (mode !== 'timpa' || setujuTimpa);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} disabled={disabled} className="gap-2" data-testid={testid}>
        <Upload className="h-4 w-4" /> Import
      </Button>

      <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : tutup())}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{judul}</DialogTitle>
            <DialogDescription>
              Unggah berkas Excel hasil pelengkapan (dari Unduh Excel atau Export Template). Baris dicocokkan lewat kolom{' '}
              <strong>{kunci.map((k) => k.label).join(' / ')}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
            onDragOver={(e) => { e.preventDefault(); setSeret(true); }}
            onDragLeave={() => setSeret(false)}
            onDrop={(e) => { e.preventDefault(); setSeret(false); pilihBerkas(e.dataTransfer.files?.[0]); }}
            className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${seret ? 'border-[#006837] bg-[#006837]/5' : 'border-slate-300 hover:border-slate-400'}`}
            data-testid="zona-unggah-impor"
          >
            {memuat ? <Loader2 className="h-6 w-6 animate-spin text-[#006837]" /> : <FileSpreadsheet className="h-6 w-6 text-[#006837]" />}
            {file ? (
              <div className="text-sm">
                <span className="font-medium text-slate-800">{file.name}</span>
                <span className="text-slate-500"> · {(file.size / 1024).toFixed(0)} KB</span>
              </div>
            ) : (
              <div className="text-sm text-slate-600">Seret berkas .xlsx ke sini atau <span className="font-medium text-[#006837]">klik untuk memilih</span> (maks 5 MB)</div>
            )}
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => pilihBerkas(e.target.files?.[0])}
              data-testid="input-berkas-impor"
            />
          </div>

          {galat && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800" role="alert">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="font-semibold">{galat}</div>
                {baca?.masalahHeader?.map((m) => <div key={m}>{m}</div>)}
              </div>
            </div>
          )}

          {siap && (
            <div className="space-y-2" data-testid="ringkasan-berkas-impor">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="outline" className="gap-1 border-emerald-300 text-emerald-700"><CheckCircle2 className="h-3 w-3" /> Kolom sesuai template</Badge>
                <Badge variant="outline">Sheet: {baca.sheet}</Badge>
                <Badge variant="outline">{baca.baris.length} baris {namaData}</Badge>
                {baca.dilewati.keterangan > 0 && <Badge variant="outline">baris keterangan dilewati</Badge>}
                {baca.dilewati.kosong > 0 && <Badge variant="outline">{baca.dilewati.kosong} baris kosong dilewati</Badge>}
              </div>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-2 py-1.5 text-left">Baris</th>
                      {kunci.map((k) => <th key={k.key} className="px-2 py-1.5 text-left">{k.label}</th>)}
                      <th className="px-2 py-1.5 text-left">Nama</th>
                      <th className="px-2 py-1.5 text-left">Kolom terisi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {baca.baris.slice(0, 5).map((b) => (
                      <tr key={b.baris} className="border-t border-slate-100">
                        <td className="px-2 py-1 font-mono text-slate-500">{b.baris}</td>
                        {kunci.map((k) => <td key={k.key} className="px-2 py-1 font-mono">{b.data[k.key] || <span className="text-rose-600">kosong</span>}</td>)}
                        <td className="px-2 py-1">{b.data.full_name || '-'}</td>
                        <td className="px-2 py-1 text-slate-500">{Object.values(b.data).filter(Boolean).length}/{kolom.length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {baca.baris.length > 5 && <div className="border-t border-slate-100 px-2 py-1 text-xs text-slate-500">… dan {baca.baris.length - 5} baris lainnya</div>}
              </div>
            </div>
          )}

          {siap && (
            <div className="space-y-2" data-testid="opsi-mode-impor">
              <div className="text-sm font-medium text-slate-800">Cara mengisi data</div>
              <RadioGroup value={mode} onValueChange={(v) => { setMode(v); setSetujuTimpa(false); setHasil(null); }} className="gap-2">
                {MODE_IMPOR.map((m) => (
                  <Label
                    key={m.value}
                    htmlFor={`mode-impor-${m.value}`}
                    className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 font-normal ${mode === m.value ? (m.value === 'timpa' ? 'border-amber-400 bg-amber-50' : 'border-[#006837] bg-[#006837]/5') : 'border-slate-200'}`}
                  >
                    <RadioGroupItem id={`mode-impor-${m.value}`} value={m.value} className="mt-0.5" />
                    <span>
                      <span className="block text-sm font-medium text-slate-800">{m.label}</span>
                      <span className="block text-xs text-slate-600">{m.desc}</span>
                    </span>
                  </Label>
                ))}
              </RadioGroup>
              {mode === 'timpa' && (
                <label className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900" data-testid="setuju-timpa">
                  <Checkbox checked={setujuTimpa} onCheckedChange={(v) => setSetujuTimpa(!!v)} className="mt-0.5" />
                  <span>
                    Saya paham nilai yang sudah tersimpan untuk {baca.baris.length} baris {namaData} bisa diganti dengan isi berkas.
                    Perubahan tercatat di log audit.
                  </span>
                </label>
              )}
            </div>
          )}

          {progres && (
            <div className="space-y-1.5" data-testid="progres-impor" aria-live="polite">
              <div className="flex items-center justify-between text-xs text-slate-700">
                <span className="flex items-center gap-1.5">
                  {berjalan ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[#006837]" /> : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                  {berjalan
                    ? `Memproses ${progres.selesai} dari ${progres.total} baris${progres.barisSaatIni ? ` (sampai baris Excel ${progres.barisSaatIni})` : ''}...`
                    : `${progres.selesai} dari ${progres.total} baris diproses`}
                </span>
                <span className="tabular-nums">{progres.total ? Math.round((progres.selesai / progres.total) * 100) : 0}%</span>
              </div>
              <Progress value={progres.total ? (progres.selesai / progres.total) * 100 : 0} className="h-2" />
              <div className="flex gap-3 text-xs">
                <span className="text-emerald-700">{progres.hasil.filter((h) => h.status === 'berhasil').length} berhasil</span>
                <span className="text-slate-500">{progres.hasil.filter((h) => h.status === 'tanpa_perubahan').length} tanpa perubahan</span>
                <span className="text-rose-700">{progres.hasil.filter((h) => h.status === 'gagal').length} gagal</span>
              </div>
              {berjalan && progres.hasil.length > 0 && (
                <ul className="max-h-28 overflow-y-auto rounded border border-slate-100 bg-slate-50 px-2 py-1 font-mono text-[11px]">
                  {progres.hasil.slice(-6).map((h) => (
                    <li key={h.baris} className={h.status === 'gagal' ? 'text-rose-700' : 'text-slate-600'}>
                      Baris {h.baris} - {h.identitas} - {h.pesan}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {hasil && <RingkasanImpor hasil={hasil} dilewati={baca?.dilewati} namaData={namaData} />}

          <DialogFooter>
            {file && !memuat && !berjalan && (
              <Button variant="ghost" onClick={reset} className="gap-1 mr-auto"><X className="h-4 w-4" /> Ganti berkas</Button>
            )}
            {berjalan ? (
              <Button variant="outline" onClick={() => { batalRef.current = true; }} data-testid="btn-hentikan-impor">Hentikan</Button>
            ) : (
              <Button variant="outline" onClick={tutup} disabled={memuat}>Tutup</Button>
            )}
            <Button onClick={proses} disabled={!bolehProses || memuat || berjalan || !!hasil} className="gap-2 bg-[#006837] hover:bg-[#005830]" data-testid={testid ? `${testid}-proses` : undefined}>
              <Upload className="h-4 w-4" /> Proses Impor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
