import React, { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload, Wand2, X } from 'lucide-react';
import { toast } from 'sonner';
import RingkasanImpor from '@/components/students/RingkasanImpor';
import PilihSiswaTatib from '@/components/tatib/PilihSiswaTatib';
import { formatPoin } from '@/components/tatib/RingkasanPoin';
import { pesanGalatTatib } from '@/lib/aksesTatib';
import { poinJenis } from '@/lib/inputTatib';
import { konteksPeriode } from '@/lib/poinTatib';
import {
  KOLOM_IMPOR_TATIB, MAKS_BARIS_IMPOR, bacaBerkasTatib, periksaBaris, prosesImporTatib, statusBaris, unduhTemplateImporTatib,
  validasiBerkasTatib,
} from '@/lib/imporInputTatib';

const LABEL_STATUS = { berhasil: 'Berhasil', tanpa_perubahan: 'Sudah ada', gagal: 'Gagal' };

const formatTanggal = (tgl) => (tgl ? new Date(`${tgl}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-');
const labelSiswa = (s) => `${s.full_name}${s.class_name ? ` · ${s.class_name}` : ''}`;

// Perlu diperiksa: belum siap, atau ada yang dikoreksi otomatis (nama/asal input).
const perluDiperiksa = (r) => statusBaris(r) !== 'siap' || r.siswa.status !== 'cocok' || r.koreksi.length > 0;

/** Sel siswa pratinjau: nama hasil pencocokan, atau pilihan calon / pencarian bila belum yakin. */
function SelSiswa({ row, siswaList, onPilih }) {
  const { status, calon } = row.siswa;
  const terpilih = siswaList.find((s) => s.id === row.siswa_id);
  if (status === 'cocok') return <span>{labelSiswa(terpilih || calon[0].siswa)}</span>;
  return (
    <div className="space-y-1">
      {calon.length ? (
        <Select value={row.siswa_id || undefined} onValueChange={onPilih}>
          <SelectTrigger className={`h-8 text-xs ${row.siswa_id ? '' : 'border-amber-400'}`} data-testid={`impor-tatib-pilih-${row.baris}`}>
            <SelectValue placeholder={status === 'ganda' ? 'Nama ganda — pilih siswa' : 'Pilih siswa yang dimaksud'} />
          </SelectTrigger>
          <SelectContent>
            {calon.map((c) => <SelectItem key={c.siswa.id} value={c.siswa.id}>{labelSiswa(c.siswa)}</SelectItem>)}
          </SelectContent>
        </Select>
      ) : (
        <PilihSiswaTatib siswaList={siswaList} value={row.siswa_id} onPilih={onPilih} testid={`impor-tatib-cari-${row.baris}`} />
      )}
      {row.siswa_id && (row.dipilih
        ? <Badge variant="outline" className="border-sky-300 px-1.5 py-0 text-[10px] font-normal text-sky-700">Dipilih manual</Badge>
        : <Badge variant="outline" className="gap-1 border-amber-300 px-1.5 py-0 text-[10px] font-normal text-amber-700"><Wand2 className="h-3 w-3" /> Dikoreksi otomatis</Badge>)}
      {!row.siswa_id && <p className="text-[11px] text-amber-700">{status === 'tidak_ditemukan' ? 'Tidak ditemukan — cari siswanya' : 'Belum yakin — pilih siswanya'}</p>}
    </div>
  );
}

/**
 * Tombol "Import" + dialog impor Input Tata Tertib dari berkas (Nama, Kode Aturan, Tanggal Kejadian, Asal Input,
 * Keterangan). Nama dikoreksi otomatis ke nama siswa di aplikasi; progres & hasil per baris dilaporkan.
 * `siswaList`/`jenisList` = data yang sudah dimuat halaman input. `onSelesai(hasil)` setelah impor.
 */
export default function ImporInputTatib({ siswaList = [], jenisList = [], disabled, onSelesai }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [baca, setBaca] = useState(null);
  const [rows, setRows] = useState(null);
  const [galat, setGalat] = useState('');
  const [memuat, setMemuat] = useState(false);
  const [filter, setFilter] = useState('semua');
  const [seret, setSeret] = useState(false);
  const [progres, setProgres] = useState(null);
  const [berjalan, setBerjalan] = useState(false);
  const [hasil, setHasil] = useState(null);
  const batalRef = useRef(false);
  const inputRef = useRef(null);

  const reset = () => {
    setFile(null); setBaca(null); setRows(null); setGalat(''); setHasil(null); setProgres(null); setFilter('semua');
    if (inputRef.current) inputRef.current.value = '';
  };
  const tutup = () => { if (!memuat && !berjalan) { setOpen(false); reset(); } };

  const pilihBerkas = async (f) => {
    reset();
    const err = validasiBerkasTatib(f);
    if (err) { setGalat(err); return; }
    setFile(f);
    setMemuat(true);
    try {
      const r = await bacaBerkasTatib(f);
      setBaca(r);
      if (r.masalahHeader.length) setGalat('Susunan kolom berkas tidak sesuai. Gunakan template impor.');
      else if (!r.baris.length) setGalat('Tidak ada baris data yang bisa diimpor.');
      else {
        // Beri kesempatan spinner tampil sebelum pencocokan nama (bisa ribuan perbandingan).
        await new Promise((ok) => setTimeout(ok, 0));
        const diperiksa = periksaBaris(r.baris, { siswaList, jenisList });
        setRows(diperiksa);
        if (diperiksa.some(perluDiperiksa)) setFilter('perhatian');
      }
    } catch (e) {
      setGalat('Berkas tidak bisa dibaca. Pastikan berkas Excel/CSV yang valid.');
    } finally {
      setMemuat(false);
    }
  };

  // Pilihan siswa berlaku untuk semua baris dengan nama yang sama di berkas.
  const pilihSiswa = (asli, siswa_id) => {
    setRows((rs) => rs.map((r) => (r.asli === asli && r.siswa.status !== 'cocok' ? { ...r, siswa_id, dipilih: true } : r)));
  };

  const hitung = useMemo(() => {
    const n = { siap: 0, pilih_siswa: 0, masalah: 0, dikoreksi: 0, perhatian: 0 };
    (rows || []).forEach((r) => {
      n[statusBaris(r)] += 1;
      if (r.siswa_id && !r.dipilih && r.siswa.status === 'dikoreksi') n.dikoreksi += 1;
      if (perluDiperiksa(r)) n.perhatian += 1;
    });
    return n;
  }, [rows]);

  const tampil = useMemo(() => (rows || []).filter((r) => filter === 'semua' || perluDiperiksa(r)), [rows, filter]);

  const unduhTemplate = async () => {
    try {
      await unduhTemplateImporTatib(jenisList);
    } catch (e) {
      toast.error('Gagal membuat template');
    }
  };

  const proses = async () => {
    batalRef.current = false;
    setBerjalan(true);
    setHasil(null);
    setProgres({ selesai: 0, total: rows.length, barisSaatIni: null, hasil: [] });
    try {
      const periode = await konteksPeriode();
      const h = await prosesImporTatib({ rows, siswaList, periode, onProgress: setProgres, batal: () => batalRef.current });
      setHasil(h);
      const r = h.ringkasan;
      const teks = `${r.berhasil} berhasil, ${r.gagal} gagal${r.tanpa_perubahan ? `, ${r.tanpa_perubahan} sudah ada` : ''}`;
      if (h.dibatalkan) toast.warning(`Impor dihentikan setelah ${r.diproses} dari ${r.total} baris: ${teks}.`);
      else if (r.gagal) toast.warning(`Impor selesai: ${teks}.`);
      else toast.success(`Impor selesai: ${teks}.`);
      onSelesai?.(h);
    } catch (e) {
      toast.error(pesanGalatTatib(e, 'Impor dihentikan karena kesalahan'));
      setProgres(null);
    } finally {
      setBerjalan(false);
    }
  };

  const siap = rows && rows.length > 0 && !hasil;
  const dilewati = baca ? { kosong: baca.dilewati.kosong, berlebih: baca.dilewati.berlebih } : undefined;

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} disabled={disabled} className="gap-2" data-testid="impor-tatib-buka">
        <Upload className="h-4 w-4" /> Import
      </Button>

      <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : tutup())}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Impor Input Tata Tertib</DialogTitle>
            <DialogDescription>
              Kolom berkas: <strong>{KOLOM_IMPOR_TATIB.map((k) => k.label).join(', ')}</strong>. Nama siswa dikoreksi otomatis ke nama
              yang terdaftar di aplikasi; poin mengikuti master jenis aturan.
            </DialogDescription>
          </DialogHeader>

          {!rows && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <span>Belum punya berkas? Unduh template berisi petunjuk, daftar kode aturan aktif, dan asal input.</span>
              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={unduhTemplate} data-testid="impor-tatib-template">
                <Download className="h-3.5 w-3.5" /> Unduh template
              </Button>
            </div>
          )}

          {!hasil && !berjalan && (
            <div
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
              onDragOver={(e) => { e.preventDefault(); setSeret(true); }}
              onDragLeave={() => setSeret(false)}
              onDrop={(e) => { e.preventDefault(); setSeret(false); pilihBerkas(e.dataTransfer.files?.[0]); }}
              className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 ${rows ? 'py-3' : 'py-6'} text-center transition-colors ${seret ? 'border-[#006837] bg-[#006837]/5' : 'border-slate-300 hover:border-slate-400'}`}
              data-testid="impor-tatib-zona"
            >
              {memuat ? <Loader2 className="h-6 w-6 animate-spin text-[#006837]" /> : <FileSpreadsheet className="h-6 w-6 text-[#006837]" />}
              {file ? (
                <div className="text-sm">
                  <span className="font-medium text-slate-800">{file.name}</span>
                  <span className="text-slate-500"> · {(file.size / 1024).toFixed(0)} KB{memuat ? ' · membaca & mencocokkan nama…' : ' · klik untuk ganti'}</span>
                </div>
              ) : (
                <div className="text-sm text-slate-600">
                  Seret berkas .xlsx/.xls/.csv ke sini atau <span className="font-medium text-[#006837]">klik untuk memilih</span> (maks 5 MB, {MAKS_BARIS_IMPOR} baris)
                </div>
              )}
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => pilihBerkas(e.target.files?.[0])}
                data-testid="impor-tatib-berkas"
              />
            </div>
          )}

          {galat && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800" role="alert">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="font-semibold">{galat}</div>
                {baca?.masalahHeader?.map((m) => <div key={m}>{m}</div>)}
              </div>
            </div>
          )}

          {siap && !berjalan && (
            <div className="space-y-2" data-testid="impor-tatib-pratinjau">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="outline">{rows.length} baris</Badge>
                <Badge variant="outline" className="gap-1 border-emerald-300 text-emerald-700"><CheckCircle2 className="h-3 w-3" /> {hitung.siap} siap</Badge>
                {hitung.dikoreksi > 0 && <Badge variant="outline" className="gap-1 border-amber-300 text-amber-700"><Wand2 className="h-3 w-3" /> {hitung.dikoreksi} nama dikoreksi otomatis</Badge>}
                {hitung.pilih_siswa > 0 && <Badge variant="outline" className="border-amber-400 text-amber-800">{hitung.pilih_siswa} perlu pilih siswa</Badge>}
                {hitung.masalah > 0 && <Badge variant="outline" className="border-rose-300 text-rose-700">{hitung.masalah} bermasalah</Badge>}
                {baca.dilewati.kosong > 0 && <Badge variant="outline">{baca.dilewati.kosong} baris kosong dilewati</Badge>}
                {baca.dilewati.berlebih > 0 && <Badge variant="outline" className="border-rose-300 text-rose-700">{baca.dilewati.berlebih} baris melebihi batas {MAKS_BARIS_IMPOR}</Badge>}
                <div className="ml-auto flex rounded-md border border-slate-200 p-0.5">
                  {[['perhatian', `Perlu diperiksa (${hitung.perhatian})`], ['semua', 'Semua']].map(([v, l]) => (
                    <button key={v} type="button" onClick={() => setFilter(v)}
                      className={`rounded px-2 py-0.5 ${filter === v ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                      data-testid={`impor-tatib-filter-${v}`}>{l}</button>
                  ))}
                </div>
              </div>

              <div className="max-h-[48vh] overflow-auto rounded-lg border border-slate-200">
                <table className="w-full text-xs" data-testid="impor-tatib-tabel">
                  <thead className="sticky top-0 z-10 bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-2 py-1.5 text-left">Baris</th>
                      <th className="px-2 py-1.5 text-left">Nama di berkas</th>
                      <th className="min-w-[14rem] px-2 py-1.5 text-left">Siswa di aplikasi</th>
                      <th className="px-2 py-1.5 text-left">Aturan</th>
                      <th className="px-2 py-1.5 text-left">Tanggal</th>
                      <th className="px-2 py-1.5 text-left">Asal</th>
                      <th className="px-2 py-1.5 text-left">Keterangan</th>
                      <th className="px-2 py-1.5 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tampil.map((r) => {
                      const st = statusBaris(r);
                      const poin = poinJenis(r.jenis);
                      return (
                        <tr key={r.baris} className="border-t border-slate-100 align-top" data-testid={`impor-tatib-baris-${r.baris}`}>
                          <td className="px-2 py-1.5 font-mono text-slate-500">{r.baris}</td>
                          <td className="px-2 py-1.5">{r.asli || <span className="text-rose-600">kosong</span>}</td>
                          <td className="px-2 py-1.5">{r.asli && <SelSiswa row={r} siswaList={siswaList} onPilih={(id) => pilihSiswa(r.asli, id)} />}</td>
                          <td className="px-2 py-1.5">
                            <span className="font-mono text-slate-500">{r.kode || '-'}</span>
                            {r.jenis && (
                              <span className="block">
                                {r.jenis.nama} <span className={`font-semibold tabular-nums ${poin < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{formatPoin(poin)}</span>
                              </span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-2 py-1.5">{r.tanggal ? formatTanggal(r.tanggal) : '-'}</td>
                          <td className="whitespace-nowrap px-2 py-1.5">{r.asal || '-'}</td>
                          <td className="max-w-[12rem] px-2 py-1.5 text-slate-600"><span className="line-clamp-2">{r.keterangan || '-'}</span></td>
                          <td className="min-w-[9rem] px-2 py-1.5">
                            {st === 'siap' && <span className="font-medium text-emerald-700">Siap</span>}
                            {st === 'pilih_siswa' && <span className="font-medium text-amber-700">Pilih siswa</span>}
                            {st === 'masalah' && r.masalah.map((m) => <span key={m.kolom + m.pesan} className="block text-rose-700">{m.pesan}</span>)}
                            {r.koreksi.map((k) => <span key={k} className="block text-[11px] text-amber-700">Dikoreksi: {k}</span>)}
                          </td>
                        </tr>
                      );
                    })}
                    {tampil.length === 0 && (
                      <tr><td colSpan={8} className="py-6 text-center text-slate-500">Semua baris siap diimpor.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              {hitung.siap < rows.length && (
                <p className="text-xs text-slate-500">
                  Baris bermasalah atau yang siswanya belum dipilih akan dilaporkan gagal; baris lain tetap diimpor.
                  Pilihan siswa berlaku untuk semua baris dengan nama yang sama.
                </p>
              )}
            </div>
          )}

          {progres && (
            <div className="space-y-1.5" data-testid="impor-tatib-progres" aria-live="polite">
              <div className="flex items-center justify-between text-xs text-slate-700">
                <span className="flex items-center gap-1.5">
                  {berjalan ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[#006837]" /> : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                  {berjalan
                    ? `Memproses ${progres.selesai} dari ${progres.total} baris${progres.barisSaatIni ? ` (sampai baris ${progres.barisSaatIni})` : ''}...`
                    : `${progres.selesai} dari ${progres.total} baris diproses`}
                </span>
                <span className="tabular-nums">{progres.total ? Math.round((progres.selesai / progres.total) * 100) : 0}%</span>
              </div>
              <Progress value={progres.total ? (progres.selesai / progres.total) * 100 : 0} className="h-2" />
              <div className="flex gap-3 text-xs">
                <span className="text-emerald-700">{progres.hasil.filter((h) => h.status === 'berhasil').length} berhasil</span>
                <span className="text-slate-500">{progres.hasil.filter((h) => h.status === 'tanpa_perubahan').length} sudah ada</span>
                <span className="text-rose-700">{progres.hasil.filter((h) => h.status === 'gagal').length} gagal</span>
              </div>
              {berjalan && progres.hasil.length > 0 && (
                <ul className="max-h-28 overflow-y-auto rounded border border-slate-100 bg-slate-50 px-2 py-1 font-mono text-[11px]">
                  {progres.hasil.slice(-6).map((h) => (
                    <li key={h.baris} className={h.status === 'gagal' ? 'text-rose-700' : 'text-slate-600'}>
                      Baris {h.baris} - {h.identitas} - {LABEL_STATUS[h.status]}: {h.pesan}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {hasil && (
            <RingkasanImpor
              hasil={hasil}
              dilewati={dilewati}
              namaData="input tatib"
              keteranganMode=""
              labelDilewati="kosong/melebihi batas"
              laporanLengkap
              labelStatus={LABEL_STATUS}
            />
          )}

          <DialogFooter>
            {file && !memuat && !berjalan && (
              <Button variant="ghost" onClick={reset} className="mr-auto gap-1"><X className="h-4 w-4" /> {hasil ? 'Impor berkas lain' : 'Ganti berkas'}</Button>
            )}
            {berjalan ? (
              <Button variant="outline" onClick={() => { batalRef.current = true; }} data-testid="impor-tatib-hentikan">Hentikan</Button>
            ) : (
              <Button variant="outline" onClick={tutup} disabled={memuat}>Tutup</Button>
            )}
            {!hasil && (
              <Button onClick={proses} disabled={!siap || memuat || berjalan || hitung.siap === 0} className="gap-2 bg-[#006837] hover:bg-[#005830]" data-testid="impor-tatib-proses">
                {berjalan ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Impor {rows ? `${rows.length} baris` : ''}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
