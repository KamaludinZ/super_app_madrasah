import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Users, Search, GraduationCap, Eye, KeyRound, Pencil, QrCode,
  UserCheck, UserX, ShieldAlert, History, Loader2, Hash, Trash2,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';
import StudentDetailDialog from '@/components/students/StudentDetailDialog';
import StudentAccountInfoDialog from '@/components/students/StudentAccountInfoDialog';

export default function DataSiswaPage() {
  const { activeRole, user } = useAuth();
  const isAdmin = activeRole === 'admin' || user?.roles?.includes('admin');
  const isWaliKelas = activeRole === 'wali_kelas' || user?.roles?.includes('wali_kelas');
  const canEdit = isAdmin || isWaliKelas;

  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('all');
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [genderFilter, setGenderFilter] = useState('all');

  const [detailStudent, setDetailStudent] = useState(null);
  const [accountStudent, setAccountStudent] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        if (isAdmin || isWaliKelas) {
          // Get active academic year first
          const ayRes = await api.get('/academic-years/active');
          const activeAY = ayRes.data;

          // Load classes for active academic year
          const c = await api.get('/classes', {
            params: activeAY ? { academic_year_id: activeAY.id } : {}
          });
          setClasses(c.data || []);
        }
        await loadStudents('all');
      } finally { setLoading(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, isWaliKelas]);

  const loadStudents = async (classId) => {
    setLoading(true);
    try {
      const params = {};
      if (classId && classId !== 'all') params.class_id = classId;
      const { data } = await api.get('/students', { params });
      setStudents(data || []);
    } catch (e) { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { loadStudents(selectedClass); }, [selectedClass]);

  const filtered = students.filter((s) => {
    if (search && !s.full_name?.toLowerCase().includes(search.toLowerCase()) && !s.nisn?.includes(search)) return false;
    if (genderFilter !== 'all' && s.gender !== genderFilter) return false;
    return true;
  });

  const refresh = () => loadStudents(selectedClass);

  const handleDelete = async (student) => {
    if (!window.confirm(`Hapus data siswa ${student.full_name} (${student.nisn || student.id})?`)) return;
    try {
      await api.delete(`/users/${student.id}`);
      toast.success('Data siswa berhasil dihapus');
      refresh();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menghapus data siswa');
    }
  };

  return (
    <div className="space-y-6" data-testid="data-siswa-page">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <Users className="h-3 w-3 mr-1" /> Data Siswa
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Daftar Siswa</h1>
          <p className="text-sm text-slate-600 mt-1">
            {isAdmin ? 'Semua siswa madrasah' : isWaliKelas ? 'Siswa di kelas Anda' : 'Siswa'}
          </p>
        </div>
      </div>

      {/* Stat overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatBox icon={Users} label="Total" value={filtered.length} color="bg-slate-50 border-slate-200 text-slate-700" />
        <StatBox icon={UserCheck} label="Laki-laki" value={filtered.filter((s) => s.gender === 'L').length} color="bg-blue-50 border-blue-200 text-blue-700" />
        <StatBox icon={UserCheck} label="Perempuan" value={filtered.filter((s) => s.gender === 'P').length} color="bg-rose-50 border-rose-200 text-rose-700" />
        <StatBox icon={UserX} label="Mutasi" value={filtered.filter((s) => s.mutation_type).length} color="bg-amber-50 border-amber-200 text-amber-700" />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Cari nama atau NISN..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="search-siswa" />
          </div>
          {(isAdmin || isWaliKelas) && (
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger data-testid="filter-kelas"><SelectValue placeholder="Filter Kelas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kelas</SelectItem>
                {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select value={genderFilter} onValueChange={setGenderFilter}>
            <SelectTrigger data-testid="filter-gender"><SelectValue placeholder="Filter Jenis Kelamin" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              <SelectItem value="L">Laki-laki</SelectItem>
              <SelectItem value="P">Perempuan</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-[#006837]" />
              Memuat data siswa...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table data-testid="siswa-table">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">NO</TableHead>
                    <TableHead>NAMA</TableHead>
                    <TableHead>NISN</TableHead>
                    <TableHead>L/P</TableHead>
                    <TableHead>KELAS</TableHead>
                    <TableHead>STATUS</TableHead>
                    <TableHead className="text-right">AKSI</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s, i) => (
                    <TableRow key={s.id} data-testid={`siswa-row-${s.id}`}>
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
                        {s.mutation_type === 'keluar' ? (
                          <Badge className="bg-rose-100 text-rose-700 border-rose-200 text-xs">Mutasi Keluar</Badge>
                        ) : s.mutation_type === 'masuk' ? (
                          <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">Mutasi Masuk</Badge>
                        ) : s.is_active === false ? (
                          <Badge variant="outline" className="text-xs">Nonaktif</Badge>
                        ) : (
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">Aktif</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" onClick={() => setDetailStudent(s)}
                            className="gap-1 border-[#006837]/40 text-[#006837] hover:bg-[#006837]/5"
                            data-testid={`detail-${s.id}`}>
                            <Eye className="h-3.5 w-3.5" /> Detail
                          </Button>
                          {canEdit && (
                            <Button size="sm" variant="outline" onClick={() => setAccountStudent(s)}
                              className="gap-1"
                              data-testid={`info-akun-${s.id}`}>
                              <KeyRound className="h-3.5 w-3.5" /> Info Akun
                            </Button>
                          )}
                          {canEdit && (
                            <Button size="sm" variant="ghost" onClick={() => setDetailStudent({ ...s, _autoEdit: true })}
                              className="gap-1 text-amber-700 hover:bg-amber-50"
                              data-testid={`edit-${s.id}`}>
                              <Pencil className="h-3.5 w-3.5" /> Edit
                            </Button>
                          )}
                          {canEdit && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(s)}
                              className="gap-1 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                              data-testid={`delete-${s.id}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Hapus
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center py-12 text-slate-500">
                      <GraduationCap className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                      <div className="font-semibold">Tidak ada data siswa</div>
                    </TableCell></TableRow>
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
          autoEdit={detailStudent._autoEdit}
          open={!!detailStudent}
          onClose={() => { setDetailStudent(null); refresh(); }}
        />
      )}

      {accountStudent && (
        <StudentAccountInfoDialog
          student={accountStudent}
          open={!!accountStudent}
          onClose={() => { setAccountStudent(null); refresh(); }}
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
