import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Trophy, Plus, Pencil, Trash2, CheckCircle2, Clock, Search, Upload,
  Medal, Image as ImageIcon, Award, Calendar, MapPin, Building, X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';

const CATEGORIES = [
  { value: 'akademik', label: 'Akademik', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { value: 'non_akademik', label: 'Non-Akademik', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  { value: 'olahraga', label: 'Olahraga', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { value: 'seni', label: 'Seni & Budaya', color: 'bg-rose-100 text-rose-800 border-rose-200' },
  { value: 'keagamaan', label: 'Keagamaan', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 'lainnya', label: 'Lainnya', color: 'bg-slate-100 text-slate-800 border-slate-200' },
];

const LEVELS = [
  { value: 'sekolah', label: 'Sekolah/Madrasah' },
  { value: 'kecamatan', label: 'Kecamatan' },
  { value: 'kota', label: 'Kota/Kabupaten' },
  { value: 'provinsi', label: 'Provinsi' },
  { value: 'nasional', label: 'Nasional' },
  { value: 'internasional', label: 'Internasional' },
];

const RANKS = [
  'Juara 1', 'Juara 2', 'Juara 3',
  'Juara Harapan 1', 'Juara Harapan 2', 'Juara Harapan 3',
  'Finalis', 'Peserta Terbaik', 'Medali Emas', 'Medali Perak', 'Medali Perunggu',
];

const EMPTY = {
  name: '', category: 'akademik', level: 'kota', rank: 'Juara 1',
  organizer: '', date: '', description: '', certificate_url: '',
  student_id: '',
};

function catColor(cat) {
  return CATEGORIES.find((c) => c.value === cat)?.color || 'bg-slate-100 text-slate-800 border-slate-200';
}
function catLabel(cat) {
  return CATEGORIES.find((c) => c.value === cat)?.label || cat || '-';
}
function levelLabel(l) {
  return LEVELS.find((x) => x.value === l)?.label || l || '-';
}

export default function AchievementsPage() {
  const { activeRole, user } = useAuth();
  const isAdmin = activeRole === 'admin';
  const isWaliKelas = activeRole === 'wali_kelas';
  const isSiswa = activeRole === 'siswa';
  const canVerify = isAdmin || isWaliKelas;

  const [items, setItems] = useState([]);
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState(canVerify ? 'pending' : 'mine');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const { data } = await api.get('/achievements');
      setItems(data || []);
    } catch (e) {
      toast.error('Gagal memuat data prestasi');
    }
  };

  useEffect(() => {
    (async () => {
      try {
        await refresh();
        if (canVerify) {
          const { data } = await api.get('/users', { params: { role: 'siswa' } });
          setStudents(data || []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [activeRole]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY, student_id: isSiswa ? user?.id : '' });
    setOpen(true);
  };

  const openEdit = (a) => {
    setEditing(a);
    setForm({ ...EMPTY, ...a, date: a.date || '' });
    setOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.date) {
      toast.error('Nama prestasi dan tanggal wajib diisi');
      return;
    }
    if (canVerify && !form.student_id) {
      toast.error('Pilih siswa');
      return;
    }
    try {
      if (editing) {
        await api.put(`/achievements/${editing.id}`, form);
        toast.success('Prestasi diperbarui');
      } else {
        const payload = isSiswa ? { ...form, student_id: user.id } : form;
        await api.post('/achievements', payload);
        toast.success('Prestasi disimpan');
      }
      setOpen(false);
      await refresh();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menyimpan');
    }
  };

  const handleVerify = async (a) => {
    try {
      await api.put(`/achievements/${a.id}/verify`, {});
      toast.success(`Prestasi "${a.name}" diverifikasi`);
      await refresh();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal verifikasi');
    }
  };

  const handleDelete = async (a) => {
    if (!window.confirm(`Hapus prestasi "${a.name}"?`)) return;
    try {
      await api.delete(`/achievements/${a.id}`);
      toast.success('Prestasi dihapus');
      await refresh();
    } catch (e) {
      toast.error('Gagal hapus');
    }
  };

  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) {
      toast.error('Maks 2MB. Sertifikat sebaiknya gambar.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm({ ...form, certificate_url: reader.result });
    reader.readAsDataURL(f);
  };

  const filtered = items.filter((a) => {
    if (tab === 'mine' && a.student_id !== user?.id) return false;
    if (tab === 'pending' && a.is_verified) return false;
    if (tab === 'verified' && !a.is_verified) return false;
    if (search) {
      const s = search.toLowerCase();
      return (a.name || '').toLowerCase().includes(s) ||
             (a.student_name || '').toLowerCase().includes(s) ||
             (a.organizer || '').toLowerCase().includes(s);
    }
    return true;
  });

  const stats = {
    total: items.length,
    pending: items.filter((a) => !a.is_verified).length,
    verified: items.filter((a) => a.is_verified).length,
    mine: items.filter((a) => a.student_id === user?.id).length,
  };

  if (loading) return <div className="text-sm text-slate-500">Memuat...</div>;

  return (
    <div className="space-y-6" data-testid="achievements-page">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <Trophy className="h-3 w-3 mr-1" /> Prestasi Siswa
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
            {isSiswa ? 'Prestasi Saya' : 'Portofolio Prestasi Siswa'}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            {isSiswa ? 'Catat semua prestasi yang pernah kamu raih' : 'Kelola dan verifikasi prestasi yang diraih siswa'}
          </p>
        </div>
        {(isSiswa || isAdmin) && (
          <Button onClick={openCreate} className="bg-[#006837] hover:bg-[#0B7A3B] gap-2" data-testid="add-achievement-button">
            <Plus className="h-4 w-4" /> {isSiswa ? 'Tambah Prestasi' : 'Tambah'}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={Trophy} label="Total" value={stats.total} color="bg-slate-100 text-slate-700" />
        <StatCard icon={Clock} label="Belum Verifikasi" value={stats.pending} color="bg-amber-100 text-amber-700" />
        <StatCard icon={CheckCircle2} label="Terverifikasi" value={stats.verified} color="bg-emerald-100 text-emerald-700" />
        {isSiswa && <StatCard icon={Medal} label="Prestasi Saya" value={stats.mine} color="bg-[#006837]/10 text-[#006837]" />}
        {canVerify && <StatCard icon={Award} label="Galeri" value={stats.verified} color="bg-[#006837]/10 text-[#006837]" />}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-white border border-slate-200" data-testid="achievement-tabs">
          {isSiswa && <TabsTrigger value="mine" data-testid="tab-mine">Prestasi Saya</TabsTrigger>}
          {canVerify && <TabsTrigger value="pending" data-testid="tab-pending">Belum Diverifikasi <Badge className="ml-2 px-1.5 py-0 text-xs bg-amber-100 text-amber-800 border-amber-200">{stats.pending}</Badge></TabsTrigger>}
          {canVerify && <TabsTrigger value="verified" data-testid="tab-verified">Terverifikasi <Badge className="ml-2 px-1.5 py-0 text-xs bg-emerald-100 text-emerald-800 border-emerald-200">{stats.verified}</Badge></TabsTrigger>}
          <TabsTrigger value="gallery" data-testid="tab-gallery">Galeri</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="p-4 border-b border-slate-100 flex items-center gap-2">
                <Search className="h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Cari nama prestasi, siswa, atau penyelenggara..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="max-w-md"
                  data-testid="achievement-search"
                />
              </div>

              {tab === 'gallery' ? (
                <div className="p-4">
                  {filtered.filter((a) => a.is_verified).length === 0 ? (
                    <EmptyState icon={Award} title="Belum ada prestasi terverifikasi" subtitle="Galeri akan terisi setelah Wali Kelas/Admin memverifikasi prestasi." />
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filtered.filter((a) => a.is_verified).map((a) => (
                        <GalleryCard key={a.id} a={a} onClick={() => setDetail(a)} />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table data-testid="achievement-table">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Prestasi</TableHead>
                        {!isSiswa && <TableHead>Siswa</TableHead>}
                        <TableHead>Kategori</TableHead>
                        <TableHead>Tingkat</TableHead>
                        <TableHead>Peringkat</TableHead>
                        <TableHead>Tanggal</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((a) => (
                        <TableRow key={a.id} data-testid={`achievement-row-${a.id}`} className="cursor-pointer" onClick={() => setDetail(a)}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {a.certificate_url ? <ImageIcon className="h-3.5 w-3.5 text-emerald-600 shrink-0" /> : null}
                              <span className="line-clamp-1">{a.name}</span>
                            </div>
                            {a.organizer && <div className="text-xs text-slate-500 mt-0.5">{a.organizer}</div>}
                          </TableCell>
                          {!isSiswa && (
                            <TableCell>
                              <div className="font-medium text-sm">{a.student_name || '-'}</div>
                              {a.class_name && <div className="text-xs text-slate-500">{a.class_name}</div>}
                            </TableCell>
                          )}
                          <TableCell>
                            <Badge variant="outline" className={catColor(a.category)}>{catLabel(a.category)}</Badge>
                          </TableCell>
                          <TableCell className="text-sm">{levelLabel(a.level)}</TableCell>
                          <TableCell className="text-sm font-semibold">{a.rank || '-'}</TableCell>
                          <TableCell className="text-sm text-slate-600">{a.date || '-'}</TableCell>
                          <TableCell>
                            {a.is_verified ? (
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Terverifikasi
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-100 text-amber-800 border-amber-200 gap-1">
                                <Clock className="h-3 w-3" /> Menunggu
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end gap-1">
                              {canVerify && !a.is_verified && (
                                <Button size="icon" variant="ghost" onClick={() => handleVerify(a)}
                                  className="text-emerald-600 hover:text-emerald-700"
                                  title="Verifikasi"
                                  data-testid={`verify-achievement-${a.id}`}>
                                  <CheckCircle2 className="h-4 w-4" />
                                </Button>
                              )}
                              {(isAdmin || (isSiswa && a.student_id === user?.id && !a.is_verified)) && (
                                <Button size="icon" variant="ghost" onClick={() => openEdit(a)}
                                  title="Edit"
                                  data-testid={`edit-achievement-${a.id}`}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              )}
                              {(isAdmin || (isSiswa && a.student_id === user?.id && !a.is_verified)) && (
                                <Button size="icon" variant="ghost" onClick={() => handleDelete(a)}
                                  className="text-rose-600 hover:text-rose-700"
                                  title="Hapus"
                                  data-testid={`delete-achievement-${a.id}`}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filtered.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={isSiswa ? 7 : 8} className="text-center py-12">
                            <EmptyState
                              icon={Trophy}
                              title={isSiswa ? "Belum ada prestasi" : "Tidak ada data"}
                              subtitle={isSiswa ? "Klik 'Tambah Prestasi' untuk mulai mencatat prestasimu" : "Belum ada prestasi pada filter ini"}
                            />
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Form Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Prestasi' : 'Tambah Prestasi'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
            {canVerify && (
              <div className="sm:col-span-2">
                <Label>Siswa *</Label>
                <Select value={form.student_id || ''} onValueChange={(v) => setForm({ ...form, student_id: v })}>
                  <SelectTrigger data-testid="ach-form-student"><SelectValue placeholder="Pilih siswa..." /></SelectTrigger>
                  <SelectContent>
                    {students.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.full_name} {s.nisn ? `(${s.nisn})` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="sm:col-span-2">
              <Label>Nama Prestasi *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Mis. Juara 1 Olimpiade Matematika"
                data-testid="ach-form-name" />
            </div>
            <div>
              <Label>Kategori</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger data-testid="ach-form-category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tingkat</Label>
              <Select value={form.level} onValueChange={(v) => setForm({ ...form, level: v })}>
                <SelectTrigger data-testid="ach-form-level"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEVELS.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Peringkat</Label>
              <Select value={form.rank} onValueChange={(v) => setForm({ ...form, rank: v })}>
                <SelectTrigger data-testid="ach-form-rank"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RANKS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tanggal *</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                data-testid="ach-form-date" />
            </div>
            <div className="sm:col-span-2">
              <Label>Penyelenggara</Label>
              <Input value={form.organizer || ''} onChange={(e) => setForm({ ...form, organizer: e.target.value })}
                placeholder="Mis. Dinas Pendidikan Provinsi Jawa Timur"
                data-testid="ach-form-organizer" />
            </div>
            <div className="sm:col-span-2">
              <Label>Deskripsi</Label>
              <Textarea value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Detail tambahan, cerita, atau catatan tentang prestasi ini..."
                rows={3}
                data-testid="ach-form-description" />
            </div>
            <div className="sm:col-span-2">
              <Label>Sertifikat / Foto (max 2MB)</Label>
              <div className="mt-2 flex items-start gap-3">
                {form.certificate_url ? (
                  <div className="relative">
                    <img src={form.certificate_url} alt="Sertifikat" className="h-32 w-32 object-cover rounded-lg border border-slate-200" />
                    <button type="button" onClick={() => setForm({ ...form, certificate_url: '' })}
                      className="absolute -top-2 -right-2 h-6 w-6 bg-rose-600 text-white rounded-full flex items-center justify-center hover:bg-rose-700">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <label className="h-32 w-32 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-[#006837] hover:bg-[#006837]/5">
                    <Upload className="h-6 w-6 text-slate-400 mb-1" />
                    <span className="text-xs text-slate-500">Upload</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleFile} data-testid="ach-form-file" />
                  </label>
                )}
                <div className="text-xs text-slate-500 max-w-[280px]">
                  Upload foto sertifikat, piala, atau dokumentasi. Mendukung JPG/PNG/WebP.
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={handleSubmit} className="bg-[#006837] hover:bg-[#0B7A3B]" data-testid="ach-form-submit">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-600" /> {detail?.name}
            </DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              {detail.certificate_url && (
                <img src={detail.certificate_url} alt="Sertifikat" className="w-full max-h-96 object-contain rounded-lg border border-slate-200 bg-slate-50" />
              )}
              <div className="grid grid-cols-2 gap-3">
                <DetailItem icon={Award} label="Peringkat" value={detail.rank} />
                <DetailItem icon={MapPin} label="Tingkat" value={levelLabel(detail.level)} />
                <DetailItem icon={Calendar} label="Tanggal" value={detail.date} />
                <DetailItem icon={Building} label="Penyelenggara" value={detail.organizer} />
                <div className="col-span-2"><Badge variant="outline" className={catColor(detail.category)}>{catLabel(detail.category)}</Badge></div>
                {detail.student_name && (
                  <div className="col-span-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-xs text-slate-500 uppercase tracking-wide">Siswa</div>
                    <div className="font-semibold">{detail.student_name}</div>
                    {detail.class_name && <div className="text-xs text-slate-600">Kelas {detail.class_name}</div>}
                  </div>
                )}
                {detail.description && (
                  <div className="col-span-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Deskripsi</div>
                    <div className="text-sm whitespace-pre-line">{detail.description}</div>
                  </div>
                )}
              </div>
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
                {detail.is_verified ? (
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Sudah Diverifikasi
                    {detail.verifier_name && <span className="ml-1 font-normal">oleh {detail.verifier_name}</span>}
                  </Badge>
                ) : (
                  <Badge className="bg-amber-100 text-amber-800 border-amber-200">Menunggu Verifikasi</Badge>
                )}
                {canVerify && !detail.is_verified && (
                  <Button onClick={() => { handleVerify(detail); setDetail(null); }} className="bg-emerald-600 hover:bg-emerald-700 gap-2" data-testid="verify-from-detail">
                    <CheckCircle2 className="h-4 w-4" /> Verifikasi Sekarang
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`h-10 w-10 rounded-lg ${color} flex items-center justify-center`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-2xl font-bold text-slate-900">{value}</div>
          <div className="text-xs text-slate-600 uppercase tracking-wide">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function GalleryCard({ a, onClick }) {
  return (
    <button
      onClick={onClick}
      className="text-left bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow"
      data-testid={`gallery-card-${a.id}`}
    >
      <div className="aspect-video bg-slate-100 flex items-center justify-center">
        {a.certificate_url ? (
          <img src={a.certificate_url} alt={a.name} className="w-full h-full object-cover" />
        ) : (
          <Trophy className="h-12 w-12 text-slate-300" />
        )}
      </div>
      <div className="p-3">
        <div className="font-bold text-slate-900 line-clamp-2">{a.name}</div>
        <div className="text-xs text-slate-600 mt-1">{a.student_name} • {a.class_name || '-'}</div>
        <div className="flex items-center gap-2 mt-2">
          <Badge variant="outline" className={catColor(a.category) + ' text-[10px]'}>{catLabel(a.category)}</Badge>
          {a.rank && <Badge variant="secondary" className="text-[10px]">{a.rank}</Badge>}
        </div>
      </div>
    </button>
  );
}

function DetailItem({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 p-2 bg-slate-50 rounded-lg">
      <Icon className="h-4 w-4 text-slate-500 mt-0.5 shrink-0" />
      <div>
        <div className="text-xs text-slate-500 uppercase tracking-wide">{label}</div>
        <div className="text-sm font-medium">{value}</div>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, subtitle }) {
  return (
    <div className="text-center py-8">
      <Icon className="h-10 w-10 mx-auto text-slate-300 mb-3" />
      <div className="font-semibold text-slate-700">{title}</div>
      <div className="text-sm text-slate-500 mt-1">{subtitle}</div>
    </div>
  );
}
