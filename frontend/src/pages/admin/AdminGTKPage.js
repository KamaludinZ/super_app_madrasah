import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Users, Search, Briefcase, GraduationCap, Eye, KeyRound, Pencil, Loader2,
  UserCheck, UserMinus,
} from 'lucide-react';
import { api, ROLE_LABELS } from '@/lib/api';
import StaffDetailDialog from '@/components/staff/StaffDetailDialog';
import StudentAccountInfoDialog from '@/components/students/StudentAccountInfoDialog';

const GURU_ROLES = ['guru', 'wali_kelas', 'guru_piket', 'guru_bk', 'guru_tata_tertib', 'guru_ekstrakurikuler'];
const TENDIK_ROLES = ['tenaga_kependidikan'];

export default function AdminGTKPage() {
  const [tab, setTab] = useState('guru');
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [detailUser, setDetailUser] = useState(null);
  const [accountUser, setAccountUser] = useState(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/users');
      setUsers(data || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, []);

  const filtered = users.filter((u) => {
    const roles = u.roles || [];
    const isGuru = roles.some((r) => GURU_ROLES.includes(r));
    const isTendik = roles.some((r) => TENDIK_ROLES.includes(r)) && !isGuru;
    if (tab === 'guru' && !isGuru) return false;
    if (tab === 'tendik' && !isTendik) return false;
    if (roleFilter !== 'all' && !roles.includes(roleFilter)) return false;
    if (search) {
      const s = search.toLowerCase();
      return (u.full_name || '').toLowerCase().includes(s) ||
             (u.nip_nuptk || '').includes(search) ||
             (u.username || '').toLowerCase().includes(s);
    }
    return true;
  });

  const counts = {
    guru: users.filter((u) => (u.roles || []).some((r) => GURU_ROLES.includes(r))).length,
    tendik: users.filter((u) => (u.roles || []).some((r) => TENDIK_ROLES.includes(r)) && !(u.roles || []).some((r) => GURU_ROLES.includes(r))).length,
  };

  return (
    <div className="space-y-6" data-testid="admin-gtk-page">
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
          <Briefcase className="h-3 w-3 mr-1" /> Data GTK
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Data Guru & Tenaga Kependidikan</h1>
        <p className="text-sm text-slate-600 mt-1">Biodata lengkap GTK madrasah</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => setTab('guru')}
          className={`rounded-xl border p-4 text-left transition-all ${tab === 'guru' ? 'border-[#006837] bg-[#006837]/5 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}
          data-testid="card-guru">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Guru</span>
            <GraduationCap className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-extrabold tabular-nums text-slate-900">{counts.guru}</div>
          <div className="text-xs text-slate-500 mt-0.5">guru mata pelajaran / khusus</div>
        </button>
        <button onClick={() => setTab('tendik')}
          className={`rounded-xl border p-4 text-left transition-all ${tab === 'tendik' ? 'border-[#006837] bg-[#006837]/5 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}
          data-testid="card-tendik">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Tenaga Kependidikan</span>
            <Briefcase className="h-4 w-4 text-purple-600" />
          </div>
          <div className="text-3xl font-extrabold tabular-nums text-slate-900">{counts.tendik}</div>
          <div className="text-xs text-slate-500 mt-0.5">staf TU, perpustakaan, dll</div>
        </button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-white border border-slate-200" data-testid="gtk-tabs">
          <TabsTrigger value="guru" data-testid="tab-guru">Guru ({counts.guru})</TabsTrigger>
          <TabsTrigger value="tendik" data-testid="tab-tendik">Tenaga Kependidikan ({counts.tendik})</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4 space-y-4">
          <Card>
            <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input placeholder="Cari nama, NIP/NUPTK..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="search-gtk" />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger data-testid="filter-role"><SelectValue placeholder="Filter Peran" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Peran</SelectItem>
                  {(tab === 'guru' ? GURU_ROLES : TENDIK_ROLES).map((r) => (
                    <SelectItem key={r} value={r}>{ROLE_LABELS[r] || r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-12 text-center text-slate-500">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-[#006837]" />
                  Memuat data GTK...
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table data-testid="gtk-table">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12 text-center">NO</TableHead>
                        <TableHead>NAMA</TableHead>
                        <TableHead>NIP/NUPTK</TableHead>
                        <TableHead>L/P</TableHead>
                        <TableHead>PERAN</TableHead>
                        <TableHead>STATUS</TableHead>
                        <TableHead className="text-right">AKSI</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((u, i) => (
                        <TableRow key={u.id} data-testid={`gtk-row-${u.id}`}>
                          <TableCell className="text-center text-slate-500 font-mono">{i + 1}</TableCell>
                          <TableCell className="font-semibold">{u.full_name}</TableCell>
                          <TableCell className="font-mono text-xs">{u.nip_nuptk || '-'}</TableCell>
                          <TableCell>
                            {u.gender === 'L' ? <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">L</Badge> :
                             u.gender === 'P' ? <Badge className="bg-rose-100 text-rose-700 border-rose-200 text-xs">P</Badge> :
                             <span className="text-slate-400 text-xs">-</span>}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {(u.roles || []).filter((r) => r !== 'siswa').slice(0, 3).map((r) => (
                                <Badge key={r} variant="outline" className="text-xs">{ROLE_LABELS[r] || r}</Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            {u.mutation_type === 'keluar' ? <Badge className="bg-rose-100 text-rose-700 border-rose-200 text-xs">Mutasi Keluar</Badge> :
                             u.mutation_type === 'masuk' ? <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">Mutasi Masuk</Badge> :
                             u.is_active !== false ? <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">Aktif</Badge> :
                             <Badge variant="outline" className="text-xs">Nonaktif</Badge>}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="outline" onClick={() => setDetailUser(u)}
                                className="gap-1 border-[#006837]/40 text-[#006837] hover:bg-[#006837]/5"
                                data-testid={`gtk-detail-${u.id}`}>
                                <Eye className="h-3.5 w-3.5" /> Detail
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setAccountUser(u)}
                                className="gap-1" data-testid={`gtk-account-${u.id}`}>
                                <KeyRound className="h-3.5 w-3.5" /> Info Akun
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setDetailUser({ ...u, _autoEdit: true })}
                                className="gap-1 text-amber-700 hover:bg-amber-50" data-testid={`gtk-edit-${u.id}`}>
                                <Pencil className="h-3.5 w-3.5" /> Edit
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filtered.length === 0 && (
                        <TableRow><TableCell colSpan={7} className="text-center py-12 text-slate-500">
                          <Briefcase className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                          <div className="font-semibold">Tidak ada data GTK</div>
                        </TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {detailUser && (
        <StaffDetailDialog
          user={detailUser}
          autoEdit={detailUser._autoEdit}
          open={!!detailUser}
          onClose={() => { setDetailUser(null); refresh(); }}
        />
      )}
      {accountUser && (
        <StudentAccountInfoDialog
          student={accountUser}
          open={!!accountUser}
          onClose={() => { setAccountUser(null); refresh(); }}
          isGTK={true}
        />
      )}
    </div>
  );
}
