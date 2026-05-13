import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  ArrowRightLeft, UserPlus, UserMinus, Users, Briefcase,
  Calendar, Hash, FileText, ExternalLink, Loader2, GraduationCap,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';

const TABS = [
  { value: 'siswa_masuk', label: 'Siswa Masuk', icon: UserPlus, role_group: 'siswa', mutation_type: 'masuk', color: 'text-blue-700' },
  { value: 'siswa_keluar', label: 'Siswa Keluar', icon: UserMinus, role_group: 'siswa', mutation_type: 'keluar', color: 'text-rose-700' },
  { value: 'staff_masuk', label: 'Guru/Tendik Masuk', icon: UserPlus, role_group: 'staff', mutation_type: 'masuk', color: 'text-emerald-700' },
  { value: 'staff_keluar', label: 'Guru/Tendik Keluar', icon: UserMinus, role_group: 'staff', mutation_type: 'keluar', color: 'text-amber-700' },
];

export default function AdminMutationsPage() {
  const [tab, setTab] = useState('siswa_masuk');
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const [activeAY, setActiveAY] = useState(null);

  useEffect(() => {
    api.get('/academic-years/active').then(({ data }) => setActiveAY(data)).catch(() => {});
  }, []);

  useEffect(() => {
    const cur = TABS.find((t) => t.value === tab);
    if (!cur) return;
    setLoading(true);
    api.get('/admin/mutations', { params: { mutation_type: cur.mutation_type, role_group: cur.role_group } })
      .then(({ data: rows }) => setData((prev) => ({ ...prev, [tab]: rows })))
      .catch(() => setData((prev) => ({ ...prev, [tab]: [] })))
      .finally(() => setLoading(false));
  }, [tab]);

  const counts = TABS.reduce((acc, t) => {
    acc[t.value] = data[t.value]?.length || 0;
    return acc;
  }, {});

  return (
    <div className="space-y-6" data-testid="admin-mutations-page">
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
          <ArrowRightLeft className="h-3 w-3 mr-1" /> Data Mutasi
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Data Mutasi</h1>
        <p className="text-sm text-slate-600 mt-1">
          Daftar mutasi siswa dan staff pada Tahun Pelajaran <span className="font-mono font-semibold">{activeAY?.name || '-'}</span>
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {TABS.map((t) => (
          <button key={t.value} onClick={() => setTab(t.value)}
            className={`rounded-xl border p-4 text-left transition-all ${tab === t.value ? 'border-[#006837] bg-[#006837]/5 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}
            data-testid={`stat-card-${t.value}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">{t.label}</span>
              <t.icon className={`h-4 w-4 ${t.color}`} />
            </div>
            <div className="text-3xl font-extrabold tabular-nums text-slate-900">{counts[t.value] || 0}</div>
            <div className="text-xs text-slate-500 mt-0.5">{t.role_group === 'siswa' ? 'siswa' : 'staff'}</div>
          </button>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="overflow-x-auto">
          <TabsList className="bg-white border border-slate-200 inline-flex min-w-full sm:min-w-0" data-testid="mutations-tabs">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="gap-2 whitespace-nowrap" data-testid={`tab-${t.value}`}>
                <t.icon className={`h-3.5 w-3.5 ${t.color}`} />
                {t.label}
                {counts[t.value] > 0 && <Badge variant="secondary" className="ml-1.5 px-1.5 text-xs">{counts[t.value]}</Badge>}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {TABS.map((t) => (
          <TabsContent key={t.value} value={t.value} className="mt-4">
            <Card>
              <CardContent className="p-0">
                {loading && tab === t.value ? (
                  <div className="p-12 text-center text-slate-500">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-[#006837]" />
                    Memuat data mutasi...
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table data-testid={`mutations-table-${t.value}`}>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12 text-center">NO</TableHead>
                          <TableHead>NAMA</TableHead>
                          {t.role_group === 'siswa' ? (
                            <>
                              <TableHead>NISN</TableHead>
                              <TableHead>KELAS</TableHead>
                            </>
                          ) : (
                            <>
                              <TableHead>NIP/NUPTK</TableHead>
                              <TableHead>PERAN</TableHead>
                            </>
                          )}
                          <TableHead>TANGGAL</TableHead>
                          <TableHead>KETERANGAN</TableHead>
                          <TableHead className="text-right">AKSI</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(data[t.value] || []).map((u, i) => (
                          <TableRow key={u.id} data-testid={`mutation-row-${u.id}`}>
                            <TableCell className="text-center text-slate-500 font-mono">{i + 1}</TableCell>
                            <TableCell className="font-semibold">{u.full_name}</TableCell>
                            {t.role_group === 'siswa' ? (
                              <>
                                <TableCell className="font-mono text-xs">{u.nisn || '-'}</TableCell>
                                <TableCell>{u.class_name || '-'}</TableCell>
                              </>
                            ) : (
                              <>
                                <TableCell className="font-mono text-xs">{u.nip_nuptk || '-'}</TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-1">
                                    {(u.roles || []).filter((r) => r !== 'siswa').map((r) => (
                                      <Badge key={r} variant="outline" className="text-xs">{r}</Badge>
                                    ))}
                                  </div>
                                </TableCell>
                              </>
                            )}
                            <TableCell className="font-mono text-sm">{u.mutation_date || '-'}</TableCell>
                            <TableCell className="text-xs max-w-xs">{u.mutation_note || <span className="text-slate-400 italic">-</span>}</TableCell>
                            <TableCell className="text-right">
                              <Link to={`/admin/users?focus=${u.id}`}>
                                <Button size="sm" variant="outline" className="gap-1" data-testid={`view-user-${u.id}`}>
                                  <ExternalLink className="h-3 w-3" /> Lihat
                                </Button>
                              </Link>
                            </TableCell>
                          </TableRow>
                        ))}
                        {(!data[t.value] || data[t.value].length === 0) && !loading && (
                          <TableRow><TableCell colSpan={7} className="text-center py-12 text-slate-500">
                            <ArrowRightLeft className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                            <div className="font-semibold">Belum ada data mutasi</div>
                            <div className="text-sm mt-1">Tandai mutasi siswa/staff via halaman <Link to="/admin/users" className="text-[#006837] underline">Data Pengguna</Link></div>
                          </TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
