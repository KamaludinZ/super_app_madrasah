import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Pencil, Trash2, Users, Search, UserMinus, UserPlus, ArrowRightLeft, LogIn, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { api, ROLE_LABELS } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';

const EMPTY = {
  username: '', password: '', full_name: '', email: '', phone: '',
  roles: [], homeroom_class_id: '', student_class_id: '', parent_of: [],
  gender: '', birth_place: '', birth_date: '',
  mutation_type: '', mutation_date: '', mutation_note: '',
  jabatan_ids: [],
};

const ROLE_TABS = [
  { value: 'all', label: 'Semua' },
  { value: 'admin', label: 'Admin' },
  { value: 'guru', label: 'Guru' },
  { value: 'wali_kelas', label: 'Wali Kelas' },
  { value: 'tenaga_kependidikan', label: 'Tendik' },
  { value: 'guru_piket', label: 'Piket' },
  { value: 'guru_bk', label: 'BK' },
  { value: 'guru_tata_tertib', label: 'Tatib' },
  { value: 'guru_ekstrakurikuler', label: 'Ekstra' },
  { value: 'kepala_sekolah', label: 'Kepsek' },
  { value: 'kepala_tata_usaha', label: 'KTU' },
  { value: 'waka_kesiswaan', label: 'Waka Kesiswaan' },
  { value: 'waka_kurikulum', label: 'Waka Kurikulum' },
  { value: 'bendahara', label: 'Bendahara' },
  { value: 'perpustakaan', label: 'Perpustakaan' },
  { value: 'alumni', label: 'Alumni' },
];

