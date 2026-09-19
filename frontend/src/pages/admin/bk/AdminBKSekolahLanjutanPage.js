import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { School, Plus, Pencil, Trash2, Loader2, Save, Search, Settings2 } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const JENJANG_LIST = ['SMA', 'SMK', 'MA', 'Pondok Pesantren', 'Tidak Melanjutkan', 'Lainnya'];
const STATUS_LIST = ['Rencana', 'Mendaftar', 'Diterima', 'Tidak Diterima'];

const STATUS_BADGE = {
  Rencana: 'bg-slate-100 text-slate-700 border-slate-200',
  Mendaftar: 'bg-blue-100 text-blue-700 border-blue-200',
  Diterima: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Tidak Diterima': 'bg-rose-100 text-rose-700 border-rose-200',
};

const emptyForm = {
  siswa_id: '',
  jenjang_tujuan: '',
  nama_sekolah_tujuan: '',
  status: 'Rencana',
  catatan: '',
  tahun_ajaran_lulus: '',
};

export default function AdminBKSekolahLanjutanPage() {
  const [list, setList] = useState([]);
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sekolahTujuan, setSekolahTujuan] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [selectedTingkat, setSelectedTingkat] = useState('');
  const [selectedKelas, setSelectedKelas] = useState('');

  const [showSekolahModal, setShowSekolahModal] = useState(false);
  const [newSekolahNama, setNewSekolahNama] = useState('');
  const [newSekolahJenjang, setNewSekolahJenjang] = useState('');
  const [savingSekolah, setSavingSekolah] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [res, studentsRes, classesRes, sekolahRes, ayRes] = await Promise.all([
        api.get('/bk/sekolah-lanjutan'),
        api.get('/students'),
        api.get('/classes'),
        api.get('/bk/sekolah-tujuan'),
        api.get('/academic-years'),
      ]);
      setList(res.data || []);
      setStudents(studentsRes.data || []);
      setClasses(classesRes.data || []);
      setSekolahTujuan(sekolahRes.data || []);
      setAcademicYears(ayRes.data || []);
    } catch (e) {
      toast.error('Gagal memuat data sekolah lanjutan');
    } finally {
      setLoading(false);
    }
  };

  const tingkatOptions = [...new Set(classes.map((c) => c.grade).filter((g) => g !== undefined && g !== null))].sort((a, b) => a - b);
  const kelasOptions = classes.filter((c) => String(c.grade) === String(selectedTingkat));
  const studentsInKelas = students.filter((s) => s.student_class_id === selectedKelas);

  const openModal = (item = null) => {
    if (item) {
      setEditing(item);
      setForm({
        siswa_id: item.siswa_id || '',
        jenjang_tujuan: item.jenjang_tujuan || '',
        nama_sekolah_tujuan: item.nama_sekolah_tujuan || '',
        status: item.status || 'Rencana',
        catatan: item.catatan || '',
        tahun_ajaran_lulus: item.tahun_ajaran_lulus || '',
      });
      const siswa = students.find((s) => s.id === item.siswa_id);
      const kelas = classes.find((c) => c.id === siswa?.student_class_id);
      setSelectedTingkat(kelas ? String(kelas.grade) : '');
      setSelectedKelas(kelas ? kelas.id : '');
    } else {
      setEditing(null);
      setForm(emptyForm);
      setSelectedTingkat('');
      setSelectedKelas('');
    }
    setShowModal(true);
  };

  const handleAddSekolahTujuan = async () => {
    if (!newSekolahNama.trim()) {
      toast.error('Nama sekolah wajib diisi');
      return;
    }
    setSavingSekolah(true);
    try {
      const { data } = await api.post('/bk/sekolah-tujuan', { nama: newSekolahNama.trim(), jenjang: newSekolahJenjang || null });
      setSekolahTujuan((prev) => [...prev, data].sort((a, b) => a.nama.localeCompare(b.nama)));
      toast.success('Sekolah tujuan berhasil ditambahkan');
      setNewSekolahNama('');
      setNewSekolahJenjang('');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menambahkan sekolah tujuan');
    } finally {
      setSavingSekolah(false);
    }
  };

  const handleDeleteSekolahTujuan = async (item) => {
    if (!window.confirm(`Yakin ingin menghapus "${item.nama}" dari daftar sekolah tujuan?`)) return;
    try {
      await api.delete(`/bk/sekolah-tujuan/${item.id}`);
      setSekolahTujuan((prev) => prev.filter((s) => s.id !== item.id));
      toast.success('Sekolah tujuan dihapus');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menghapus sekolah tujuan');
    }
  };

  const handleSave = async () => {
    if (!form.siswa_id) {
      toast.error('Siswa wajib dipilih');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/bk/sekolah-lanjutan/${editing.id}`, form);
        toast.success('Data sekolah lanjutan berhasil diperbarui');
      } else {
        await api.post('/bk/sekolah-lanjutan', form);
        toast.success('Data sekolah lanjutan berhasil ditambahkan');
      }
      setShowModal(false);
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menyimpan data');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Yakin ingin menghapus data ini?')) return;
    try {
      await api.delete(`/bk/sekolah-lanjutan/${id}`);
      toast.success('Data dihapus');
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menghapus data');
    }
  };

  const filtered = list.filter((item) => {
    if (filterStatus && item.status !== filterStatus) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (item.siswa_nama || '').toLowerCase().includes(q) ||
      (item.siswa_nis || '').toLowerCase().includes(q) ||
      (item.nama_sekolah_tujuan || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6" data-testid="admin-bk-sekolah-lanjutan-page">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <School className="h-3 w-3 mr-1" /> Menu BK
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Data Sekolah Lanjutan</h1>
          <p className="text-sm text-slate-600 mt-1">Pantau rencana dan status kelanjutan sekolah siswa</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowSekolahModal(true)} className="gap-2">
            <Settings2 className="h-4 w-4" /> Kelola Sekolah Tujuan
          </Button>
          <Button onClick={() => openModal()} className="gap-2 bg-[#006837] hover:bg-[#005830]">
            <Plus className="h-4 w-4" /> Tambah Data
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Cari nama, NIS, atau sekolah tujuan..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterStatus || 'all'} onValueChange={(v) => setFilterStatus(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Semua Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              {STATUS_LIST.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-[#006837]" />
              <p className="text-slate-500">Memuat data...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Siswa</TableHead>
                    <TableHead>Jenjang Tujuan</TableHead>
                    <TableHead>Sekolah Tujuan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tahun Lulus</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-slate-500">
                        <School className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                        <div className="font-semibold">Belum ada data sekolah lanjutan</div>
                        <div className="text-xs mt-1">Klik "Tambah Data" untuk mulai mencatat</div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-semibold">{item.siswa_nama}<div className="text-xs text-slate-500 font-normal">{item.siswa_nis}</div></TableCell>
                        <TableCell>{item.jenjang_tujuan || '-'}</TableCell>
                        <TableCell>{item.nama_sekolah_tujuan || '-'}</TableCell>
                        <TableCell><Badge className={STATUS_BADGE[item.status] || ''}>{item.status}</Badge></TableCell>
                        <TableCell>{item.tahun_ajaran_lulus || '-'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" onClick={() => openModal(item)} className="text-blue-600 hover:text-blue-700">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => handleDelete(item.id)} className="text-rose-600 hover:text-rose-700">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
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

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Data Sekolah Lanjutan' : 'Tambah Data Sekolah Lanjutan'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tingkat <span className="text-rose-500">*</span></Label>
                <Select
                  value={selectedTingkat || 'none'}
                  onValueChange={(v) => {
                    const tingkat = v === 'none' ? '' : v;
                    setSelectedTingkat(tingkat);
                    setSelectedKelas('');
                    setForm({ ...form, siswa_id: '' });
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Pilih Tingkat" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Pilih Tingkat</SelectItem>
                    {tingkatOptions.map((g) => <SelectItem key={g} value={String(g)}>Kelas {g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Kelas <span className="text-rose-500">*</span></Label>
                <Select
                  value={selectedKelas || 'none'}
                  onValueChange={(v) => {
                    const kelas = v === 'none' ? '' : v;
                    setSelectedKelas(kelas);
                    setForm({ ...form, siswa_id: '' });
                  }}
                  disabled={!selectedTingkat}
                >
                  <SelectTrigger><SelectValue placeholder="Pilih Kelas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Pilih Kelas</SelectItem>
                    {kelasOptions.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Siswa <span className="text-rose-500">*</span></Label>
              <Select value={form.siswa_id || 'none'} onValueChange={(v) => setForm({ ...form, siswa_id: v === 'none' ? '' : v })} disabled={!selectedKelas}>
                <SelectTrigger><SelectValue placeholder={selectedKelas ? 'Pilih Siswa' : 'Pilih tingkat & kelas dahulu'} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Pilih Siswa</SelectItem>
                  {studentsInKelas.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.nis} - {s.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedKelas && studentsInKelas.length === 0 && (
                <p className="text-xs text-amber-600">Tidak ada siswa terdaftar di kelas ini</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Jenjang Tujuan</Label>
                <Select
                  value={form.jenjang_tujuan || 'none'}
                  onValueChange={(v) => {
                    const jenjang = v === 'none' ? '' : v;
                    setForm({ ...form, jenjang_tujuan: jenjang, nama_sekolah_tujuan: jenjang === 'Tidak Melanjutkan' ? '' : form.nama_sekolah_tujuan });
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Pilih Jenjang" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Pilih Jenjang</SelectItem>
                    {JENJANG_LIST.map((j) => <SelectItem key={j} value={j}>{j}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_LIST.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.jenjang_tujuan !== 'Tidak Melanjutkan' && (
              <div className="space-y-2">
                <Label>Nama Sekolah Tujuan</Label>
                {form.jenjang_tujuan === 'Lainnya' ? (
                  <Input
                    value={form.nama_sekolah_tujuan}
                    onChange={(e) => setForm({ ...form, nama_sekolah_tujuan: e.target.value })}
                    placeholder="Ketik nama sekolah tujuan"
                  />
                ) : (
                  <>
                    <Select value={form.nama_sekolah_tujuan || 'none'} onValueChange={(v) => setForm({ ...form, nama_sekolah_tujuan: v === 'none' ? '' : v })}>
                      <SelectTrigger><SelectValue placeholder="Pilih Sekolah Tujuan" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Pilih Sekolah Tujuan</SelectItem>
                        {sekolahTujuan.map((s) => <SelectItem key={s.id} value={s.nama}>{s.nama}{s.jenjang ? ` (${s.jenjang})` : ''}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {sekolahTujuan.length === 0 && (
                      <p className="text-xs text-amber-600">Belum ada sekolah tujuan terdaftar. Klik "Kelola Sekolah Tujuan" untuk menambahkan, atau pilih Jenjang "Lainnya" untuk mengetik manual.</p>
                    )}
                  </>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label>Tahun Ajaran Lulus</Label>
              <Select value={form.tahun_ajaran_lulus || 'none'} onValueChange={(v) => setForm({ ...form, tahun_ajaran_lulus: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Pilih Tahun Pelajaran" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Pilih Tahun Pelajaran</SelectItem>
                  {academicYears.map((ay) => <SelectItem key={ay.id} value={ay.name}>{ay.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Catatan</Label>
              <Textarea rows={3} value={form.catatan} onChange={(e) => setForm({ ...form, catatan: e.target.value })} placeholder="Catatan tambahan (opsional)" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)} disabled={saving}>Batal</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2 bg-[#006837] hover:bg-[#005830]">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSekolahModal} onOpenChange={setShowSekolahModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Kelola Sekolah Tujuan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px_auto] gap-2 items-end">
              <div className="space-y-1.5">
                <Label className="text-xs">Nama Sekolah</Label>
                <Input value={newSekolahNama} onChange={(e) => setNewSekolahNama(e.target.value)} placeholder="Contoh: SMAN 1 Malang" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Jenjang</Label>
                <Select value={newSekolahJenjang || 'none'} onValueChange={(v) => setNewSekolahJenjang(v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Opsional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Opsional</SelectItem>
                    {JENJANG_LIST.map((j) => <SelectItem key={j} value={j}>{j}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAddSekolahTujuan} disabled={savingSekolah} size="icon" className="bg-[#006837] hover:bg-[#005830]">
                {savingSekolah ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>

            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {sekolahTujuan.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-500">Belum ada sekolah tujuan terdaftar</div>
              ) : (
                sekolahTujuan.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-2.5 text-sm">
                    <div>
                      <span className="font-medium text-slate-800">{s.nama}</span>
                      {s.jenjang && <span className="text-slate-400 ml-1.5">({s.jenjang})</span>}
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => handleDeleteSekolahTujuan(s)} className="text-rose-600 hover:text-rose-700">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSekolahModal(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
