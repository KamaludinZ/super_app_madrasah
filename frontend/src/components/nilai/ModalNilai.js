import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Download, FileUp, Loader2, Search } from 'lucide-react';
import {
  JENIS_TAB, KETERCAPAIAN, bacaImpor, formatNilai, intervalKetercapaian, ketercapaian, nilaiAkhir, nilaiSah, pesanGalatApi,
  teksInterval, unduhTemplate,
} from '@/lib/penilaian';

export function BadgeKetercapaian({ kode }) {
  if (!kode) return <span className="text-slate-300">-</span>;
  const k = KETERCAPAIAN[kode];
  return <span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${k.kelas}`}>{k.label}</span>;
}

function InputNilai({ value, onChange, label, testid, className = '' }) {
  const salah = !nilaiSah(value);
  return (
    <Input type="number" inputMode="decimal" min="0" max="100" step="0.01" placeholder="00" value={value ?? ''} aria-label={label}
      aria-invalid={salah} onChange={(e) => onChange(e.target.value)} data-testid={testid}
      className={`h-9 min-w-[4.5rem] ${salah ? 'border-rose-400 focus-visible:ring-rose-400' : ''} ${className}`} />
  );
}

const keString = (isian) => Object.fromEntries(Object.entries(isian || {}).filter(([k]) => ['nilai', 'p', 'k'].includes(k)).map(([k, v]) => [k, v == null ? '' : String(v)]));

/**
 * Modal Tambah/Ubah Nilai (Ulangan, Sumatif, UTS): nomor TP/LM atau ulangan, ringkasan materi, Nilai Batas
 * Ketercapaian (KKTP) beserta interval, lalu tabel siswa (cari, isi semua sekaligus, ketercapaian langsung terhitung).
 * Nilai dapat diisi dari berkas Excel (unduh template -> isi -> impor); hasil impor tampil dulu di tabel sebelum disimpan.
 */
export default function ModalNilai({ open, jenis, mode, siswa, kolom, keBerikut, kktpBawaan, konteks, onTutup, onSimpan }) {
  const info = JENIS_TAB[jenis] || JENIS_TAB.sumatif;
  const pk = mode === 'pk';
  const [ke, setKe] = useState('');
  const [ringkasan, setRingkasan] = useState('');
  const [kktp, setKktp] = useState('');
  const [nilai, setNilai] = useState({});
  const [cari, setCari] = useState('');
  const [isiSemua, setIsiSemua] = useState({ nilai: '', p: '', k: '' });
  const [proses, setProses] = useState(null);
  const [laporanImpor, setLaporanImpor] = useState(null);
  const masukanBerkas = useRef(null);

  useEffect(() => {
    if (!open) return;
    setKe(String(kolom?.ke ?? keBerikut ?? 1));
    setRingkasan(kolom?.ringkasan || '');
    setKktp(String(kolom?.kktp ?? kktpBawaan ?? 75));
    setNilai(Object.fromEntries(Object.entries(kolom?.nilai || {}).map(([sid, v]) => [sid, keString(v)])));
    setCari('');
    setIsiSemua({ nilai: '', p: '', k: '' });
    setLaporanImpor(null);
  }, [open, kolom, keBerikut, kktpBawaan]);

  const interval = intervalKetercapaian(kktp);
  const tampil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return q ? siswa.filter((s) => `${s.nama} ${s.nisn}`.toLowerCase().includes(q)) : siswa;
  }, [siswa, cari]);
  const ubah = (sid, bidang, v) => setNilai((x) => ({ ...x, [sid]: { ...(x[sid] || {}), [bidang]: v } }));
  const terapkanSemua = (bidang, v) => {
    setIsiSemua((x) => ({ ...x, [bidang]: v }));
    if (v === '' || !nilaiSah(v)) return;
    setNilai((x) => {
      const baru = { ...x };
      tampil.forEach((s) => { baru[s.id] = { ...(baru[s.id] || {}), [bidang]: v }; });
      return baru;
    });
  };

  const impor = async (berkas) => {
    if (!berkas) return;
    setProses('impor');
    try {
      const h = await bacaImpor(konteks.classId, konteks.subjectId, konteks.semester, jenis, berkas);
      setNilai((x) => {
        const baru = { ...x };
        Object.entries(h.nilai || {}).forEach(([sid, v]) => { baru[sid] = keString(v); });
        return baru;
      });
      setLaporanImpor(h);
      const n = Object.keys(h.nilai || {}).length;
      toast[h.galat_total ? 'warning' : 'success'](`${n} nilai terbaca dari berkas${h.galat_total ? `, ${h.galat_total} baris bermasalah` : ''}. Periksa lalu klik Simpan.`);
    } catch (e) {
      toast.error(await pesanGalatApi(e, 'Gagal membaca berkas Excel.'));
    } finally {
      setProses(null);
      if (masukanBerkas.current) masukanBerkas.current.value = '';
    }
  };

  const template = async () => {
    setProses('template');
    try {
      await unduhTemplate(konteks.classId, konteks.subjectId, konteks.semester, jenis, kolom?.id || '');
    } catch (e) {
      toast.error(await pesanGalatApi(e, 'Gagal mengunduh template.'));
    } finally {
      setProses(null);
    }
  };

  const simpan = async () => {
    if (!interval) { toast.error('Nilai Batas Ketercapaian harus 0–100.'); return; }
    if (jenis !== 'uts' && !(Number(ke) >= 1 && Number(ke) <= 99)) { toast.error(`${info.keLabel} harus 1–99.`); return; }
    const salah = siswa.find((s) => Object.values(nilai[s.id] || {}).some((v) => !nilaiSah(v)));
    if (salah) { toast.error(`Nilai ${salah.nama} harus angka 0–100.`); return; }
    const isian = {};
    siswa.forEach((s) => {
      const v = nilai[s.id] || {};
      const bidang = pk ? ['p', 'k'] : ['nilai'];
      const bersih = Object.fromEntries(bidang.filter((b) => v[b] !== '' && v[b] != null).map((b) => [b, Number(v[b])]));
      if (Object.keys(bersih).length) isian[s.id] = bersih;
    });
    setProses('simpan');
    try {
      await onSimpan({ ke: jenis === 'uts' ? 1 : Number(ke), ringkasan, kktp: Number(kktp), nilai: isian });
    } finally {
      setProses(null);
    }
  };

  const terisi = siswa.filter((s) => nilaiAkhir(nilai[s.id], mode) != null).length;
  const judul = `${kolom ? 'Ubah' : jenis === 'uts' ? 'Isi' : 'Tambah'} Nilai ${info.label}${kolom && jenis !== 'uts' ? ` ke-${kolom.ke}` : ''}`;

  return (
    <Dialog open={open} onOpenChange={(b) => { if (!b && !proses) onTutup(); }}>
      <DialogContent className="flex max-h-[92vh] w-[96vw] max-w-5xl flex-col gap-0 overflow-hidden p-0" data-testid="modal-nilai">
        <DialogHeader className="border-b border-slate-200 px-5 py-4">
          <DialogTitle className="text-lg">{judul}</DialogTitle>
          <DialogDescription className="text-xs">
            {konteks.label} · {pk ? 'Kolom Pengetahuan & Keterampilan (nilai akhir = rerata keduanya)' : 'Kolom Nilai'}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              {jenis !== 'uts' && (
                <label className="grid grid-cols-1 sm:grid-cols-[8.5rem_minmax(0,1fr)] items-center gap-3 text-sm text-slate-700">
                  {info.keLabel}
                  <Input type="number" min="1" max="99" value={ke} onChange={(e) => setKe(e.target.value)} placeholder="Contoh:1"
                    className="h-9 w-28" data-testid="input-ke" />
                </label>
              )}
              <label className="grid grid-cols-1 sm:grid-cols-[8.5rem_minmax(0,1fr)] items-start gap-3 text-sm text-slate-700">
                <span className="pt-2">{info.ringkasanLabel}</span>
                <Textarea value={ringkasan} onChange={(e) => setRingkasan(e.target.value)} placeholder={info.ringkasanContoh} rows={3}
                  maxLength={1000} className="text-sm" data-testid="input-ringkasan" />
              </label>
            </div>
            <div className="space-y-3">
              <label className="grid grid-cols-1 sm:grid-cols-[8.5rem_minmax(0,1fr)] items-center gap-3 text-sm text-slate-700">
                Nilai Batas Ketercapaian
                <Input type="number" min="0" max="100" value={kktp} onChange={(e) => setKktp(e.target.value)} placeholder="Contoh:65"
                  aria-invalid={!interval} className={`h-9 w-28 ${!interval ? 'border-rose-400' : ''}`} data-testid="input-kktp" />
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-[8.5rem_minmax(0,1fr)] gap-3 text-sm text-slate-700">
                <span>Interval</span>
                <dl className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-y-1 text-xs" data-testid="interval-kktp">
                  {Object.entries(KETERCAPAIAN).map(([kode, k]) => (
                    <React.Fragment key={kode}>
                      <dt className="font-semibold text-slate-800">{k.label}</dt>
                      <dd className="text-slate-600">: {interval ? teksInterval(interval[kode]) : '-'}</dd>
                    </React.Fragment>
                  ))}
                </dl>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">{terisi} dari {siswa.length} siswa sudah dinilai</p>
            <div className="relative sm:w-64">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari nama / NISN" className="h-9 pl-8" aria-label="Cari siswa" />
            </div>
          </div>
          {laporanImpor?.galat_total > 0 && (
            <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900" data-testid="galat-impor">
              <p className="font-medium">{laporanImpor.galat_total} baris berkas tidak terbaca:</p>
              <ul className="mt-1 list-disc pl-5">
                {laporanImpor.galat.slice(0, 5).map((g) => <li key={`${g.baris}-${g.nama}`}>Baris {g.baris}{g.nama ? ` (${g.nama})` : ''}: {g.pesan}</li>)}
              </ul>
            </div>
          )}
          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-600">
                <tr>
                  <th className="w-10 px-3 py-2">No</th>
                  <th className="px-3 py-2">NISN</th>
                  <th className="px-3 py-2">Nama</th>
                  <th className="w-12 px-3 py-2">L/P</th>
                  {(pk ? [['p', 'Pengetahuan'], ['k', 'Keterampilan']] : [['nilai', 'Nilai']]).map(([b, l]) => (
                    <th key={b} className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span>{l}</span>
                        <InputNilai value={isiSemua[b]} onChange={(v) => terapkanSemua(b, v)} label={`Isi ${l} semua siswa yang tampil`}
                          testid={`isi-semua-${b}`} className="bg-white font-normal" />
                      </div>
                    </th>
                  ))}
                  {pk && <th className="px-3 py-2">Akhir</th>}
                  <th className="px-3 py-2">Ketercapaian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tampil.map((s) => {
                  const v = nilai[s.id] || {};
                  const akhir = nilaiAkhir(v, mode);
                  return (
                    <tr key={s.id} className="even:bg-slate-50/50" data-testid={`baris-${s.id}`}>
                      <td className="px-3 py-1.5 text-slate-500">{siswa.indexOf(s) + 1}</td>
                      <td className="px-3 py-1.5 font-mono text-xs text-slate-600">{s.nisn || '-'}</td>
                      <td className="px-3 py-1.5 font-medium text-slate-900">{s.nama}</td>
                      <td className="px-3 py-1.5 text-slate-600">{s.jk || '-'}</td>
                      {(pk ? ['p', 'k'] : ['nilai']).map((b) => (
                        <td key={b} className="px-3 py-1.5">
                          <InputNilai value={v[b]} onChange={(x) => ubah(s.id, b, x)} label={`${b === 'p' ? 'Pengetahuan' : b === 'k' ? 'Keterampilan' : 'Nilai'} ${s.nama}`}
                            testid={`nilai-${b}-${s.id}`} />
                        </td>
                      ))}
                      {pk && <td className="px-3 py-1.5 font-mono text-slate-700">{formatNilai(akhir)}</td>}
                      <td className="px-3 py-1.5"><BadgeKetercapaian kode={ketercapaian(akhir, kktp)} /></td>
                    </tr>
                  );
                })}
                {tampil.length === 0 && (
                  <tr><td colSpan={pk ? 8 : 6} className="px-3 py-6 text-center text-slate-500">{siswa.length ? 'Tidak ada siswa yang cocok.' : 'Belum ada siswa di kelas ini.'}</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-500">Menampilkan {tampil.length} dari {siswa.length} siswa. Kotak di samping judul kolom mengisi semua siswa yang tampil.</p>
        </div>
        <DialogFooter className="flex-col gap-2 border-t border-slate-200 px-5 py-3 sm:flex-row sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={template} disabled={!!proses} className="gap-1" data-testid="btn-template">
              {proses === 'template' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Unduh Template Excel
            </Button>
            <input ref={masukanBerkas} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden"
              onChange={(e) => impor(e.target.files?.[0])} data-testid="input-impor" />
            <Button type="button" variant="outline" size="sm" onClick={() => masukanBerkas.current?.click()} disabled={!!proses} className="gap-1" data-testid="btn-impor">
              {proses === 'impor' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />} Impor Excel
            </Button>
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={onTutup} disabled={!!proses} className="bg-rose-500 hover:bg-rose-600">Batal</Button>
            <Button type="button" onClick={simpan} disabled={!!proses} className="gap-1 bg-[#006837] hover:bg-[#00552d]" data-testid="btn-simpan-nilai">
              {proses === 'simpan' && <Loader2 className="h-4 w-4 animate-spin" />} Simpan
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
