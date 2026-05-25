import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  FileText, Download, Printer, GraduationCap, BookOpen, TrendingUp,
  Award, Loader2, User as UserIcon, Hash, Calendar as CalendarIcon,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';

function PredicateBadge({ p }) {
  if (!p) return <Badge variant="outline">-</Badge>;
  const cls = p === 'A' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
              p === 'B' ? 'bg-blue-100 text-blue-800 border-blue-200' :
              p === 'C' ? 'bg-amber-100 text-amber-800 border-amber-200' :
              'bg-rose-100 text-rose-800 border-rose-200';
  return <Badge className={cls}>{p}</Badge>;
}

export default function RaporPage() {
  const { user, activeRole, settings } = useAuth();
  const [params, setParams] = useSearchParams();
  const isAdmin = activeRole === 'admin';
  const isSiswa = activeRole === 'siswa';
  const isWaliKelas = activeRole === 'wali_kelas';

  const [students, setStudents] = useState([]);
  const [studentId, setStudentId] = useState(params.get('student_id') || (isSiswa ? user?.id : ''));
  const [semester, setSemester] = useState(params.get('semester') || 'ganjil');
  const [rapor, setRapor] = useState(null);
  const [allGrades, setAllGrades] = useState(null); // All grades from class 7, 8, 9
  const [ekstrakurikuler, setEkstrakurikuler] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isSiswa) {
      (async () => {
        try {
          const url = isWaliKelas ? '/students' : '/users';
          const { data } = await api.get(url, isWaliKelas ? {} : { params: { role: 'siswa' } });
          setStudents(data || []);
        } catch (e) { /* ignore */ }
      })();
    }
  }, [activeRole]);

  const loadRapor = async () => {
    if (!studentId) {
      toast.error('Pilih siswa');
      return;
    }
    setLoading(true);
    try {
      // Fetch current semester rapor
      const { data } = await api.get(`/grades/rapor/${studentId}`, { params: { semester } });
      setRapor(data);

      // Fetch comprehensive grades from all years (class 7, 8, 9)
      try {
        const { data: comprehensiveData } = await api.get(`/grades/student/${studentId}`);
        // Group grades by subject and organize by grade level (7, 8, 9)
        const gradesBySubject = {};

        (comprehensiveData || []).forEach(grade => {
          const subjectKey = grade.subject_id || grade.subject_code;
          if (!gradesBySubject[subjectKey]) {
            gradesBySubject[subjectKey] = {
              subject_name: grade.subject_name || grade.subject_code,
              class7: {},
              class8: {},
              class9: {}
            };
          }

          // Determine which class level this grade belongs to
          const classLevel = grade.class_name?.match(/^(\d)/)?.[1];
          if (classLevel === '7') {
            gradesBySubject[subjectKey].class7 = {
              ulangan: grade.nilai_harian || grade.nilai_ulangan,
              uts: grade.nilai_uts,
              uas: grade.nilai_uas
            };
          } else if (classLevel === '8') {
            gradesBySubject[subjectKey].class8 = {
              ulangan: grade.nilai_harian || grade.nilai_ulangan,
              uts: grade.nilai_uts,
              uas: grade.nilai_uas
            };
          } else if (classLevel === '9') {
            gradesBySubject[subjectKey].class9 = {
              ulangan: grade.nilai_harian || grade.nilai_ulangan,
              uts: grade.nilai_uts,
              uas: grade.nilai_uas
            };
          }
        });

        setAllGrades(gradesBySubject);
      } catch (e) {
        console.error('Failed to fetch comprehensive grades:', e);
        setAllGrades({});
      }

      // Fetch ekstrakurikuler data
      try {
        const { data: ekstraData } = await api.get(`/ekstrakurikuler/student/${studentId}`);
        setEkstrakurikuler(ekstraData || []);
      } catch (e) {
        console.error('Failed to fetch ekstrakurikuler:', e);
        setEkstrakurikuler([]);
      }

      setParams({ student_id: studentId, semester });
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal memuat rapor');
      setRapor(null);
      setAllGrades(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (studentId) loadRapor();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, semester]);

  const handlePrint = () => window.print();

  return (
    <div className="space-y-6" data-testid="rapor-page">
      <div className="flex items-start justify-between gap-3 flex-wrap print:hidden">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <FileText className="h-3 w-3 mr-1" /> E-Rapor Digital
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
            {isSiswa ? 'Rapor Saya' : 'E-Rapor Digital Siswa'}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Hasil belajar siswa per semester
          </p>
        </div>
        {rapor && (
          <Button onClick={handlePrint} variant="outline" className="gap-2" data-testid="print-rapor">
            <Printer className="h-4 w-4" /> Cetak Rapor
          </Button>
        )}
      </div>

      <Card className="print:hidden">
        <CardContent className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {!isSiswa && (
            <div>
              <Label className="text-xs uppercase tracking-wide">Siswa</Label>
              <Select value={studentId} onValueChange={setStudentId}>
                <SelectTrigger data-testid="rapor-student"><SelectValue placeholder="Pilih siswa..." /></SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.full_name} {s.nisn ? `(${s.nisn})` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label className="text-xs uppercase tracking-wide">Semester</Label>
            <Select value={semester} onValueChange={setSemester}>
              <SelectTrigger data-testid="rapor-semester"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ganjil">Ganjil</SelectItem>
                <SelectItem value="genap">Genap</SelectItem>
                <SelectItem value="1">Semester 1 (Percepatan)</SelectItem>
                <SelectItem value="2">Semester 2 (Percepatan)</SelectItem>
                <SelectItem value="3">Semester 3 (Percepatan)</SelectItem>
                <SelectItem value="4">Semester 4 (Percepatan)</SelectItem>
                <SelectItem value="5">Semester 5 (Percepatan)</SelectItem>
                <SelectItem value="6">Semester 6 (Percepatan)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <Card><CardContent className="p-12 text-center text-slate-500">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-[#006837]" />
          Memuat data rapor...
        </CardContent></Card>
      )}

      {!loading && rapor && (
        <div className="space-y-4" id="rapor-document">
          {/* Header Sekolah - Print friendly */}
          <Card className="border-2 border-[#006837]">
            <CardContent className="p-6">
              <div className="text-center pb-4 border-b-2 border-[#006837]">
                {settings?.logo_url && (
                  <img src={settings.logo_url} alt="Logo" className="h-16 w-16 mx-auto mb-2 object-contain" />
                )}
                <div className="text-xs uppercase tracking-widest text-slate-600">Kementerian Agama Republik Indonesia</div>
                <h2 className="text-xl font-bold text-[#006837]">{settings?.school_name || 'MTsN 2 Kota Malang'}</h2>
                {settings?.address && <div className="text-xs text-slate-600">{settings.address}</div>}
                <h3 className="text-lg font-bold mt-3">LAPORAN HASIL BELAJAR (E-RAPOR)</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 text-sm">
                <InfoRow icon={UserIcon} label="Nama Siswa" value={rapor.student?.full_name} />
                <InfoRow icon={Hash} label="NISN" value={rapor.student?.nisn} mono />
                <InfoRow icon={GraduationCap} label="Kelas" value={rapor.class?.name} />
                <InfoRow icon={CalendarIcon} label="Tahun Pelajaran" value={rapor.academic_year?.name} />
                <InfoRow icon={BookOpen} label="Semester" value={(semester || '').charAt(0).toUpperCase() + (semester || '').slice(1)} />
                <InfoRow icon={TrendingUp} label="Nilai Rata-rata" value={rapor.average ? rapor.average.toFixed(2) : '-'} highlight />
              </div>
            </CardContent>
          </Card>

          {/* Tabel Nilai Komprehensif - Kelas 7, 8, 9 */}
          <Card>
            <CardContent className="p-0">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Award className="h-4 w-4 text-[#006837]" />
                  <h3 className="font-bold">Rekap Nilai Lengkap (Kelas 7, 8, 9)</h3>
                </div>
                <Badge variant="outline">{Object.keys(allGrades || {}).length} Mapel</Badge>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead rowSpan={2} className="align-middle border-r text-center w-12">No</TableHead>
                      <TableHead rowSpan={2} className="align-middle border-r min-w-[180px]">Mata Pelajaran</TableHead>
                      <TableHead colSpan={3} className="text-center border-r bg-blue-50">Kelas 7</TableHead>
                      <TableHead colSpan={3} className="text-center border-r bg-green-50">Kelas 8</TableHead>
                      <TableHead colSpan={3} className="text-center bg-amber-50">Kelas 9</TableHead>
                    </TableRow>
                    <TableRow>
                      <TableHead className="text-center text-xs bg-blue-50">Ulangan</TableHead>
                      <TableHead className="text-center text-xs bg-blue-50">UTS</TableHead>
                      <TableHead className="text-center text-xs border-r bg-blue-50">UAS</TableHead>
                      <TableHead className="text-center text-xs bg-green-50">Ulangan</TableHead>
                      <TableHead className="text-center text-xs bg-green-50">UTS</TableHead>
                      <TableHead className="text-center text-xs border-r bg-green-50">UAS</TableHead>
                      <TableHead className="text-center text-xs bg-amber-50">Ulangan</TableHead>
                      <TableHead className="text-center text-xs bg-amber-50">UTS</TableHead>
                      <TableHead className="text-center text-xs bg-amber-50">UAS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allGrades && Object.entries(allGrades).map(([subjectId, data], i) => (
                      <TableRow key={subjectId} data-testid={`rapor-comprehensive-row-${i}`}>
                        <TableCell className="text-center text-slate-500 border-r">{i + 1}</TableCell>
                        <TableCell className="font-medium border-r">{data.subject_name || '-'}</TableCell>

                        {/* Kelas 7 */}
                        <TableCell className="font-mono text-center text-sm bg-blue-50/30">
                          {data.class7?.ulangan != null ? data.class7.ulangan.toFixed(1) : '-'}
                        </TableCell>
                        <TableCell className="font-mono text-center text-sm bg-blue-50/30">
                          {data.class7?.uts != null ? data.class7.uts.toFixed(1) : '-'}
                        </TableCell>
                        <TableCell className="font-mono text-center text-sm border-r bg-blue-50/30">
                          {data.class7?.uas != null ? data.class7.uas.toFixed(1) : '-'}
                        </TableCell>

                        {/* Kelas 8 */}
                        <TableCell className="font-mono text-center text-sm bg-green-50/30">
                          {data.class8?.ulangan != null ? data.class8.ulangan.toFixed(1) : '-'}
                        </TableCell>
                        <TableCell className="font-mono text-center text-sm bg-green-50/30">
                          {data.class8?.uts != null ? data.class8.uts.toFixed(1) : '-'}
                        </TableCell>
                        <TableCell className="font-mono text-center text-sm border-r bg-green-50/30">
                          {data.class8?.uas != null ? data.class8.uas.toFixed(1) : '-'}
                        </TableCell>

                        {/* Kelas 9 */}
                        <TableCell className="font-mono text-center text-sm bg-amber-50/30">
                          {data.class9?.ulangan != null ? data.class9.ulangan.toFixed(1) : '-'}
                        </TableCell>
                        <TableCell className="font-mono text-center text-sm bg-amber-50/30">
                          {data.class9?.uts != null ? data.class9.uts.toFixed(1) : '-'}
                        </TableCell>
                        <TableCell className="font-mono text-center text-sm bg-amber-50/30">
                          {data.class9?.uas != null ? data.class9.uas.toFixed(1) : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!allGrades || Object.keys(allGrades).length === 0) && (
                      <TableRow><TableCell colSpan={11} className="text-center py-12 text-slate-500">
                        <FileText className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                        <div className="font-semibold">Belum ada nilai tercatat</div>
                        <div className="text-sm mt-1">Data nilai belum tersedia.</div>
                      </TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Tabel Ekstrakurikuler */}
          <Card>
            <CardContent className="p-0">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Award className="h-4 w-4 text-[#006837]" />
                  <h3 className="font-bold">Kegiatan Ekstrakurikuler</h3>
                </div>
                <Badge variant="outline">{ekstrakurikuler.length} Kegiatan</Badge>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">No</TableHead>
                      <TableHead>Nama Kegiatan</TableHead>
                      <TableHead>Predikat</TableHead>
                      <TableHead>Keterangan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ekstrakurikuler.map((ekstra, i) => (
                      <TableRow key={ekstra.id || i} data-testid={`ekstra-row-${i}`}>
                        <TableCell className="text-center text-slate-500">{i + 1}</TableCell>
                        <TableCell className="font-medium">{ekstra.name || ekstra.activity_name || '-'}</TableCell>
                        <TableCell className="text-center">
                          <PredicateBadge p={ekstra.predicate || ekstra.grade} />
                        </TableCell>
                        <TableCell className="text-sm text-slate-700">{ekstra.description || ekstra.notes || '-'}</TableCell>
                      </TableRow>
                    ))}
                    {ekstrakurikuler.length === 0 && (
                      <TableRow><TableCell colSpan={4} className="text-center py-8 text-slate-500">
                        <div className="text-sm">Belum ada kegiatan ekstrakurikuler tercatat</div>
                      </TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Legenda Predikat */}
          <Card>
            <CardContent className="p-4">
              <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-3">Keterangan Predikat</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <PredicateLegend p="A" range="88 - 100" label="Sangat Baik" />
                <PredicateLegend p="B" range="76 - 87" label="Baik" />
                <PredicateLegend p="C" range="60 - 75" label="Cukup" />
                <PredicateLegend p="D" range="&lt; 60" label="Kurang" />
              </div>
            </CardContent>
          </Card>

          {/* Tanda Tangan - Print only */}
          <Card className="hidden print:block">
            <CardContent className="p-6">
              <div className="grid grid-cols-2 gap-12 text-center text-sm pt-8">
                <div>
                  <div>Mengetahui,</div>
                  <div className="font-semibold">Wali Kelas</div>
                  <div className="mt-16 border-b border-slate-400 inline-block px-4">-</div>
                </div>
                <div>
                  <div>Malang, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                  <div className="font-semibold">Kepala Madrasah</div>
                  <div className="mt-16 font-bold">{settings?.headmaster_name || '-'}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {!loading && !rapor && studentId && (
        <Card><CardContent className="p-12 text-center">
          <FileText className="h-12 w-12 mx-auto text-slate-300 mb-3" />
          <div className="font-semibold text-slate-700">Belum ada data rapor</div>
          <div className="text-sm text-slate-500 mt-1">Pilih semester lain atau hubungi admin.</div>
        </CardContent></Card>
      )}
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, highlight, mono }) {
  return (
    <div className={`flex items-center gap-2 p-2 rounded-lg ${highlight ? 'bg-[#006837]/10' : 'bg-slate-50'}`}>
      <Icon className="h-4 w-4 text-slate-500 shrink-0" />
      <div className="flex-1">
        <div className="text-xs text-slate-500 uppercase tracking-wide">{label}</div>
        <div className={`font-bold ${highlight ? 'text-[#006837] text-lg' : ''} ${mono ? 'font-mono' : ''}`}>{value || '-'}</div>
      </div>
    </div>
  );
}

function PredicateLegend({ p, range, label }) {
  const cls = p === 'A' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
              p === 'B' ? 'bg-blue-100 text-blue-800 border-blue-200' :
              p === 'C' ? 'bg-amber-100 text-amber-800 border-amber-200' :
              'bg-rose-100 text-rose-800 border-rose-200';
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50">
      <Badge className={cls + ' h-7 w-7 flex items-center justify-center font-bold rounded-md'}>{p}</Badge>
      <div>
        <div className="text-xs text-slate-700 font-mono">{range}</div>
        <div className="text-xs text-slate-500">{label}</div>
      </div>
    </div>
  );
}
