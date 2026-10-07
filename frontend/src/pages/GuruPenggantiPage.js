import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserRoundCog, Plus, Search, Trash2, ArrowRight, CalendarCheck, CalendarRange, ClipboardCheck, CalendarDays } from 'lucide-react';
import { DAY_LABELS, STATUS_COLORS } from '@/lib/api';
import { toast } from 'sonner';
import { confirmDialog } from '@/components/ui/confirm-dialog';
import { apiErrorMessage, cancelAssignment, listAssignments } from '@/lib/guruPenggantiSchedule';
import { Link, useNavigate } from 'react-router-dom';
import GuruPenggantiGuard from '@/components/guru-pengganti/GuruPenggantiGuard';
import { toLocalIso, parseLocalIso } from '@/lib/guruPengganti';

const JOURNAL_STATUS_LABELS = {
  filled: 'Jurnal terisi',
  pending: 'Belum diisi',
  missing: 'Terlewat',
};

const formatDate = (iso) =>
  parseLocalIso(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

export default function GuruPenggantiPage() {
  return (
    <GuruPenggantiGuard>
      <GuruPenggantiContent />
    </GuruPenggantiGuard>
  );
}

function GuruPenggantiContent() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [range, setRange] = useState('upcoming');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      setItems(await listAssignments({ status: 'active' }));
    } catch (e) {
      setLoadError(apiErrorMessage(e, 'Gagal memuat daftar penugasan'));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  const [query, setQuery] = useState('');

  const today = toLocalIso();

  const stats = useMemo(() => ({
    today: items.filter((a) => a.date === today).length,
    upcoming: items.filter((a) => a.date >= today).length,
    filled: items.filter((a) => a.journal_status === 'filled').length,
  }), [items, today]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((a) => {
        if (range === 'today') return a.date === today;
        if (range === 'upcoming') return a.date >= today;
        if (range === 'past') return a.date < today;
        return true;
      })
      .filter((a) => !q || [a.original_teacher_name, a.substitute_teacher_name, a.class_name, a.subject_name]
        .some((v) => (v || '').toLowerCase().includes(q)))
      .sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time));
  }, [items, range, query, today]);

  const navigate = useNavigate();
  const handleCreate = () => navigate('/guru-pengganti/tugaskan');

  const handleDelete = async (a) => {
    if (!(await confirmDialog(`Batalkan penugasan ${a.substitute_teacher_name} untuk ${a.class_name} (${formatDate(a.date)})?`))) return;
    try {
      await cancelAssignment(a.id);
      setItems((prev) => prev.filter((x) => x.id !== a.id));
      toast.success('Penugasan dibatalkan');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Gagal membatalkan penugasan'));
    }
  };

  return (
    <div className="space-y-6" data-testid="guru-pengganti-page">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <UserRoundCog className="h-3 w-3 mr-1" /> Guru Pengganti
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Penugasan Guru Pengganti</h1>
          <p className="text-sm text-slate-600 mt-1">
            Tugaskan guru lain untuk mengisi jurnal pada slot jadwal guru yang berhalangan.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => navigate('/guru-pengganti/kalender')} className="gap-2" data-testid="gp-open-calendar">
            <CalendarDays className="h-4 w-4" /> Kalender
          </Button>
          <Button onClick={handleCreate} className="bg-[#006837] hover:bg-[#0B7A3B] gap-2" data-testid="add-guru-pengganti-button">
            <Plus className="h-4 w-4" /> Tugaskan Guru Pengganti
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Penugasan hari ini', value: stats.today, icon: CalendarCheck },
          { label: 'Penugasan mendatang', value: stats.upcoming, icon: CalendarRange },
          { label: 'Jurnal sudah diisi pengganti', value: stats.filled, icon: ClipboardCheck },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-[#006837]/10 text-[#006837] flex items-center justify-center shrink-0">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900 leading-none">{value}</div>
                <div className="text-xs text-slate-500 mt-1">{label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <Tabs value={range} onValueChange={setRange}>
              <TabsList>
                <TabsTrigger value="today" data-testid="gp-tab-today">Hari Ini</TabsTrigger>
                <TabsTrigger value="upcoming" data-testid="gp-tab-upcoming">Mendatang</TabsTrigger>
                <TabsTrigger value="past" data-testid="gp-tab-past">Riwayat</TabsTrigger>
                <TabsTrigger value="all" data-testid="gp-tab-all">Semua</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative w-full sm:w-64">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari guru, kelas, mapel..."
                className="pl-9"
                data-testid="gp-search"
              />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-10 text-sm text-slate-500" data-testid="gp-loading">Memuat penugasan...</div>
          ) : loadError ? (
            <div className="text-center py-10 text-sm text-rose-600" data-testid="gp-load-error">
              {loadError}{' '}
              <Button variant="link" className="px-1" onClick={load}>Coba lagi</Button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-sm text-slate-400 italic" data-testid="gp-empty">
              Belum ada penugasan guru pengganti pada rentang ini.
            </div>
          ) : (
            <>
              {/* Desktop: tabel */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Jam</TableHead>
                      <TableHead>Kelas / Mapel</TableHead>
                      <TableHead>Guru Digantikan → Pengganti</TableHead>
                      <TableHead>Jurnal</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((a) => (
                      <TableRow key={a.id} data-testid={`gp-row-${a.id}`}>
                        <TableCell>
                          <div className="font-medium">{formatDate(a.date)}</div>
                          <div className="text-xs text-slate-500">{DAY_LABELS[a.day]}</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">Jam ke-{a.jam_ke}</div>
                          <div className="font-mono text-xs text-slate-500">{a.start_time}-{a.end_time}</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{a.class_name}</div>
                          <div className="text-xs text-slate-500">{a.subject_name}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-slate-500 line-through decoration-slate-300">{a.original_teacher_name}</span>
                            <ArrowRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span className="font-semibold text-slate-900">{a.substitute_teacher_name}</span>
                          </div>
                          <div className="text-xs text-slate-500">{a.reason || 'Tanpa alasan'} · ditugaskan oleh {a.assigned_by_name || '-'}</div>
                        </TableCell>
                        <TableCell>
                          <Link to={`/guru-pengganti/jurnal/${a.id}`} title="Lihat jurnal berdampingan" data-testid={`gp-journals-${a.id}`}>
                            <Badge className={`text-[10px] hover:underline ${STATUS_COLORS[a.journal_status]}`}>
                              {JOURNAL_STATUS_LABELS[a.journal_status]}
                            </Badge>
                          </Link>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                            onClick={() => handleDelete(a)}
                            data-testid={`gp-delete-${a.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile: kartu */}
              <div className="md:hidden space-y-3">
                {filtered.map((a) => (
                  <div key={a.id} className="rounded-lg border border-slate-200 p-3 bg-white" data-testid={`gp-card-${a.id}`}>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="text-sm font-semibold">
                        {DAY_LABELS[a.day]}, {formatDate(a.date)}
                      </div>
                      <Link to={`/guru-pengganti/jurnal/${a.id}`} title="Lihat jurnal berdampingan">
                        <Badge className={`text-[10px] ${STATUS_COLORS[a.journal_status]}`}>
                          {JOURNAL_STATUS_LABELS[a.journal_status]}
                        </Badge>
                      </Link>
                    </div>
                    <div className="text-xs text-slate-500 mb-2">
                      Jam ke-{a.jam_ke} · <span className="font-mono">{a.start_time}-{a.end_time}</span> · {a.class_name} · {a.subject_name}
                    </div>
                    <div className="text-sm">
                      <div className="text-slate-500 line-through decoration-slate-300">{a.original_teacher_name}</div>
                      <div className="flex items-center gap-1 font-semibold text-slate-900">
                        <ArrowRight className="h-3.5 w-3.5 text-slate-400" /> {a.substitute_teacher_name}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="text-[11px] text-slate-500">{a.reason || 'Tanpa alasan'} · oleh {a.assigned_by_name || '-'}</div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 h-8"
                        onClick={() => handleDelete(a)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
