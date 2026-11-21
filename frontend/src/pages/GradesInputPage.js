import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { confirmDialog } from '@/components/ui/confirm-dialog';
import {
  AlertCircle, ClipboardEdit, Download, FileUp, Info, Loader2, Lock, Pencil, Plus, Save, Trash2, Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { muatMasaGuru, simpanUasGuru } from '@/lib/ujianNilai';
import ModalNilai, { BadgeKetercapaian } from '@/components/nilai/ModalNilai';
import {
  JENIS_TAB, KETERCAPAIAN, MODE_KOLOM, bacaImpor, formatNilai, hapusKolom, muatPenilaian, nilaiSah, pesanGalatApi, tambahKolom,
  teksInterval, ubahKolom, ubahMode, unduhTemplate,
} from '@/lib/penilaian';

const WARNA_NILAI = { belum: 'text-rose-700', cukup: 'text-amber-700', baik: 'text-sky-700', sangat_baik: 'text-emerald-700' };

/** Tab Ulangan / Sumatif: kolom-kolom nilai (tambah, ubah, hapus) dalam satu tabel beserta rerata per siswa. */
function TabKolom({ jenis, data, onTambah, onUbah, onHapus }) {
  const info = JENIS_TAB[jenis];
  const kolom = data.kolom[jenis];
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">
          {kolom.length ? `${kolom.length} kolom ${info.label.toLowerCase()}. Siswa melihat rerata nilai ${info.label.toLowerCase()} mapel ini.`
            : `Belum ada nilai ${info.label.toLowerCase()}. Tambahkan kolom per ${jenis === 'sumatif' ? 'TP/Lingkup Materi' : 'ulangan'}.`}
        </p>
        <Button onClick={onTambah} className="gap-2 self-start bg-[#006837] hover:bg-[#00552d] sm:self-auto" data-testid={`btn-tambah-${jenis}`}>
          <Plus className="h-4 w-4" /> Tambah Nilai
        </Button>
      </div>
      {kolom.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200" data-testid={`tabel-${jenis}`}>
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600">
              <tr>
                <th className="sticky left-0 z-10 w-10 bg-slate-50 px-3 py-2 text-left">No</th>
                <th className="sticky left-10 z-10 min-w-[8.5rem] bg-slate-50 px-3 py-2 text-left sm:min-w-[11rem]">Nama</th>
                {kolom.map((k) => (
                  <th key={k.id} className="min-w-[6.5rem] border-l border-slate-200 px-2 py-2 text-center align-top" title={k.ringkasan || undefined}>
                    <div className="font-semibold text-slate-800">{info.singkat} {k.ke}</div>
                    <div className="font-normal text-slate-500">KKTP {formatNilai(k.kktp)}</div>
                    <div className="mt-1 flex justify-center gap-1">
                      <button type="button" onClick={() => onUbah(k)} className="rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006837]"
                        aria-label={`Ubah ${info.label} ke-${k.ke}`} data-testid={`ubah-kolom-${k.id}`}><Pencil className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => onHapus(k)} className="rounded p-1 text-slate-500 hover:bg-rose-100 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                        aria-label={`Hapus ${info.label} ke-${k.ke}`} data-testid={`hapus-kolom-${k.id}`}><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </th>
                ))}
                <th className="min-w-[5.5rem] border-l border-slate-200 bg-emerald-50 px-3 py-2 text-center font-semibold text-[#006837]">Rerata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.siswa.map((s, i) => (
                <tr key={s.id} className="even:bg-slate-50/50">
                  <td className="sticky left-0 bg-white px-3 py-1.5 text-slate-500">{i + 1}</td>
                  <td className="sticky left-10 max-w-[8.5rem] bg-white px-3 py-1.5 text-xs font-medium text-slate-900 sm:max-w-none sm:text-sm">{s.nama}</td>
                  {kolom.map((k) => {
                    const v = k.nilai[s.id];
                    return (
                      <td key={k.id} className={`border-l border-slate-100 px-2 py-1.5 text-center font-mono ${WARNA_NILAI[v?.ketercapaian] || 'text-slate-300'}`}
                        title={v?.ketercapaian ? KETERCAPAIAN[v.ketercapaian].label : undefined}>
                        {formatNilai(v?.akhir)}
                      </td>
                    );
                  })}
                  <td className="border-l border-slate-100 bg-emerald-50/40 px-3 py-1.5 text-center font-mono font-semibold text-slate-900">
                    {formatNilai(data.rekap[s.id]?.[jenis])}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {kolom.length > 0 && (
        <ul className="grid gap-1 text-xs text-slate-500 sm:grid-cols-2">
          {kolom.map((k) => (
            <li key={k.id} className="min-w-0 truncate"><strong className="text-slate-700">{info.singkat} {k.ke}:</strong> {k.ringkasan || '—'}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Tab UTS: satu kolom nilai per kelas–mapel–semester. */
function TabUts({ data, onIsi, onHapus }) {
  const k = data.kolom.uts;
  const pk = data.mode === 'pk';
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">
          {k ? <>KKTP {formatNilai(k.kktp)} · Cukup {teksInterval(k.interval?.cukup)} · Baik {teksInterval(k.interval?.baik)} · Sangat Baik {teksInterval(k.interval?.sangat_baik)}</>
            : 'Belum ada nilai UTS untuk kelas ini.'}
        </p>
        <div className="flex gap-2 self-start sm:self-auto">
          {k && <Button variant="outline" onClick={() => onHapus(k)} className="gap-1 text-rose-700" data-testid="btn-hapus-uts"><Trash2 className="h-4 w-4" /> Hapus</Button>}
          <Button onClick={() => onIsi(k)} className="gap-2 bg-[#006837] hover:bg-[#00552d]" data-testid="btn-isi-uts">
            {k ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {k ? 'Ubah Nilai UTS' : 'Isi Nilai UTS'}
          </Button>
        </div>
      </div>
      {k && (
        <div className="overflow-x-auto rounded-lg border border-slate-200" data-testid="tabel-uts">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-600">
              <tr>
                <th className="w-10 px-3 py-2">No</th><th className="px-3 py-2">Nama</th>
                {pk && <><th className="px-3 py-2 text-center">Pengetahuan</th><th className="px-3 py-2 text-center">Keterampilan</th></>}
                <th className="px-3 py-2 text-center">{pk ? 'Nilai Akhir' : 'Nilai'}</th><th className="px-3 py-2">Ketercapaian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.siswa.map((s, i) => {
                const v = k.nilai[s.id];
                return (
                  <tr key={s.id} className="even:bg-slate-50/50">
                    <td className="px-3 py-1.5 text-slate-500">{i + 1}</td>
                    <td className="px-3 py-1.5 font-medium text-slate-900">{s.nama}</td>
                    {pk && <><td className="px-3 py-1.5 text-center font-mono">{formatNilai(v?.p)}</td><td className="px-3 py-1.5 text-center font-mono">{formatNilai(v?.k)}</td></>}
                    <td className="px-3 py-1.5 text-center font-mono font-semibold">{formatNilai(v?.akhir)}</td>
                    <td className="px-3 py-1.5"><BadgeKetercapaian kode={v?.ketercapaian} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Tab UAS: nilai UAS dari panitia ujian; guru pengampu mengubahnya hanya selama masa ujian/remidi yang dibuka panitia. */
function TabUas({ data, masa, konteks, onTersimpan }) {
  const boleh = !!masa?.boleh_ubah;
  const awal = useMemo(() => Object.fromEntries(data.siswa.map((s) => [s.id, data.rekap[s.id]?.uas == null ? '' : String(data.rekap[s.id].uas)])), [data]);
  const [nilai, setNilai] = useState(awal);
  const [proses, setProses] = useState(null);
  const masukan = useRef(null);
  useEffect(() => setNilai(awal), [awal]);

  const berubah = data.siswa.filter((s) => (nilai[s.id] ?? '') !== (awal[s.id] ?? ''));
  const simpan = async () => {
    const salah = berubah.find((s) => !nilaiSah(nilai[s.id]));
    if (salah) { toast.error(`Nilai UAS ${salah.nama} harus 0–100`); return; }
    setProses('simpan');
    try {
      const h = await simpanUasGuru(konteks.classId, konteks.subjectId, berubah.map((s) => ({ student_id: s.id, nilai_uas: nilai[s.id] === '' ? null : Number(nilai[s.id]) })));
      toast.success(`Nilai UAS ${h.disimpan} siswa disimpan${h.tiruan ? ' (contoh)' : ''}`);
      onTersimpan();
    } catch (e) {
      toast.error(await pesanGalatApi(e, 'Gagal menyimpan nilai UAS'));
    } finally {
      setProses(null);
    }
  };
  const impor = async (berkas) => {
    if (!berkas) return;
    setProses('impor');
    try {
      const h = await bacaImpor(konteks.classId, konteks.subjectId, konteks.semester, 'uas', berkas);
      setNilai((x) => ({ ...x, ...Object.fromEntries(Object.entries(h.nilai || {}).map(([sid, v]) => [sid, String(v.nilai)])) }));
      toast[h.galat_total ? 'warning' : 'success'](`${Object.keys(h.nilai || {}).length} nilai UAS terbaca${h.galat_total ? `, ${h.galat_total} baris bermasalah` : ''}. Periksa lalu klik Simpan.`);
    } catch (e) {
      toast.error(await pesanGalatApi(e, 'Gagal membaca berkas Excel.'));
    } finally {
      setProses(null);
      if (masukan.current) masukan.current.value = '';
    }
  };
  const template = async () => {
    setProses('template');
    try { await unduhTemplate(konteks.classId, konteks.subjectId, konteks.semester, 'uas'); } catch (e) { toast.error(await pesanGalatApi(e, 'Gagal mengunduh template.')); } finally { setProses(null); }
  };

  return (
    <div className="space-y-3">
      <Alert className={boleh ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}>
        {boleh ? <Info className="h-4 w-4 text-emerald-700" /> : <Lock className="h-4 w-4 text-slate-500" />}
        <AlertDescription className="text-xs text-slate-700">
          Nilai UAS diisi panitia ujian{masa?.ujian_nama ? ` (${masa.ujian_nama})` : ''}. {boleh
            ? `Anda dapat mengubahnya selama masa ${masa?.masa?.jenis === 'remidi' ? 'remidi' : 'ujian'} yang dibuka panitia.`
            : (masa?.pesan || 'Nilai hanya dapat diubah selama masa ujian/remidi yang dibuka panitia.')}
        </AlertDescription>
      </Alert>
      {boleh && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={template} disabled={!!proses} className="gap-1"><Download className="h-4 w-4" /> Unduh Template Excel</Button>
          <input ref={masukan} type="file" accept=".xlsx" className="hidden" onChange={(e) => impor(e.target.files?.[0])} data-testid="input-impor-uas" />
          <Button variant="outline" size="sm" onClick={() => masukan.current?.click()} disabled={!!proses} className="gap-1">
            {proses === 'impor' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />} Impor Excel
          </Button>
          <Button size="sm" onClick={simpan} disabled={!!proses || !berubah.length} className="gap-1 bg-[#006837] hover:bg-[#00552d]" data-testid="btn-simpan-uas">
            {proses === 'simpan' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan{berubah.length ? ` (${berubah.length})` : ''}
          </Button>
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-slate-200" data-testid="tabel-uas">
        <table className="w-full min-w-[420px] text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-600">
            <tr><th className="w-10 px-3 py-2">No</th><th className="px-3 py-2">NISN</th><th className="px-3 py-2">Nama</th><th className="w-32 px-3 py-2 text-center">Nilai UAS</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.siswa.map((s, i) => (
              <tr key={s.id} className="even:bg-slate-50/50">
                <td className="px-3 py-1.5 text-slate-500">{i + 1}</td>
                <td className="px-3 py-1.5 font-mono text-xs text-slate-600">{s.nisn || '-'}</td>
                <td className="px-3 py-1.5 font-medium text-slate-900">{s.nama}</td>
                <td className="px-3 py-1.5 text-center">
                  {boleh ? (
                    <Input type="number" min="0" max="100" step="0.01" value={nilai[s.id] ?? ''} onChange={(e) => setNilai((x) => ({ ...x, [s.id]: e.target.value }))}
                      aria-label={`Nilai UAS ${s.nama}`} className={`mx-auto h-9 w-24 ${nilaiSah(nilai[s.id]) ? '' : 'border-rose-400'}`} data-testid={`uas-${s.id}`} />
                  ) : <span className="font-mono">{formatNilai(data.rekap[s.id]?.uas)}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Input Nilai guru mapel (/nilai/input): pilih kelas, mapel & semester, atur mode kolom (Nilai saja atau Pengetahuan &
 * Keterampilan) per kelas–mapel, lalu isi nilai pada tab Ulangan, Sumatif (kolom per TP/LM), UTS, dan UAS. Setiap jenis
 * berdiri sendiri; siswa melihat rerata ulangan, rerata sumatif, UTS, dan UAS tanpa nilai gabungan.
 */
export default function GradesInputPage() {
  const { user, activeRole } = useAuth();
  const isAdmin = activeRole === 'admin';

  const [activeAY, setActiveAY] = useState(null);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachings, setTeachings] = useState([]);
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [semester, setSemester] = useState('ganjil');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [memuatData, setMemuatData] = useState(false);
  const [masaUas, setMasaUas] = useState(null);
  const [tab, setTab] = useState('ulangan');
  const [modal, setModal] = useState(null); // { jenis, kolom }
  const [gantiMode, setGantiMode] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const ay = await api.get('/academic-years/active');
        setActiveAY(ay.data);
        setSemester(ay.data?.active_semester || (new Date().getMonth() >= 6 ? 'ganjil' : 'genap'));
        const [cls, sub, sch] = await Promise.all([
          ay.data ? api.get('/classes', { params: { academic_year_id: ay.data.id } }) : api.get('/classes'),
          api.get('/subjects'),
          api.get('/schedules'),
        ]);
        setClasses(cls.data || []);
        setSubjects(sub.data || []);
        const all = sch.data || [];
        setTeachings(isAdmin ? all : all.filter((s) => s.teacher_id === user?.id));
      } catch {
        toast.error('Gagal memuat data kelas & mapel');
      } finally {
        setLoading(false);
      }
    })();
  }, [activeRole]); // eslint-disable-line react-hooks/exhaustive-deps

  const teachingCombos = useMemo(() => {
    const map = {};
    teachings.forEach((t) => { map[`${t.class_id}__${t.subject_id}`] = { class_id: t.class_id, subject_id: t.subject_id }; });
    return Object.values(map);
  }, [teachings]);
  const availableClasses = useMemo(() => {
    if (isAdmin) return classes;
    const ids = new Set(teachingCombos.map((c) => c.class_id));
    return classes.filter((c) => ids.has(c.id));
  }, [classes, teachingCombos, isAdmin]);
  const availableSubjects = useMemo(() => {
    if (isAdmin) return subjects;
    if (!classId) return [];
    const ids = new Set(teachingCombos.filter((c) => c.class_id === classId).map((c) => c.subject_id));
    return subjects.filter((s) => ids.has(s.id));
  }, [subjects, teachingCombos, classId, isAdmin]);

  const muat = useCallback(async () => {
    if (!classId || !subjectId) { setData(null); return; }
    setMemuatData(true);
    try {
      setData(await muatPenilaian(classId, subjectId, semester));
    } catch (e) {
      setData(null);
      toast.error(await pesanGalatApi(e, 'Gagal memuat nilai'));
    } finally {
      setMemuatData(false);
    }
  }, [classId, subjectId, semester]);
  useEffect(() => { muat(); }, [muat]);
  useEffect(() => {
    if (!classId || !subjectId) { setMasaUas(null); return; }
    muatMasaGuru(classId, subjectId).then(setMasaUas).catch(() => setMasaUas(null));
  }, [classId, subjectId]);

  const kelasNama = classes.find((c) => c.id === classId)?.name;
  const mapelNama = subjects.find((s) => s.id === subjectId)?.name;
  const konteks = { classId, subjectId, semester, label: `${mapelNama || ''} · Kelas ${kelasNama || ''} · Semester ${semester}` };

  const pilihMode = async (mode) => {
    if (!data || mode === data.mode) return;
    setGantiMode(true);
    try {
      setData(await ubahMode(classId, subjectId, semester, mode));
      toast.success(`Mode kolom: ${MODE_KOLOM[mode].label}`);
    } catch (e) {
      toast.error(await pesanGalatApi(e, 'Gagal mengganti mode kolom'));
    } finally {
      setGantiMode(false);
    }
  };

  const simpanModal = async (isi) => {
    const { jenis, kolom } = modal;
    try {
      const hasil = kolom
        ? await ubahKolom(kolom.id, isi)
        : await tambahKolom(classId, subjectId, { semester, jenis, ...isi });
      setData(hasil);
      setModal(null);
      toast.success(`Nilai ${JENIS_TAB[jenis].label}${jenis !== 'uts' ? ` ke-${isi.ke}` : ''} tersimpan`);
    } catch (e) {
      toast.error(await pesanGalatApi(e, 'Gagal menyimpan nilai'));
    }
  };

  const hapus = async (kolom) => {
    const nama = `${JENIS_TAB[kolom.jenis].label}${kolom.jenis !== 'uts' ? ` ke-${kolom.ke}` : ''}`;
    if (!(await confirmDialog(`Hapus kolom nilai ${nama} beserta seluruh nilainya? Rerata siswa akan dihitung ulang.`))) return;
    try {
      setData(await hapusKolom(kolom.id));
      toast.success(`Kolom ${nama} dihapus`);
    } catch (e) {
      toast.error(await pesanGalatApi(e, 'Gagal menghapus kolom'));
    }
  };

  const keBerikut = (jenis) => Math.max(0, ...(data?.kolom?.[jenis] || []).map((k) => k.ke || 0)) + 1;

  if (loading) return <div className="text-sm text-slate-500">Memuat...</div>;

  return (
    <div className="space-y-6" data-testid="grades-input-page">
      <div>
        <Badge className="mb-2 border-[#006837]/20 bg-[#006837]/10 text-[#006837]"><ClipboardEdit className="mr-1 h-3 w-3" /> Input Nilai</Badge>
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Input Nilai</h1>
        <p className="mt-1 text-sm text-slate-600">
          {isAdmin ? 'Input nilai untuk semua kelas dan mata pelajaran' : 'Input nilai Ulangan, Sumatif, UTS, dan UAS untuk kelas dan mata pelajaran yang Anda ampu'}
        </p>
      </div>

      {!isAdmin && teachingCombos.length === 0 && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertCircle className="h-4 w-4 text-amber-700" />
          <AlertDescription className="text-amber-900">Anda belum memiliki jadwal mengajar di TP aktif. Hubungi admin untuk pendataan jadwal.</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-3">
          <div>
            <Label className="text-xs uppercase tracking-wide">Kelas *</Label>
            <Select value={classId} onValueChange={(v) => { setClassId(v); setSubjectId(''); }}>
              <SelectTrigger data-testid="grades-class"><SelectValue placeholder="Pilih kelas..." /></SelectTrigger>
              <SelectContent>{availableClasses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide">Mata Pelajaran *</Label>
            <Select value={subjectId} onValueChange={setSubjectId} disabled={!classId}>
              <SelectTrigger data-testid="grades-subject"><SelectValue placeholder="Pilih mapel..." /></SelectTrigger>
              <SelectContent>{availableSubjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} {s.code ? `(${s.code})` : ''}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide">Semester</Label>
            <Select value={semester} onValueChange={setSemester}>
              <SelectTrigger data-testid="grades-semester"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(activeAY?.semester_type === 'accelerated' ? ['1', '2', '3', '4', '5', '6'] : ['ganjil', 'genap']).map((s) => (
                  <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {classId && subjectId && !data && memuatData && <div className="p-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-[#006837]" /></div>}

      {classId && subjectId && data && (
        <Card>
          <CardContent className="space-y-4 p-4 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Users className="h-4 w-4 text-slate-400" />
                <span className="font-semibold">{data.siswa.length} Siswa</span>
                <Badge variant="outline">TP {data.tahun_pelajaran || activeAY?.name || '-'}</Badge>
                {memuatData && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
              </div>
              <div className="space-y-1" data-testid="mode-kolom">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mode kolom nilai (kelas & mapel ini)</p>
                <div className="grid grid-cols-2 gap-1 rounded-lg border border-slate-200 bg-white p-1" role="radiogroup" aria-label="Mode kolom nilai">
                  {Object.entries(MODE_KOLOM).map(([k, m]) => {
                    const aktif = data.mode === k;
                    const kunci = data.mode_terkunci && !aktif;
                    return (
                      <button key={k} type="button" role="radio" aria-checked={aktif} disabled={kunci || gantiMode} onClick={() => pilihMode(k)}
                        title={kunci ? 'Mode terkunci karena sudah ada nilai. Hapus/kosongkan nilai untuk mengganti mode.' : m.ket}
                        className={`flex items-center justify-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006837] disabled:cursor-not-allowed sm:text-sm ${
                          aktif ? 'bg-[#006837] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:hover:bg-transparent'}`}
                        data-testid={`mode-${k}`}>
                        {kunci && <Lock className="h-3 w-3 shrink-0" />} {m.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-500">
                  {data.mode_terkunci ? 'Terkunci karena sudah ada nilai.' : MODE_KOLOM[data.mode].ket} Berlaku untuk Ulangan, Sumatif & UTS; UAS selalu satu kolom nilai.
                </p>
              </div>
            </div>

            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="grid w-full grid-cols-4 sm:inline-flex sm:w-auto">
                {['ulangan', 'sumatif', 'uts', 'uas'].map((j) => (
                  <TabsTrigger key={j} value={j} data-testid={`tab-${j}`}>
                    {JENIS_TAB[j].label}
                    {j !== 'uts' && j !== 'uas' && data.kolom[j].length > 0 && <span className="ml-1 rounded-full bg-slate-200 px-1.5 text-[10px] text-slate-700">{data.kolom[j].length}</span>}
                  </TabsTrigger>
                ))}
              </TabsList>
              {['ulangan', 'sumatif'].map((j) => (
                <TabsContent key={j} value={j} className="mt-4">
                  <TabKolom jenis={j} data={data} onTambah={() => setModal({ jenis: j, kolom: null })} onUbah={(k) => setModal({ jenis: j, kolom: k })} onHapus={hapus} />
                </TabsContent>
              ))}
              <TabsContent value="uts" className="mt-4">
                <TabUts data={data} onIsi={(k) => setModal({ jenis: 'uts', kolom: k })} onHapus={hapus} />
              </TabsContent>
              <TabsContent value="uas" className="mt-4">
                <TabUas data={data} masa={masaUas} konteks={konteks} onTersimpan={muat} />
              </TabsContent>
            </Tabs>
            <p className="text-[11px] text-slate-500">
              Ketercapaian dihitung dari Nilai Batas Ketercapaian (KKTP) tiap kolom: rentang KKTP–100 dibagi tiga (Cukup, Baik, Sangat Baik); di bawah KKTP = Belum Tercapai.
            </p>
          </CardContent>
        </Card>
      )}

      {data && modal && (
        <ModalNilai open={!!modal} jenis={modal.jenis} mode={data.mode} siswa={data.siswa} kolom={modal.kolom} keBerikut={keBerikut(modal.jenis)}
          kktpBawaan={modal.kolom?.kktp ?? data.kolom[modal.jenis]?.slice?.(-1)?.[0]?.kktp ?? data.kktp_bawaan} konteks={konteks}
          onTutup={() => setModal(null)} onSimpan={simpanModal} />
      )}
    </div>
  );
}
