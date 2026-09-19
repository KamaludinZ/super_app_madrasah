import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Loader2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export default function UnitPelayananKelasPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSemester, setActiveSemester] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [c, sems] = await Promise.all([
          api.get('/classes'),
          api.get('/semesters'),
        ]);
        setItems(c.data || []);
        setActiveSemester((sems.data || []).find((s) => s.is_active));
      } catch (e) {
        toast.error('Gagal memuat data kelas');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2"><BookOpen className="h-3 w-3 mr-1" /> Data Kelas</Badge>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Data Kelas</h1>
        <p className="text-sm text-slate-600 mt-1">{items.length} kelas • Semester {activeSemester?.name || '-'}</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-[#006837]" />
              Memuat data kelas...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Tingkat</TableHead>
                    <TableHead>Tahun Pelajaran</TableHead>
                    <TableHead>Peserta</TableHead>
                    <TableHead>Kurikulum</TableHead>
                    <TableHead>Semester</TableHead>
                    <TableHead>Wali Kelas</TableHead>
                    <TableHead>Ruang</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-12 text-slate-500">
                      <BookOpen className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                      <div className="font-semibold">Tidak ada data kelas</div>
                    </TableCell></TableRow>
                  ) : (
                    items.map((c) => {
                      const cap = c.capacity || 40;
                      const cnt = c.student_count || 0;
                      const ratio = cap > 0 ? cnt / cap : 0;
                      const barColor = ratio >= 1 ? 'bg-rose-500' : ratio >= 0.85 ? 'bg-amber-500' : 'bg-emerald-500';
                      return (
                        <TableRow key={c.id}>
                          <TableCell className="font-semibold">{c.name}</TableCell>
                          <TableCell>{c.grade}</TableCell>
                          <TableCell className="text-xs">
                            {c.academic_year_name ? (
                              <Badge variant="outline" className="font-mono text-[10px]">{c.academic_year_name}</Badge>
                            ) : <span className="text-slate-400">-</span>}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className={`font-mono font-semibold text-sm ${ratio >= 1 ? 'text-rose-600' : 'text-slate-900'}`}>
                                {cnt}/{cap}
                              </span>
                              <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden hidden sm:block">
                                <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">
                            {c.curriculum_name ? (
                              <span title={c.curriculum_name}>
                                <Badge variant="outline" className="font-mono text-[10px]">{c.curriculum_code || '?'}</Badge>
                              </span>
                            ) : <span className="text-slate-400">-</span>}
                          </TableCell>
                          <TableCell className="text-xs capitalize">
                            {c.semester_name ? (
                              <Badge variant="secondary" className="bg-amber-100 text-amber-800 capitalize">
                                {c.semester_name} ({c.semester_code || ''})
                              </Badge>
                            ) : <span className="text-slate-400">-</span>}
                          </TableCell>
                          <TableCell className="text-sm">{c.homeroom_teacher_name || '-'}</TableCell>
                          <TableCell className="text-sm font-mono">{c.room_name || '-'}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