export default function AdminUsersPage() {
  const { impersonate } = useAuth();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [classes, setClasses] = useState([]);
  const [jabatanList, setJabatanList] = useState([]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [studentsList, setStudentsList] = useState([]);
  const [impersonatingUserId, setImpersonatingUserId] = useState(null);
  const [gtkWithoutAccount, setGtkWithoutAccount] = useState([]);

  const refresh = async () => {
    const { data } = await api.get('/users');
    setUsers(data);
  };

  useEffect(() => {
    (async () => {
      try {
        const [u, r, c, j] = await Promise.all([
          api.get('/users'),
          api.get('/roles'),
          api.get('/classes'),
          api.get('/jabatan/active')
        ]);
        setUsers(u.data); setRoles(r.data); setClasses(c.data); setJabatanList(j.data);
        const studs = await api.get('/users', { params: { role: 'siswa' } });
        setStudentsList(studs.data);

        const gtkRoles = ['guru', 'wali_kelas', 'tenaga_kependidikan', 'guru_piket', 'guru_bk', 'guru_tata_tertib', 'guru_ekstrakurikuler'];
        const noAccountGtk = (u.data || []).filter((usr) =>
          (usr.roles || []).some((rr) => gtkRoles.includes(rr)) &&
          (!usr.username || !String(usr.username).trim())
        );
        setGtkWithoutAccount(noAccountGtk);
      } catch (e) { /* */ } finally { setLoading(false); }
    })();
  }, []);

  const openCreate = () => {
    setEditing(null);
    const initialRoles = activeTab !== 'all' ? [activeTab] : [];
    setForm({ ...EMPTY, roles: initialRoles, gtk_source_user_id: '' }); setOpen(true);
  };
  const openEdit = (u) => {
    setEditing(u); setOpen(true);
    setForm({
      ...EMPTY, ...u, password: '',
      homeroom_class_id: u.homeroom_class_id || '',
      student_class_id: u.student_class_id || '',
      parent_of: u.parent_of || [], gender: u.gender || '',
      mutation_type: u.mutation_type || '',
      mutation_date: u.mutation_date || '',
      mutation_note: u.mutation_note || '',
      jabatan_ids: u.jabatan_ids || [],
    });
  };

  const toggleRole = (r) => {
    const exists = form.roles.includes(r);
    setForm({ ...form, roles: exists ? form.roles.filter((x) => x !== r) : [...form.roles, r] });
  };

  const toggleJabatan = (jid) => {
    const exists = form.jabatan_ids.includes(jid);
    setForm({ ...form, jabatan_ids: exists ? form.jabatan_ids.filter((x) => x !== jid) : [...form.jabatan_ids, jid] });
  };

  const handleSubmit = async () => {
    if (!form.username || !form.full_name || form.roles.length === 0) {
      toast.error('Username, nama, dan minimal 1 peran wajib diisi');
      return;
    }

    if (form.roles.some((r) => ['siswa', 'alumni'].includes(r))) {
      toast.error('Peran siswa/alumni hanya dikelola di menu Pengguna Siswa');
      return;
    }
    try {
      if (editing) {
        const payload = { ...form };
        delete payload.gtk_source_user_id;
        // Mutation fields are saved via separate endpoint
        const mutationPayload = {
          mutation_type: payload.mutation_type || null,
          mutation_date: payload.mutation_date || null,
          mutation_note: payload.mutation_note || null,
        };
        delete payload.mutation_type;
        delete payload.mutation_date;
        delete payload.mutation_note;
        if (!payload.password) delete payload.password;
        else { payload.new_password = payload.password; delete payload.password; }

        // Cleanup: field siswa dikelola di /admin/pengguna-siswa, bukan /admin/users
        delete payload.nisn;
        delete payload.nism;
        delete payload.nomor_peserta_ujian;

        await api.put(`/users/${editing.id}`, payload);
        // Always update mutation if user has siswa role (so admin can clear it too)
        if ((editing.roles || []).includes('siswa')) {
          await api.put(`/admin/users/${editing.id}/mutation`, mutationPayload);
        }
        toast.success('User berhasil diperbarui');
      } else {
        if (!form.password) { toast.error('Password wajib diisi untuk user baru'); return; }
        const payload = { ...form };
        delete payload.gtk_source_user_id;
        delete payload.mutation_type;
        delete payload.mutation_date;
        delete payload.mutation_note;

        // Cleanup: field siswa dikelola di /admin/pengguna-siswa, bukan /admin/users
        delete payload.nisn;
        delete payload.nism;
        delete payload.nomor_peserta_ujian;

        await api.post('/users', payload);
        toast.success('User berhasil dibuat');
      }
      setOpen(false); refresh();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menyimpan');
    }
  };

  const handleDelete = async (u) => {
    if (!window.confirm(`Hapus user ${u.username}?`)) return;
    try { await api.delete(`/users/${u.id}`); toast.success('User dihapus'); refresh(); }
    catch (e) { toast.error('Gagal menghapus'); }
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

  // Filter out siswa - they have their own menu (Pengguna Siswa)
  const nonSiswaUsers = users.filter((u) => !(u.roles || []).includes('siswa'));

  const filtered = nonSiswaUsers.filter((u) => {
    if (activeTab !== 'all' && !(u.roles || []).includes(activeTab)) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return u.username?.toLowerCase().includes(s) || u.full_name?.toLowerCase().includes(s);
  });

  // Counts per role for badges
  const roleCounts = ROLE_TABS.reduce((acc, t) => {
    if (t.value === 'all') acc[t.value] = nonSiswaUsers.length;
    else acc[t.value] = nonSiswaUsers.filter((u) => (u.roles || []).includes(t.value)).length;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2"><Users className="h-3 w-3 mr-1" /> Manajemen Pengguna</Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Kelola Pengguna (GTK & Staff)</h1>
          <p className="text-sm text-slate-600 mt-1">{nonSiswaUsers.length} pengguna terdaftar (tidak termasuk siswa)</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={openCreate} className="bg-[#006837] hover:bg-[#0B7A3B] gap-2" data-testid="add-user-button">
            <Plus className="h-4 w-4" /> Tambah Pengguna
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto">
          <TabsList className="bg-white border border-slate-200 inline-flex w-auto min-w-full" data-testid="user-role-tabs">
            {ROLE_TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} data-testid={`user-tab-${t.value}`} className="gap-2 whitespace-nowrap">
                {t.label} <Badge variant="secondary" className="ml-1 px-1.5 text-xs">{roleCounts[t.value] || 0}</Badge>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value={activeTab} className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="p-4 border-b border-slate-100 flex items-center gap-2">
                {/* Hidden dummy fields to prevent browser autofill on search field */}
                <input type="text" name="fake-username" autoComplete="username" style={{ display: 'none' }} tabIndex={-1} aria-hidden="true" />
                <input type="password" name="fake-password" autoComplete="current-password" style={{ display: 'none' }} tabIndex={-1} aria-hidden="true" />
                <Search className="h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Cari nama atau username..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="max-w-sm"
                  data-testid="user-search-input"
                  autoComplete="off"
                  name="users-search-query"
                  type="search"
                />
              </div>
              <div className="overflow-x-auto">
                <Table data-testid="admin-users-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">ID</TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead>Nama Lengkap</TableHead>
                      <TableHead>NIP/Peg ID</TableHead>
                      <TableHead>Jabatan</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Peran</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((u) => {
                      const isStaff = u.roles?.some(r => ['guru', 'wali_kelas', 'tenaga_kependidikan', 'guru_piket', 'guru_bk', 'guru_tata_tertib', 'guru_ekstrakurikuler', 'admin'].includes(r));

                      // Get user's jabatan names
                      const userJabatanNames = u.jabatan_ids?.map(jid => {
                        const j = jabatanList.find(jab => jab.id === jid);
                        return j?.name;
                      }).filter(Boolean) || [];

                      return (
                        <TableRow key={u.id} data-testid={`user-row-${u.username}`}>
                          <TableCell className="font-mono text-xs text-slate-500">
                            {u.id ? u.id.substring(0, 8) : '-'}
                          </TableCell>
                          <TableCell className="font-mono">{u.username}</TableCell>
                          <TableCell className="font-medium">{u.full_name}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {isStaff && u.nip_nuptk ? (
                              <span className="text-slate-700">{u.nip_nuptk}</span>
                            ) : (
                              <span className="italic text-slate-400">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {userJabatanNames.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {userJabatanNames.map((jName, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs">{jName}</Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="italic text-slate-400 text-xs">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-slate-600">{u.email || <span className="italic text-slate-400">-</span>}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {u.roles?.map((r) => (
                                <Badge key={r} variant="secondary" className="text-xs">{ROLE_LABELS[r] || r}</Badge>
                              ))}
                            </div>
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
                              <Button size="sm" variant="outline" onClick={() => handleImpersonate(u)}
                                disabled={impersonatingUserId !== null}
                                className="gap-1 border-blue-400 text-blue-700 hover:bg-blue-50"
                                data-testid={`impersonate-user-${u.username}`}
                                title="Login sebagai user ini">
                                {impersonatingUserId === u.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogIn className="h-3.5 w-3.5" />}
                                Login Sebagai
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => openEdit(u)} data-testid={`edit-user-${u.username}`}><Pencil className="h-4 w-4" /></Button>
                              <Button size="icon" variant="ghost" onClick={() => handleDelete(u)} className="text-rose-600 hover:text-rose-700" data-testid={`delete-user-${u.username}`}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filtered.length === 0 && (
                      <TableRow><TableCell colSpan={9} className="text-center py-8 text-slate-500">Tidak ada pengguna ditemukan</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Pengguna' : 'Tambah Pengguna Baru'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
            {!editing && (
              <div className="sm:col-span-2">
                <Label>Pengguna GTK belum memiliki akun</Label>
                <Select
                  value={form.gtk_source_user_id || ''}
                  onValueChange={(v) => {
                    if (v === '__none') return;
                    const selected = gtkWithoutAccount.find((g) => g.id === v);
                    setForm((prev) => ({
                      ...prev,
                      gtk_source_user_id: v,
                      full_name: selected?.full_name || prev.full_name,
                      gender: selected?.gender || prev.gender,
                      birth_place: selected?.birth_place || prev.birth_place,
                      birth_date: selected?.birth_date || prev.birth_date,
                      email: selected?.email || prev.email,
                      phone: selected?.phone || prev.phone,
                      roles: (selected?.roles || prev.roles).filter((r) => !['siswa', 'alumni'].includes(r)),
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih GTK yang belum memiliki akun..." />
                  </SelectTrigger>
                  <SelectContent>
                    {gtkWithoutAccount.length === 0 ? (
                      <SelectItem value="__none">Tidak ada GTK yang belum memiliki akun</SelectItem>
                    ) : (
                      gtkWithoutAccount.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.full_name || '(Tanpa Nama)'} {g.nip_nuptk ? `- ${g.nip_nuptk}` : ''}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

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
              <Input value={form.full_name} disabled readOnly data-testid="user-form-fullname" />
            </div>
            <div>
              <Label>Jenis Kelamin</Label>
              <Input
                value={form.gender === 'L' ? 'Laki-laki' : form.gender === 'P' ? 'Perempuan' : ''}
                disabled
                readOnly
                placeholder="-"
              />
            </div>
            <div><Label>Tempat Lahir</Label><Input value={form.birth_place || ''} disabled readOnly /></div>
            <div><Label>Tgl Lahir</Label><Input type="date" value={form.birth_date || ''} disabled readOnly /></div>
            <div><Label>Email</Label><Input value={form.email || ''} disabled readOnly /></div>
            <div><Label>HP</Label><Input value={form.phone || ''} disabled readOnly /></div>
            <div className="sm:col-span-2">
              <Label>Peran (boleh lebih dari satu) *</Label>
              <div className="grid grid-cols-2 gap-2 mt-2 max-h-56 overflow-y-auto p-2 border border-slate-200 rounded-lg">
                {roles
                  .filter((r) => !['siswa', 'alumni'].includes(r.value))
                  .map((r) => (
                    <label key={r.value} className="flex items-center gap-2 cursor-pointer text-sm" data-testid={`role-checkbox-${r.value}`}>
                      <Checkbox checked={form.roles.includes(r.value)} onCheckedChange={() => toggleRole(r.value)} />
                      <span>{r.label}</span>
                    </label>
                  ))}
              </div>
            </div>
            {(form.roles.includes('guru') || form.roles.includes('tenaga_kependidikan')) && (
              <div className="sm:col-span-2">
                <Label>Jabatan (boleh lebih dari satu)</Label>
                <div className="grid grid-cols-2 gap-2 mt-2 max-h-40 overflow-y-auto p-2 border border-slate-200 rounded-lg">
                  {jabatanList.length === 0 ? (
                    <p className="text-sm text-slate-400 col-span-2 py-2">Belum ada jabatan. Kelola di menu Jabatan.</p>
                  ) : (
                    jabatanList.map((j) => (
                      <label key={j.id} className="flex items-center gap-2 cursor-pointer text-sm">
                        <Checkbox checked={form.jabatan_ids.includes(j.id)} onCheckedChange={() => toggleJabatan(j.id)} />
                        <span>{j.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}
            {form.roles.includes('wali_kelas') && (
              <div className="sm:col-span-2">
                <Label>Wali Kelas dari</Label>
                <Select value={form.homeroom_class_id || ''} onValueChange={(v) => setForm({ ...form, homeroom_class_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Pilih kelas..." /></SelectTrigger>
                  <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
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
