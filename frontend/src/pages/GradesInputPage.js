import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ClipboardEdit, Save, BookOpen, Users, AlertCircle, Info, Lock } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';
import { muatMasaGuru, simpanUasGuru } from '@/lib/ujianNilai';

function computePredicate(avg) {
  if (avg == null || isNaN(avg)) return '';
  if (avg >= 88) return 'A';
  if (avg >= 76) return 'B';
  if (avg >= 60) return 'C';
  return 'D';
}

export default function GradesInputPage() {
  const { user, activeRole } = useAuth();
  const isAdmin = activeRole === 'admin';

  const [activeAY, setActiveAY] = useState(null);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachings, setTeachings] = useState([]); // schedules where teacher_id == user.id
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [semester, setSemester] = useState('ganjil');
  const [students, setStudents] = useState([]);
  const [grades, setGrades] = useState({});
  const [masaUas, setMasaUas] = useState(null);
  const [uasAwal, setUasAwal] = useState({});
  const bolehUas = !!masaUas?.boleh_ubah;
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const ay = await api.get('/academic-years/active');
        setActiveAY(ay.data);
        // active_semester tidak dikirim server: bawaan menurut bulan (Juli–Desember ganjil, Januari–Juni genap).
        setSemester(ay.data?.active_semester || (new Date().getMonth() >= 6 ? 'ganjil' : 'genap'));
        const [cls, sub, sch] = await Promise.all([
          // Load classes for active academic year
          ay.data ? api.get('/classes', { params: { academic_year_id: ay.data.id } }) : api.get('/classes'),
          api.get('/subjects'),
          api.get('/schedules'),
        ]);
        setClasses(cls.data || []);
        setSubjects(sub.data || []);
        const all = sch.data || [];
        if (isAdmin) {
          setTeachings(all);
        } else {
          // Limit to schedules where this user is the teacher
          setTeachings(all.filter((s) => s.teacher_id === user?.id));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [activeRole]);

  // Available class+subject combinations
  const teachingCombos = useMemo(() => {
    const map = {};
    teachings.forEach((t) => {
      const key = `${t.class_id}__${t.subject_id}`;
      if (!map[key]) {
        map[key] = {
          class_id: t.class_id, subject_id: t.subject_id,
          class_name: t.class_name, subject_name: t.subject_name,
          subject_code: t.subject_code,
        };
      }
    });
    return Object.values(map);
  }, [teachings]);

  // Available classes from teaching combos
  const availableClasses = useMemo(() => {
    if (isAdmin) return classes;
    const ids = new Set(teachingCombos.map((c) => c.class_id));
    return classes.filter((c) => ids.has(c.id));
  }, [classes, teachingCombos, isAdmin]);

  // Available subjects (for selected class)
  const availableSubjects = useMemo(() => {
    if (isAdmin) return subjects;
    if (!classId) return [];
    const ids = new Set(teachingCombos.filter((c) => c.class_id === classId).map((c) => c.subject_id));
    return subjects.filter((s) => ids.has(s.id));
  }, [subjects, teachingCombos, classId, isAdmin]);

  // Load students of selected class + existing grades
  useEffect(() => {
    if (!classId) return;
    (async () => {
      try {
        const [studs, gr] = await Promise.all([
          api.get('/students', { params: { class_id: classId } }),
          api.get('/grades', { params: { class_id: classId, subject_id: subjectId || undefined, semester } }),
        ]);
        setStudents(studs.data || []);
        const map = {};
        (gr.data || []).forEach((g) => {
          map[g.student_id] = {
            nilai_pengetahuan: g.nilai_pengetahuan ?? '',
            nilai_keterampilan: g.nilai_keterampilan ?? '',
            nilai_uas: g.nilai_uas ?? '',
            description: g.description || '',
          };
        });
        setGrades(map);
        setUasAwal(Object.fromEntries(Object.entries(map).map(([k, v]) => [k, v.nilai_uas])));
      } catch (e) {
        toast.error('Gagal memuat data siswa');
      }
    })();
  }, [classId, subjectId, semester]);

  // Nilai UAS diisi panitia ujian; guru pengampu hanya boleh mengubahnya selama masa ujian/remidi yang dibuka panitia.
  useEffect(() => {
    if (!classId || !subjectId) { setMasaUas(null); return; }
    muatMasaGuru(classId, subjectId).then(setMasaUas).catch(() => setMasaUas(null));
  }, [classId, subjectId]);

  const setVal = (sid, field, val) => {
    setGrades({ ...grades, [sid]: { ...(grades[sid] || {}), [field]: val } });
  };

  const submitGrades = async () => {
    if (!classId || !subjectId) {
      toast.error('Pilih kelas dan mata pelajaran');
      return;
    }
    const uasBerubah = bolehUas ? students.filter((st) => String(grades[st.id]?.nilai_uas ?? '') !== String(uasAwal[st.id] ?? '')) : [];
    for (const st of uasBerubah) {
      const v = grades[st.id]?.nilai_uas;
      if (v !== '' && v != null && (Number.isNaN(Number(v)) || Number(v) < 0 || Number(v) > 100)) {
        toast.error(`Nilai UAS ${st.full_name} harus 0–100`);
        return;
      }
    }
    const entries = [];
    for (const s of students) {
      const g = grades[s.id] || {};
      const np = g.nilai_pengetahuan;
      const nk = g.nilai_keterampilan;
      if (np === '' && nk === '' && !g.description) continue; // skip empty
      entries.push({
        student_id: s.id,
        nilai_pengetahuan: np !== '' && np != null ? parseFloat(np) : null,
        nilai_keterampilan: nk !== '' && nk != null ? parseFloat(nk) : null,
        description: g.description || '',
      });
    }
    if (entries.length === 0 && uasBerubah.length === 0) {
      toast.error('Belum ada nilai yang diisi');
      return;
    }
    setBusy(true);
    try {
      if (entries.length) {
        const { data } = await api.post('/grades/bulk', {
          class_id: classId, subject_id: subjectId, semester, entries,
        });
        toast.success(`Nilai ${data.success || entries.length} siswa disimpan`);
      }
      if (uasBerubah.length) {
        const h = await simpanUasGuru(classId, subjectId, uasBerubah.map((st) => ({
          student_id: st.id, nilai_uas: grades[st.id]?.nilai_uas === '' ? null : Number(grades[st.id]?.nilai_uas),
        })));
        setUasAwal(Object.fromEntries(students.map((st) => [st.id, grades[st.id]?.nilai_uas ?? ''])));
        toast.success(`Nilai UAS ${h.disimpan} siswa disimpan${h.tiruan ? ' (contoh)' : ''}`);
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menyimpan');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="text-sm text-slate-500">Memuat...</div>;

  return (
    <div className="space-y-6" data-testid="grades-input-page">
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
          <ClipboardEdit className="h-3 w-3 mr-1" /> Input Nilai
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Input Nilai E-Rapor</h1>
        <p className="text-sm text-slate-600 mt-1">
          {isAdmin ? 'Input nilai untuk siswa di semua kelas dan mata pelajaran' : 'Input nilai untuk kelas dan mata pelajaran yang Anda ampu'}
        </p>
      </div>

      {!isAdmin && teachingCombos.length === 0 && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertCircle className="h-4 w-4 text-amber-700" />
          <AlertDescription className="text-amber-900">
            Anda belum memiliki jadwal mengajar di TP aktif. Hubungi admin untuk pendataan jadwal.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs uppercase tracking-wide">Kelas *</Label>
            <Select value={classId} onValueChange={(v) => { setClassId(v); setSubjectId(''); }}>
              <SelectTrigger data-testid="grades-class"><SelectValue placeholder="Pilih kelas..." /></SelectTrigger>
              <SelectContent>
                {availableClasses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide">Mata Pelajaran *</Label>
            <Select value={subjectId} onValueChange={setSubjectId} disabled={!classId}>
              <SelectTrigger data-testid="grades-subject"><SelectValue placeholder="Pilih mapel..." /></SelectTrigger>
              <SelectContent>
                {availableSubjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} {s.code ? `(${s.code})` : ''}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide">Semester</Label>
            <Select value={semester} onValueChange={setSemester}>
              <SelectTrigger data-testid="grades-semester"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(activeAY?.semester_type === 'accelerated' ? ['1','2','3','4','5','6'] : ['ganjil','genap']).map((s) => (
                  <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {classId && subjectId && (
        <Card>
          <CardContent className="p-0">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-slate-400" />
                <span className="font-semibold">{students.length} Siswa</span>
                <Badge variant="outline">TP {activeAY?.name || '-'}</Badge>
              </div>
              <Button onClick={submitGrades} disabled={busy} className="bg-[#006837] hover:bg-[#0B7A3B] gap-2" data-testid="grades-submit">
                <Save className="h-4 w-4" /> {busy ? 'Menyimpan...' : 'Simpan Semua Nilai'}
              </Button>
            </div>
            <Alert className="m-4 border-blue-200 bg-blue-50">
              <Info className="h-4 w-4 text-blue-700" />
              <AlertDescription className="text-blue-900 text-xs">
                Skala nilai <strong>0-100</strong>. Nilai Akhir = (Pengetahuan + Keterampilan) / 2. Predikat dihitung otomatis: A &ge;88, B &ge;76, C &ge;60, D &lt;60.
                {' '}Kolom <strong>UAS</strong> diisi panitia ujian{masaUas?.ujian_nama ? ` (${masaUas.ujian_nama})` : ''}; {bolehUas
                  ? `Anda dapat mengubahnya selama masa ${masaUas?.masa?.jenis === 'remidi' ? 'remidi' : 'ujian'} yang dibuka panitia.`
                  : (masaUas?.pesan || 'hanya dapat diubah selama masa ujian/remidi yang dibuka panitia.')}
              </AlertDescription>
            </Alert>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">No</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>NISN</TableHead>
                    <TableHead className="w-28">Pengetahuan</TableHead>
                    <TableHead className="w-28">Keterampilan</TableHead>
                    <TableHead className="w-24" title={masaUas?.pesan || 'Nilai UAS dari panitia ujian'}>
                      <span className="inline-flex items-center gap-1">UAS {!bolehUas && <Lock className="h-3 w-3 text-slate-400" aria-label="terkunci" />}</span>
                    </TableHead>
                    <TableHead className="w-24">Nilai Akhir</TableHead>
                    <TableHead className="w-20">Predikat</TableHead>
                    <TableHead>Deskripsi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((s, i) => {
                    const g = grades[s.id] || {};
                    const np = g.nilai_pengetahuan !== '' && g.nilai_pengetahuan != null ? parseFloat(g.nilai_pengetahuan) : null;
                    const nk = g.nilai_keterampilan !== '' && g.nilai_keterampilan != null ? parseFloat(g.nilai_keterampilan) : null;
                    let avg = null;
                    if (np != null && nk != null) avg = (np + nk) / 2;
                    else if (np != null) avg = np;
                    else if (nk != null) avg = nk;
                    const pred = computePredicate(avg);
                    return (
                      <TableRow key={s.id} data-testid={`grade-row-${s.id}`}>
                        <TableCell className="text-center text-slate-500">{i + 1}</TableCell>
                        <TableCell className="font-medium">{s.full_name}</TableCell>
                        <TableCell className="font-mono text-xs">{s.nisn || '-'}</TableCell>
                        <TableCell>
                          <Input type="number" min="0" max="100" step="0.5" className="h-9"
                            value={g.nilai_pengetahuan ?? ''} onChange={(e) => setVal(s.id, 'nilai_pengetahuan', e.target.value)}
                            data-testid={`grade-np-${s.id}`} />
                        </TableCell>
                        <TableCell>
                          <Input type="number" min="0" max="100" step="0.5" className="h-9"
                            value={g.nilai_keterampilan ?? ''} onChange={(e) => setVal(s.id, 'nilai_keterampilan', e.target.value)}
                            data-testid={`grade-nk-${s.id}`} />
                        </TableCell>
                        <TableCell className="text-center">
                          {bolehUas ? (
                            <Input type="number" min="0" max="100" step="0.5" className="h-9"
                              value={g.nilai_uas ?? ''} onChange={(e) => setVal(s.id, 'nilai_uas', e.target.value)}
                              aria-label={`Nilai UAS ${s.full_name}`} data-testid={`grade-uas-${s.id}`} />
                          ) : (
                            <span className="font-mono text-sm text-slate-700" data-testid={`grade-uas-${s.id}`}>
                              {g.nilai_uas !== '' && g.nilai_uas != null ? Number(g.nilai_uas).toFixed(1) : '-'}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono font-bold text-center">
                          {avg != null ? avg.toFixed(1) : '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          {pred && <Badge className={
                            pred === 'A' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                            pred === 'B' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                            pred === 'C' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                            'bg-rose-100 text-rose-800 border-rose-200'
                          }>{pred}</Badge>}
                        </TableCell>
                        <TableCell>
                          <Input className="h-9" placeholder="Catatan..."
                            value={g.description || ''} onChange={(e) => setVal(s.id, 'description', e.target.value)}
                            data-testid={`grade-desc-${s.id}`} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {students.length === 0 && (
                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-slate-500">Tidak ada siswa di kelas ini</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
