import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserCheck, Calendar, Download, Search, Filter } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export default function AdminLaporanAbsensiPage() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const { data } = await api.get('/users');
      // Filter hanya GTK (guru dan tenaga kependidikan)
      const gtkUsers = data.filter(u =>
        u.roles?.some(r => ['guru', 'wali_kelas', 'tenaga_kependidikan', 'guru_piket', 'guru_bk', 'guru_tata_tertib', 'guru_ekstrakurikuler'].includes(r))
      );
      setUsers(gtkUsers);
    } catch (e) {
      toast.error('Gagal memuat data GTK');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    toast.info('Fitur export sedang dalam pengembangan');
  };

  const filteredUsers = users.filter(u => {
    if (filterRole !== 'all' && !u.roles?.includes(filterRole)) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return u.full_name?.toLowerCase().includes(s) || u.nip_nuptk?.toLowerCase().includes(s);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <UserCheck className="h-3 w-3 mr-1" /> Laporan Absensi GTK
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Laporan Absensi GTK</h1>
          <p className="text-sm text-slate-600 mt-1">Rekap kehadiran guru dan tenaga kependidikan</p>
        </div>
        <Button onClick={handleExport} variant="outline" className="gap-2">
          <Download className="h-4 w-4" /> Export Excel
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Cari GTK</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Nama atau NIP..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Filter Peran</label>
              <Select value={filterRole} onValueChange={setFilterRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Peran</SelectItem>
                  <SelectItem value="guru">Guru</SelectItem>
                  <SelectItem value="wali_kelas">Wali Kelas</SelectItem>
                  <SelectItem value="tenaga_kependidikan">Tendik</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Dari Tanggal</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Sampai Tanggal</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>NIP/NUPTK</TableHead>
                  <TableHead>Peran</TableHead>
                  <TableHead className="text-center">Hadir</TableHead>
                  <TableHead className="text-center">Izin</TableHead>
                  <TableHead className="text-center">Sakit</TableHead>
                  <TableHead className="text-center">Alpha</TableHead>
                  <TableHead className="text-center">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                      {loading ? 'Memuat data...' : 'Tidak ada data GTK'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.full_name}</TableCell>
                      <TableCell className="font-mono text-xs">{user.nip_nuptk || '-'}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {user.roles?.filter(r => ['guru', 'wali_kelas', 'tenaga_kependidikan'].includes(r)).map(r => (
                            <Badge key={r} variant="outline" className="text-xs">
                              {r === 'guru' ? 'Guru' : r === 'wali_kelas' ? 'Wali Kelas' : 'Tendik'}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">-</TableCell>
                      <TableCell className="text-center">-</TableCell>
                      <TableCell className="text-center">-</TableCell>
                      <TableCell className="text-center">-</TableCell>
                      <TableCell className="text-center text-slate-500">-</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            <strong>Catatan:</strong> Fitur ini akan menampilkan rekap absensi GTK berdasarkan data jurnal mengajar dan kehadiran. Integrasi dengan sistem absensi sedang dalam pengembangan.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
