import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Pencil, Trash2, GraduationCap, Search, UserMinus, UserPlus, ArrowRightLeft, Download, Upload, FileSpreadsheet, LogIn, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';

const EMPTY = {
  username: '', password: '', full_name: '', nisn: '', nism: '', nomor_peserta_ujian: '',
  email: '', phone: '', student_class_id: '',
  gender: '', birth_place: '', birth_date: '', address: '',
  mutation_type: '', mutation_date: '', mutation_note: '',
};

export default function AdminPenggunaSiswaPage() {
  const { impersonate } = useAuth();
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [nismDialogOpen, setNismDialogOpen] = useState(false);
  const [selectedClassForNism, setSelectedClassForNism] = useState('');
  const [importingNism, setImportingNism] = useState(false);
  const [impersonatingUserId, setImpersonatingUserId] = useState(null);

  const refresh = async () => {
    const { data } = await api.get('/users', { params: { role: 'siswa' } });
    setStudents(data);
  };

  useEffect(() => {
    (async () => {
      try {
        const [s, c] = await Promise.all([
          api.get('/users', { params: { role: 'siswa' } }),
          api.get('/classes'),
        ]);
        setStudents(s.data);
        setClasses(c.data);
      } catch (e) { /* */ } finally { setLoading(false); }
    })();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY });
    setOpen(true);
  };

  const openEdit = (u) => {
    setEditing(u);
    setOpen(true);
    setForm({
      ...EMPTY,
      ...u,
      password: '',
      student_class_id: u.student_class_id || '',
      gender: u.gender || '',
      mutation_type: u.mutation_type || '',
      mutation_date: u.mutation_date || '',
      mutation_note: u.mutation_note || '',
      nism: u.nism || '',
      nomor_peserta_ujian: u.nomor_peserta_ujian || '',
    });
  };

  const handleSubmit = async () => {
    if (!form.username || !form.full_name) {
      toast.error('Username dan nama wajib diisi');
      return;
    }
    try {
      if (editing) {
        const payload = { ...form };
        // Mutation fields are saved via separate endpoint
        const mutationPayload = {
          mutation_type: payload.mutation_type || null,
          mutation_date: payload.mutation_date || null,
          mutation_note: payload.mutation_note || null,
        };
        delete payload.mutation_type;
        delete payload.mutation_date;
        delete payload.mutation_note;
        // Auto-set role to siswa
        payload.roles = ['siswa'];
        if (!payload.password) delete payload.password;
        else { payload.new_password = payload.password; delete payload.password; }
        await api.put(`/users/${editing.id}`, payload);
        // Always update mutation for student
        await api.put(`/admin/users/${editing.id}/mutation`, mutationPayload);
        toast.success('Data siswa berhasil diperbarui');
      } else {
        if (!form.password) { toast.error('Password wajib diisi untuk siswa baru'); return; }
        const payload = { ...form };
        delete payload.mutation_type;
        delete payload.mutation_date;
        delete payload.mutation_note;
        // Auto-set role to siswa
        payload.roles = ['siswa'];
        await api.post('/users', payload);
        toast.success('Siswa berhasil ditambahkan');
      }
      setOpen(false);
      refresh();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menyimpan');
    }
  };

  const handleDelete = async (u) => {
    if (!window.confirm(`Hapus siswa ${u.full_name} (${u.username})?`)) return;
    try {
      await api.delete(`/users/${u.id}`);
      toast.success('Siswa dihapus');
      refresh();
    } catch (e) {
      toast.error('Gagal menghapus');
    }
  };

  const handleImpersonate = async (user) => {
    if (impersonatingUserId) return;
    setImpersonatingUserId(user.id);
    try {
      await impersonate(user.id);
      toast.success(`Berhasil login sebagai ${user.full_name}`);
      // Redirect will be handled by AuthContext
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal login sebagai user ini');
      setImpersonatingUserId(null);
    }
  };

  const handleDownloadNismTemplate = async (classId = null) => {
    try {
      const params = classId ? { class_id: classId } : {};
      const response = await api.get('/students/nism-template', {
        params,
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const className = classId ? classes.find(c => c.id === classId)?.name : 'semua_siswa';
      link.setAttribute('download', `template_update_nism_${className}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Template berhasil diunduh');
    } catch (e) {
      toast.error('Gagal mengunduh template: ' + (e?.response?.data?.detail || e.message));
    }
  };

  const handleImportNism = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportingNism(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const { data } = await api.post('/students/import-nism', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (data.errors && data.errors.length > 0) {
        toast.warning(`Berhasil update ${data.success} dari ${data.total_rows} baris. Ada ${data.errors.length} error.`, {
          duration: 5000,
        });
        console.error('Import errors:', data.errors);
      } else {
        toast.success(`Berhasil update ${data.success} data NISM siswa!`);
      }

      setNismDialogOpen(false);
      refresh();
    } catch (e) {
      toast.error('Gagal import: ' + (e?.response?.data?.detail || e.message));
    } finally {
      setImportingNism(false);
      event.target.value = '';
    }
  };

  const filtered = students.filter((u) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return u.username?.toLowerCase().includes(s) ||
           u.full_name?.toLowerCase().includes(s) ||
           u.nisn?.toLowerCase().includes(s) ||
           u.nism?.toLowerCase().includes(s);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <GraduationCap className="h-3 w-3 mr-1" /> Manajemen Akun Siswa
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Kelola Pengguna Siswa</h1>
          <p className="text-sm text-slate-600 mt-1">{students.length} akun siswa terdaftar</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setNismDialogOpen(true)} variant="outline" className="gap-2" data-testid="update-nism-button">
            <FileSpreadsheet className="h-4 w-4" /> Update NISM
          </Button>
          <Button onClick={openCreate} className="bg-[#006837] hover:bg-[#0B7A3B] gap-2" data-testid="add-student-button">
            <Plus className="h-4 w-4" /> Tambah Siswa
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b border-slate-100 flex items-center gap-2">
            {/* Hidden dummy fields to prevent browser autofill on search field */}
            <input type="text" name="fake-username" autoComplete="username" style={{ display: 'none' }} tabIndex={-1} aria-hidden="true" />
            <input type="password" name="fake-password" autoComplete="current-password" style={{ display: 'none' }} tabIndex={-1} aria-hidden="true" />
            <Search className="h-4 w-4 text-slate-400" />
            <Input
              placeholder="Cari nama, username, NISN, atau NISM..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
              data-testid="student-search-input"
              autoComplete="off"
              name="students-search-query"
              type="search"
            />
          </div>
          <div className="overflow-x-auto">
            <Table data-testid="admin-students-table">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">ID</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Nama Lengkap</TableHead>
                  <TableHead>NISN</TableHead>
                  <TableHead>NISM</TableHead>
                  <TableHead>No. Peserta Ujian</TableHead>
                  <TableHead>Kelas</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => {
                  const className = classes.find(c => c.id === u.student_class_id)?.name;

                  return (
                    <TableRow key={u.id} data-testid={`student-row-${u.username}`}>
                      <TableCell className="font-mono text-xs text-slate-500">
                        {u.id ? u.id.substring(0, 8) : '-'}
                      </TableCell>
                      <TableCell className="font-mono">{u.username}</TableCell>
                      <TableCell className="font-medium">{u.full_name}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {u.nisn ? (
                          <span className="text-slate-700">{u.nisn}</span>
                        ) : (
                          <span className="italic text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {u.nism ? (
                          <span className="text-slate-700">{u.nism}</span>
                        ) : (
                          <span className="italic text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {u.nomor_peserta_ujian ? (
                          <span className="text-slate-700">{u.nomor_peserta_ujian}</span>
                        ) : (
                          <span className="italic text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {className ? (
                          <Badge variant="outline" className="font-semibold">{className}</Badge>
                        ) : (
                          <span className="italic text-slate-400 text-xs">Belum ada kelas</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {u.email || <span className="italic text-slate-400">-</span>}
                      </TableCell>
                      <TableCell>
                        {u.mutation_type === 'keluar' ? (
                          <Badge className="bg-rose-100 text-rose-700 border-rose-200 gap-1">
                            <UserMinus className="h-3 w-3" /> Mutasi Keluar
                          </Badge>
                        ) : u.mutation_type === 'masuk' ? (
                          <Badge className="bg-blue-100 text-blue-700 border-blue-200 gap-1">
                            <UserPlus className="h-3 w-3" /> Mutasi Masuk
                          </Badge>
                        ) : u.is_active ? (
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Aktif</Badge>
                        ) : (
                          <Badge variant="outline">Nonaktif</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleImpersonate(u)}
                            disabled={impersonatingUserId !== null}
                            className="gap-1 border-blue-400 text-blue-700 hover:bg-blue-50"
                            data-testid={`impersonate-student-${u.username}`}
                            title="Login sebagai siswa ini"
                          >
                            {impersonatingUserId === u.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogIn className="h-3.5 w-3.5" />}
                            Login Sebagai
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openEdit(u)}
                            data-testid={`edit-student-${u.username}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDelete(u)}
                            className="text-rose-600 hover:text-rose-700"
                            data-testid={`delete-student-${u.username}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-slate-500">
                      Tidak ada siswa ditemukan
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog Add/Edit Student */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Data Siswa' : 'Tambah Siswa Baru'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
            <div>
              <Label>Username *</Label>
              <Input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                disabled={!!editing}
                data-testid="student-form-username"
              />
            </div>
            <div>
              <Label>Password {editing ? '(kosongkan jika tidak ganti)' : '*'}</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                data-testid="student-form-password"
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Nama Lengkap *</Label>
              <Input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                data-testid="student-form-fullname"
              />
            </div>
            <div>
              <Label>NISN</Label>
              <Input
                value={form.nisn || ''}
                onChange={(e) => setForm({ ...form, nisn: e.target.value })}
                placeholder="Nomor Induk Siswa Nasional"
              />
            </div>
            <div>
              <Label>NISM</Label>
              <Input
                value={form.nism || ''}
                onChange={(e) => setForm({ ...form, nism: e.target.value })}
                placeholder="NIS Madrasah"
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Nomor Peserta Ujian</Label>
              <Input
                value={form.nomor_peserta_ujian || ''}
                onChange={(e) => setForm({ ...form, nomor_peserta_ujian: e.target.value })}
                placeholder="Nomor Peserta Ujian Madrasah"
              />
            </div>
            <div>
              <Label>Jenis Kelamin</Label>
              <Select value={form.gender || ''} onValueChange={(v) => setForm({...form, gender: v})}>
                <SelectTrigger><SelectValue placeholder="-" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="L">Laki-laki</SelectItem>
                  <SelectItem value="P">Perempuan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tempat Lahir</Label>
              <Input
                value={form.birth_place || ''}
                onChange={(e) => setForm({...form, birth_place: e.target.value})}
              />
            </div>
            <div>
              <Label>Tanggal Lahir</Label>
              <Input
                type="date"
                value={form.birth_date || ''}
                onChange={(e) => setForm({...form, birth_date: e.target.value})}
              />
            </div>
            <div>
              <Label>Kelas Siswa</Label>
              <Select value={form.student_class_id || ''} onValueChange={(v) => setForm({ ...form, student_class_id: v })}>
                <SelectTrigger><SelectValue placeholder="Pilih kelas..." /></SelectTrigger>
                <SelectContent>
                  {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email || ''}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <Label>No. HP</Label>
              <Input
                value={form.phone || ''}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Alamat</Label>
              <Input
                value={form.address || ''}
                onChange={(e) => setForm({...form, address: e.target.value})}
              />
            </div>

            {editing && (
              <div className="sm:col-span-2 rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3" data-testid="mutation-section">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center">
                    <ArrowRightLeft className="h-4 w-4 text-amber-700" />
                  </div>
                  <div>
                    <div className="font-semibold text-amber-900">Status Mutasi Siswa</div>
                    <div className="text-xs text-amber-800/80">Catat siswa pindah masuk / keluar di TP aktif</div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Tipe Mutasi</Label>
                    <Select
                      value={form.mutation_type || '_none'}
                      onValueChange={(v) => setForm({ ...form, mutation_type: v === '_none' ? '' : v })}
                    >
                      <SelectTrigger data-testid="mutation-type-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Tidak Ada Mutasi</SelectItem>
                        <SelectItem value="masuk">Mutasi Masuk (dari sekolah lain)</SelectItem>
                        <SelectItem value="keluar">Mutasi Keluar (pindah/keluar)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Tanggal Mutasi</Label>
                    <Input
                      type="date"
                      value={form.mutation_date || ''}
                      onChange={(e) => setForm({ ...form, mutation_date: e.target.value })}
                      disabled={!form.mutation_type}
                      data-testid="mutation-date"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Keterangan</Label>
                  <Input
                    value={form.mutation_note || ''}
                    onChange={(e) => setForm({ ...form, mutation_note: e.target.value })}
                    placeholder="Mis. asal sekolah, alasan keluar, dll"
                    disabled={!form.mutation_type}
                    data-testid="mutation-note"
                  />
                </div>
                {form.mutation_type && (
                  <div className="text-xs text-amber-800 bg-white border border-amber-200 rounded-lg p-2">
                    <strong>Catatan:</strong> Mutasi <strong>{form.mutation_type === 'masuk' ? 'Masuk' : 'Keluar'}</strong> akan tercatat di TP aktif & status akun otomatis di-{form.mutation_type === 'masuk' ? 'aktifkan' : 'nonaktifkan'}.
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button
              onClick={handleSubmit}
              className="bg-[#006837] hover:bg-[#0B7A3B]"
              data-testid="student-form-submit"
            >
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Update NISM */}
      <Dialog open={nismDialogOpen} onOpenChange={setNismDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-[#006837]" />
              Update NISM & Nomor Peserta Ujian Madrasah
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">Cara Menggunakan:</h3>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                <li>Download template Excel (pilih semua siswa atau per kelas)</li>
                <li>Isi kolom <strong>NISM</strong> dan <strong>Nomor Peserta Ujian</strong> di Excel</li>
                <li>Simpan file Excel</li>
                <li>Upload file Excel yang sudah diisi</li>
              </ol>
            </div>

            <div className="space-y-3">
              <div>
                <Label className="mb-2 block font-semibold">1. Download Template Excel</Label>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    onClick={() => handleDownloadNismTemplate()}
                    variant="outline"
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download Semua Siswa
                  </Button>

                  <Select value={selectedClassForNism} onValueChange={setSelectedClassForNism}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Pilih kelas..." />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    onClick={() => handleDownloadNismTemplate(selectedClassForNism)}
                    variant="outline"
                    className="gap-2"
                    disabled={!selectedClassForNism}
                  >
                    <Download className="h-4 w-4" />
                    Download Kelas Terpilih
                  </Button>
                </div>
              </div>

              <div className="border-t pt-3">
                <Label className="mb-2 block font-semibold">2. Upload File Excel yang Sudah Diisi</Label>
                <div className="flex gap-2 items-center">
                  <input
                    type="file"
                    accept=".xlsx,.xlsm"
                    onChange={handleImportNism}
                    disabled={importingNism}
                    className="hidden"
                    id="nism-file-input"
                  />
                  <Button
                    onClick={() => document.getElementById('nism-file-input').click()}
                    disabled={importingNism}
                    className="bg-[#006837] hover:bg-[#0B7A3B] gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    {importingNism ? 'Mengimport...' : 'Upload & Import Excel'}
                  </Button>
                  {importingNism && (
                    <span className="text-sm text-slate-600">Sedang memproses...</span>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs text-amber-800">
                <strong>Catatan:</strong> Pastikan tidak mengubah kolom ID dan NISN di template Excel.
                Hanya isi kolom NISM dan Nomor Peserta Ujian.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNismDialogOpen(false)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
