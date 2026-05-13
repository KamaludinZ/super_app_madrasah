import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Users, Search, BookOpen, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';

export default function DataSiswaPage() {
  const { activeRole, user } = useAuth();
  const isAdmin = activeRole === 'admin' || user?.roles?.includes('admin');
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('all');
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [genderFilter, setGenderFilter] = useState('all');

  useEffect(() => {
    (async () => {
      try {
        if (isAdmin) {
          const c = await api.get('/classes');
          setClasses(c.data);
        }
        await loadStudents('all');
      } finally { setLoading(false); }
    })();
  }, [isAdmin]);

  const loadStudents = async (classId) => {
    setLoading(true);
    try {
      const params = {};
      if (classId && classId !== 'all') params.class_id = classId;
      const { data } = await api.get('/students', { params });
      setStudents(data);
    } catch (e) { /* */ }
    finally { setLoading(false); }
  };

  useEffect(() => { loadStudents(selectedClass); }, [selectedClass]);

  const filtered = students.filter((s) => {
    if (search && !s.full_name?.toLowerCase().includes(search.toLowerCase()) && !s.nisn?.includes(search)) return false;
    if (genderFilter !== 'all' && s.gender !== genderFilter) return false;
    return true;
  });

  // Group by class for admin view
  const grouped = filtered.reduce((acc, s) => {
    const key = s.class_name || 'Belum Ditugaskan';
    (acc[key] = acc[key] || []).push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2"><Users className="h-3 w-3 mr-1" /> Data Siswa</Badge>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Data Siswa</h1>
        <p className="text-sm text-slate-600 mt-1">Total {students.length} siswa{!isAdmin ? ' di kelas Anda' : ''}</p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input placeholder="Cari nama atau NISN..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="siswa-search" />
            </div>
            {isAdmin && (
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger data-testid="siswa-class-filter"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kelas</SelectItem>
                  {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Select value={genderFilter} onValueChange={setGenderFilter}>
              <SelectTrigger data-testid="siswa-gender-filter"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Jenis Kelamin</SelectItem>
                <SelectItem value="L">Laki-laki (L)</SelectItem>
                <SelectItem value="P">Perempuan (P)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> :
        filtered.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-slate-500">
            <Users className="h-10 w-10 mx-auto opacity-40 mb-2" />
            <div>Tidak ada siswa ditemukan</div>
          </CardContent></Card>
        ) : (
          Object.entries(grouped).map(([className, list]) => (
            <Card key={className}>
              <CardContent className="p-5">
                <h2 className="text-base font-semibold mb-3 flex items-center gap-2"><BookOpen className="h-4 w-4 text-[#006837]" /> {className} <Badge variant="outline" className="ml-1">{list.length} siswa</Badge></h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2" data-testid={`student-group-${className}`}>
                  {list.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 bg-white hover:shadow-sm transition-shadow">
                      <Avatar className="h-10 w-10"><AvatarFallback className="bg-[#006837] text-white text-xs font-semibold">{s.full_name?.substring(0,2).toUpperCase()}</AvatarFallback></Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold truncate">{s.full_name}</div>
                        <div className="text-xs text-slate-500 font-mono">{s.nisn || '-'}</div>
                      </div>
                      {s.gender && <Badge variant="outline" className="text-xs">{s.gender}</Badge>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
    </div>
  );
}
