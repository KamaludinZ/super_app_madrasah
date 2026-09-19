import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Users, Search, GraduationCap, Eye, UserCheck, UserX, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import StudentDetailDialog from '@/components/students/StudentDetailDialog';

export default function AdminUKSDataSiswaPage() {
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tingkatFilter, setTingkatFilter] = useState('all');
  const [genderFilter, setGenderFilter] = useState('all');
  const [detailStudent, setDetailStudent] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [studentsRes, classesRes] = await Promise.all([
        api.get('/students'),
        api.get('/classes'),
      ]);
      setStudents(studentsRes.data || []);
      setClasses(classesRes.data || []);
    } catch (e) {
      toast.error('Gagal memuat data siswa');
    } finally {
      setLoading(false);
    }
  };

  const tingkatOptions = [...new Set(classes.map((c) => c.grade).filter((g) => g !== undefined && g !== null))].sort((a, b) => a - b);
  const classIdToGrade = classes.reduce((acc, c) => { acc[c.id] = c.grade; return acc; }, {});

  const filtered = students.filter((s) => {
    if (search && !s.full_name?.toLowerCase().includes(search.toLowerCase()) && !s.nisn?.includes(search)) return false;
    if (genderFilter !== 'all' && s.gender !== genderFilter) return false;
    if (tingkatFilter !== 'all' && String(classIdToGrade[s.student_class_id]) !== String(tingkatFilter)) return false;
    return true;
  });

  return (
    <div className="space-y-6" data-testid="admin-uks-data-siswa-page">
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
          <Users className="h-3 w-3 mr-1" /> Menu UKS
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Data Siswa</h1>
        <p className="text-sm text-slate-600 mt-1">Rujukan data identitas dan kelas siswa untuk keperluan pelayanan UKS</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatBox icon={Users} label="Total" value={filtered.length} color="bg-slate-50 border-slate-200 text-slate-700" />
        <StatBox icon={UserCheck} label="Laki-laki" value={filtered.filter((s) => s.gender === 'L').length} color="bg-blue-50 border-blue-200 text-blue-700" />
        <StatBox icon={UserCheck} label="Perempuan" value={filtered.filter((s) => s.gender === 'P').length} color="bg-rose-50 border-rose-200 text-rose-700" />
        <StatBox icon={UserX} label="Santri Mahad" value={filtered.filter((s) => s.santri_mahad).length} color="bg-emerald-50 border-emerald-200 text-emerald-700" />
      </div>

      <Card>
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Cari nama atau NISN..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={tingkatFilter} onValueChange={setTingkatFilter}>
            <SelectTrigger><SelectValue placeholder="Filter Tingkat" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Tingkat</SelectItem>
              {tingkatOptions.map((g) => <SelectItem key={g} value={String(g)}>Kelas {g}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={genderFilter} onValueChange={setGenderFilter}>
            <SelectTrigger><SelectValue placeholder="Filter Jenis Kelamin" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              <SelectItem value="L">Laki-laki</SelectItem>
              <SelectItem value="P">Perempuan</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-[#006837]" />
              Memuat data siswa...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">NO</TableHead>
                    <TableHead>NAMA</TableHead>
                    <TableHead>NISN</TableHead>
                    <TableHead>L/P</TableHead>
                    <TableHead>KELAS</TableHead>
                    <TableHead>MAHAD</TableHead>
                    <TableHead>KAMAR</TableHead>
                    <TableHead>STATUS</TableHead>
                    <TableHead className="text-right">AKSI</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-12 text-slate-500">
                      <GraduationCap className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                      <div className="font-semibold">Tidak ada data siswa</div>
                    </TableCell></TableRow>
                  ) : (
                    filtered.map((s, i) => (
                      <TableRow key={s.id}>
                        <TableCell className="text-center text-slate-500 font-mono">{i + 1}</TableCell>
                        <TableCell className="font-semibold">{s.full_name}</TableCell>
                        <TableCell className="font-mono text-xs">{s.nisn || '-'}</TableCell>
                        <TableCell>
                          {s.gender === 'L' ? (
                            <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">L</Badge>
                          ) : s.gender === 'P' ? (
                            <Badge className="bg-rose-100 text-rose-700 border-rose-200 text-xs">P</Badge>
                          ) : <span className="text-slate-400 text-xs">-</span>}
                        </TableCell>
                        <TableCell>{s.class_name || '-'}</TableCell>
                        <TableCell>
                          {s.santri_mahad ? (
                            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">Santri</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-slate-500">Bukan</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{s.santri_mahad ? (s.kamar_mahad || '-') : '-'}</TableCell>
                        <TableCell>
                          {s.mutation_type === 'keluar' ? (
                            <Badge className="bg-rose-100 text-rose-700 border-rose-200 text-xs">Mutasi Keluar</Badge>
                          ) : s.is_active === false ? (
                            <Badge variant="outline" className="text-xs">Nonaktif</Badge>
                          ) : (
                            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">Aktif</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => setDetailStudent(s)}
                            className="gap-1 border-[#006837]/40 text-[#006837] hover:bg-[#006837]/5">
                            <Eye className="h-3.5 w-3.5" /> Detail
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {detailStudent && (
        <StudentDetailDialog
          student={detailStudent}
          open={!!detailStudent}
          onClose={() => setDetailStudent(null)}
        />
      )}
    </div>
  );
}

function StatBox({ icon: Icon, label, value, color }) {
  return (
    <div className={`rounded-xl border p-4 ${color}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide opacity-80">{label}</span>
        <Icon className="h-4 w-4 opacity-70" />
      </div>
      <div className="text-2xl font-extrabold tabular-nums mt-1">{value}</div>
    </div>
  );
}
