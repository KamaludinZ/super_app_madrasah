import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Pencil, Trash2, Users, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api, ROLE_LABELS } from '@/lib/api';
import { toast } from 'sonner';

const EMPTY = {
  username: '', password: '', full_name: '', nip_nuptk: '', nisn: '', email: '', phone: '',
  roles: [], homeroom_class_id: '', student_class_id: '', parent_of: [],
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [classes, setClasses] = useState([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [studentsList, setStudentsList] = useState([]);

  const refresh = async () => {
    const { data } = await api.get('/users');
    setUsers(data);
  };

  useEffect(() => {
    (async () => {
      try {
        const [u, r, c] = await Promise.all([
          api.get('/users'), api.get('/roles'), api.get('/classes'),
        ]);
        setUsers(u.data); setRoles(r.data); setClasses(c.data);
        const studs = await api.get('/users', { params: { role: 'siswa' } });
        setStudentsList(studs.data);
      } catch (e) { /* */ } finally { setLoading(false); }
    })();
  }, []);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (u) => {
    setEditing(u); setOpen(true);
    setForm({
      ...EMPTY, ...u, password: '',
      homeroom_class_id: u.homeroom_class_id || '',
      student_class_id: u.student_class_id || '',
      parent_of: u.parent_of || [],
    });
  };

  const toggleRole = (r) => {
    const exists = form.roles.includes(r);
    setForm({ ...form, roles: exists ? form.roles.filter((x) => x !== r) : [...form.roles, r] });
  };

  const handleSubmit = async () => {
    if (!form.username || !form.full_name || form.roles.length === 0) {
      toast.error('Username, nama, dan minimal 1 peran wajib diisi');
      return;
    }
    try {
      if (editing) {
        const payload = { ...form };
        if (!payload.password) delete payload.password;
        else { payload.new_password = payload.password; delete payload.password; }
        await api.put(`/users/${editing.id}`, payload);
        toast.success('User berhasil diperbarui');
      } else {
        if (!form.password) { toast.error('Password wajib diisi untuk user baru'); return; }
        await api.post('/users', form);
        toast.success('User berhasil dibuat');
      }
      setOpen(false);
      refresh();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menyimpan');
    }
  };

  const handleDelete = async (u) => {
    if (!window.confirm(`Hapus user ${u.username}?`)) return;
    try {
      await api.delete(`/users/${u.id}`);
      toast.success('User dihapus');
      refresh();
    } catch (e) {
      toast.error('Gagal menghapus');
    }
  };

  const filtered = users.filter((u) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return u.username?.toLowerCase().includes(s) || u.full_name?.toLowerCase().includes(s);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2"><Users className="h-3 w-3 mr-1" /> Manajemen Pengguna</Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Kelola Pengguna</h1>
          <p className="text-sm text-slate-600 mt-1">{users.length} pengguna terdaftar</p>
        </div>
        <Button onClick={openCreate} className="bg-[#006837] hover:bg-[#0B7A3B] gap-2" data-testid="add-user-button">
          <Plus className="h-4 w-4" /> Tambah Pengguna
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b border-slate-100 flex items-center gap-2">
            <Search className="h-4 w-4 text-slate-400" />
            <Input placeholder="Cari nama atau username..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" data-testid="user-search-input" />
          </div>
          <div className="overflow-x-auto">
            <Table data-testid="admin-users-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Nama Lengkap</TableHead>
                  <TableHead>Peran</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => (
                  <TableRow key={u.id} data-testid={`user-row-${u.username}`}>
                    <TableCell className="font-mono">{u.username}</TableCell>
                    <TableCell className="font-medium">{u.full_name}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {u.roles?.map((r) => (
                          <Badge key={r} variant="secondary" className="text-xs">{ROLE_LABELS[r] || r}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {u.is_active ? <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Aktif</Badge> :
                        <Badge variant="outline">Nonaktif</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(u)} data-testid={`edit-user-${u.username}`}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => handleDelete(u)} className="text-rose-600 hover:text-rose-700" data-testid={`delete-user-${u.username}`}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Pengguna' : 'Tambah Pengguna Baru'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
            <div>
              <Label>Username *</Label>
              <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} disabled={!!editing} data-testid="user-form-username" />
            </div>
            <div>
              <Label>Password {editing ? '(kosongkan jika tidak ganti)' : '*'}</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} data-testid="user-form-password" />
            </div>
            <div className="sm:col-span-2">
              <Label>Nama Lengkap *</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} data-testid="user-form-fullname" />
            </div>
            <div>
              <Label>NIP/NUPTK</Label>
              <Input value={form.nip_nuptk || ''} onChange={(e) => setForm({ ...form, nip_nuptk: e.target.value })} />
            </div>
            <div>
              <Label>NISN (Siswa)</Label>
              <Input value={form.nisn || ''} onChange={(e) => setForm({ ...form, nisn: e.target.value })} />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label>HP</Label>
              <Input value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label>Peran (boleh lebih dari satu) *</Label>
              <div className="grid grid-cols-2 gap-2 mt-2 max-h-56 overflow-y-auto p-2 border border-slate-200 rounded-lg">
                {roles.map((r) => (
                  <label key={r.value} className="flex items-center gap-2 cursor-pointer text-sm" data-testid={`role-checkbox-${r.value}`}>
                    <Checkbox checked={form.roles.includes(r.value)} onCheckedChange={() => toggleRole(r.value)} />
                    <span>{r.label}</span>
                  </label>
                ))}
              </div>
            </div>
            {form.roles.includes('wali_kelas') && (
              <div className="sm:col-span-2">
                <Label>Wali Kelas dari</Label>
                <Select value={form.homeroom_class_id || ''} onValueChange={(v) => setForm({ ...form, homeroom_class_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Pilih kelas..." /></SelectTrigger>
                  <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {form.roles.includes('siswa') && (
              <div className="sm:col-span-2">
                <Label>Kelas Siswa</Label>
                <Select value={form.student_class_id || ''} onValueChange={(v) => setForm({ ...form, student_class_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Pilih kelas..." /></SelectTrigger>
                  <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {form.roles.includes('orang_tua') && (
              <div className="sm:col-span-2">
                <Label>Sebagai Wali dari (pilih siswa)</Label>
                <div className="grid grid-cols-1 gap-1 mt-2 max-h-40 overflow-y-auto p-2 border border-slate-200 rounded-lg">
                  {studentsList.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 cursor-pointer text-sm">
                      <Checkbox
                        checked={form.parent_of.includes(s.id)}
                        onCheckedChange={() => {
                          const ex = form.parent_of.includes(s.id);
                          setForm({ ...form, parent_of: ex ? form.parent_of.filter((x) => x !== s.id) : [...form.parent_of, s.id] });
                        }}
                      />
                      <span>{s.full_name} ({s.nisn || '-'})</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={handleSubmit} className="bg-[#006837] hover:bg-[#0B7A3B]" data-testid="user-form-submit">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
