import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  ArrowRightLeft, UserPlus, UserMinus, Users, Briefcase,
  Calendar, Hash, FileText, ExternalLink, Loader2, GraduationCap, Plus, X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const TABS = [
  { value: 'siswa_masuk', label: 'Siswa Masuk', icon: UserPlus, role_group: 'siswa', mutation_type: 'masuk', color: 'text-blue-700' },
  { value: 'siswa_keluar', label: 'Siswa Keluar', icon: UserMinus, role_group: 'siswa', mutation_type: 'keluar', color: 'text-rose-700' },
  { value: 'staff_masuk', label: 'Guru/Tendik Masuk', icon: UserPlus, role_group: 'staff', mutation_type: 'masuk', color: 'text-emerald-700' },
  { value: 'staff_keluar', label: 'Guru/Tendik Keluar', icon: UserMinus, role_group: 'staff', mutation_type: 'keluar', color: 'text-amber-700' },
];

const KELUAR_TYPES = [
  { value: 'pindah', label: 'Pindah' },
  { value: 'keluar', label: 'Keluar' },
  { value: 'pensiun', label: 'Pensiun' },
  { value: 'berhenti', label: 'Berhenti' },
];

export default function AdminMutationsPage() {
  const [tab, setTab] = useState('siswa_masuk');
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const [activeAY, setActiveAY] = useState(null);

  // Modal states
  const [masukDialogOpen, setMasukDialogOpen] = useState(false);
  const [keluarDialogOpen, setKeluarDialogOpen] = useState(false);
  const [currentRoleGroup, setCurrentRoleGroup] = useState('siswa');

  // Form states for mutasi masuk
  const [masukForm, setMasukForm] = useState({
    full_name: '',
    mutation_date: '',
    mutation_note: '',
    mutation_document_url: '',
    // Siswa
    nisn: '',
    nis: '',
    gender: '',
    birth_place: '',
    birth_date: '',
    address: '',
    class_id: '',
    // Staff
    nip_nuptk: '',
    email: '',
    phone: '',
    roles: [],
  });

  // Form states for mutasi keluar
  const [keluarForm, setKeluarForm] = useState({
    user_id: '',
    mutation_date: '',
    mutation_note: '',
    mutation_keluar_type: '',
    mutation_destination: '',
    mutation_document_url: '',
  });

  const [classes, setClasses] = useState([]);
  const [eligibleUsers, setEligibleUsers] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get('/academic-years/active').then(({ data }) => setActiveAY(data)).catch(() => {});
    loadClasses();
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

  const loadClasses = async () => {
    try {
      const res = await api.get('/classes');
      setClasses(res.data);
    } catch (e) {
      console.error('Failed to load classes');
    }
  };

  const loadEligibleUsers = async (roleGroup) => {
    try {
      const res = await api.get('/admin/mutations/eligible-users', { params: { role_group: roleGroup } });
      setEligibleUsers(res.data);
    } catch (e) {
      toast.error('Gagal memuat data pengguna');
    }
  };

  const counts = TABS.reduce((acc, t) => {
    acc[t.value] = data[t.value]?.length || 0;
    return acc;
  }, {});

  const openMasukDialog = (roleGroup) => {
    setCurrentRoleGroup(roleGroup);
    setMasukForm({
      full_name: '',
      mutation_date: '',
      mutation_note: '',
      mutation_document_url: '',
      nisn: '',
      nis: '',
      gender: '',
      birth_place: '',
      birth_date: '',
      address: '',
      class_id: '',
      nip_nuptk: '',
      email: '',
      phone: '',
      roles: [],
    });
    setMasukDialogOpen(true);
  };

  const openKeluarDialog = (roleGroup) => {
    setCurrentRoleGroup(roleGroup);
    setKeluarForm({
      user_id: '',
      mutation_date: '',
      mutation_note: '',
      mutation_keluar_type: '',
      mutation_destination: '',
      mutation_document_url: '',
    });
    loadEligibleUsers(roleGroup);
    setKeluarDialogOpen(true);
  };

  const handleMasukSubmit = async () => {
    if (!masukForm.full_name || !masukForm.mutation_date) {
      toast.error('Nama lengkap dan tanggal mutasi wajib diisi');
      return;
    }

    // Validation for siswa
    if (currentRoleGroup === 'siswa' && !masukForm.nisn && !masukForm.nis) {
      toast.error('NISN atau NIS wajib diisi');
      return;
    }

    // Validation for staff
    if (currentRoleGroup === 'staff' && !masukForm.nip_nuptk) {
      toast.error('NIP/NUPTK wajib diisi');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/admin/mutations/masuk', masukForm);
      toast.success('Mutasi masuk berhasil diproses');
      setMasukDialogOpen(false);
      // Reload data
      const cur = TABS.find((t) => t.value === tab);
      if (cur) {
        const { data: rows } = await api.get('/admin/mutations', {
          params: { mutation_type: cur.mutation_type, role_group: cur.role_group }
        });
        setData((prev) => ({ ...prev, [tab]: rows }));
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Gagal memproses mutasi masuk');
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeluarSubmit = async () => {
    if (!keluarForm.user_id || !keluarForm.mutation_date || !keluarForm.mutation_note) {
      toast.error('Semua field wajib diisi');
      return;
    }

    // Validation for staff
    if (currentRoleGroup === 'staff') {
      if (!keluarForm.mutation_keluar_type) {
        toast.error('Jenis mutasi keluar wajib dipilih');
        return;
      }
      if (keluarForm.mutation_keluar_type === 'pindah' && !keluarForm.mutation_destination) {
        toast.error('Instansi tujuan wajib diisi untuk mutasi pindah');
        return;
      }
    }

    setSubmitting(true);
    try {
      await api.post('/admin/mutations/keluar', keluarForm);
      toast.success('Mutasi keluar berhasil diproses. User telah di-nonaktifkan.');
      setKeluarDialogOpen(false);
      // Reload data
      const cur = TABS.find((t) => t.value === tab);
      if (cur) {
        const { data: rows } = await api.get('/admin/mutations', {
          params: { mutation_type: cur.mutation_type, role_group: cur.role_group }
        });
        setData((prev) => ({ ...prev, [tab]: rows }));
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Gagal memproses mutasi keluar');
    } finally {
      setSubmitting(false);
    }
  };

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
            {/* Action Button */}
            <div className="mb-4">
              {t.mutation_type === 'masuk' ? (
                <Button onClick={() => openMasukDialog(t.role_group)} className="gap-2 bg-[#006837] hover:bg-[#005028]">
                  <Plus className="h-4 w-4" />
                  Tambah Mutasi Masuk
                </Button>
              ) : (
                <Button onClick={() => openKeluarDialog(t.role_group)} className="gap-2 bg-rose-600 hover:bg-rose-700">
                  <UserMinus className="h-4 w-4" />
                  Proses Mutasi Keluar
                </Button>
              )}
            </div>

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
                          {t.mutation_type === 'keluar' && t.role_group === 'staff' && <TableHead>JENIS KELUAR</TableHead>}
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
                            {t.mutation_type === 'keluar' && t.role_group === 'staff' && (
                              <TableCell>
                                {u.mutation_keluar_type ? (
                                  <Badge variant="outline">{KELUAR_TYPES.find(kt => kt.value === u.mutation_keluar_type)?.label || u.mutation_keluar_type}</Badge>
                                ) : '-'}
                              </TableCell>
                            )}
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
                          <TableRow><TableCell colSpan={t.mutation_type === 'keluar' && t.role_group === 'staff' ? 8 : 7} className="text-center py-12 text-slate-500">
                            <ArrowRightLeft className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                            <div className="font-semibold">Belum ada data mutasi</div>
                            <div className="text-sm mt-1">Gunakan tombol di atas untuk menambah data mutasi</div>
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

      {/* Modal Mutasi Masuk */}
      <Dialog open={masukDialogOpen} onOpenChange={setMasukDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {currentRoleGroup === 'siswa' ? 'Form Mutasi Masuk Siswa' : 'Form Mutasi Masuk Guru/Tendik'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Nama Lengkap <span className="text-rose-600">*</span></Label>
                <Input value={masukForm.full_name} onChange={(e) => setMasukForm({ ...masukForm, full_name: e.target.value })} />
              </div>

              {currentRoleGroup === 'siswa' ? (
                <>
                  <div>
                    <Label>NISN <span className="text-rose-600">*</span></Label>
                    <Input value={masukForm.nisn} onChange={(e) => setMasukForm({ ...masukForm, nisn: e.target.value })} />
                  </div>
                  <div>
                    <Label>NIS</Label>
                    <Input value={masukForm.nis} onChange={(e) => setMasukForm({ ...masukForm, nis: e.target.value })} />
                  </div>
                  <div>
                    <Label>Jenis Kelamin</Label>
                    <Select value={masukForm.gender || undefined} onValueChange={(val) => setMasukForm({ ...masukForm, gender: val })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="L">Laki-laki</SelectItem>
                        <SelectItem value="P">Perempuan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Tanggal Lahir</Label>
                    <Input type="date" value={masukForm.birth_date} onChange={(e) => setMasukForm({ ...masukForm, birth_date: e.target.value })} />
                  </div>
                  <div>
                    <Label>Tempat Lahir</Label>
                    <Input value={masukForm.birth_place} onChange={(e) => setMasukForm({ ...masukForm, birth_place: e.target.value })} />
                  </div>
                  <div>
                    <Label>Kelas</Label>
                    <Select value={masukForm.class_id || undefined} onValueChange={(val) => setMasukForm({ ...masukForm, class_id: val })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih Kelas" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label>Alamat</Label>
                    <Textarea value={masukForm.address} onChange={(e) => setMasukForm({ ...masukForm, address: e.target.value })} rows={2} />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <Label>NIP/NUPTK <span className="text-rose-600">*</span></Label>
                    <Input value={masukForm.nip_nuptk} onChange={(e) => setMasukForm({ ...masukForm, nip_nuptk: e.target.value })} />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input type="email" value={masukForm.email} onChange={(e) => setMasukForm({ ...masukForm, email: e.target.value })} />
                  </div>
                  <div className="col-span-2">
                    <Label>No. Telepon</Label>
                    <Input value={masukForm.phone} onChange={(e) => setMasukForm({ ...masukForm, phone: e.target.value })} />
                  </div>
                </>
              )}

              <div>
                <Label>Tanggal Mutasi <span className="text-rose-600">*</span></Label>
                <Input type="date" value={masukForm.mutation_date} onChange={(e) => setMasukForm({ ...masukForm, mutation_date: e.target.value })} />
              </div>
              <div>
                <Label>Dokumen Pendukung (URL)</Label>
                <Input value={masukForm.mutation_document_url} onChange={(e) => setMasukForm({ ...masukForm, mutation_document_url: e.target.value })} placeholder="https://..." />
              </div>
              <div className="col-span-2">
                <Label>Keterangan/Catatan</Label>
                <Textarea value={masukForm.mutation_note} onChange={(e) => setMasukForm({ ...masukForm, mutation_note: e.target.value })} rows={3} />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setMasukDialogOpen(false)}>
                Batal
              </Button>
              <Button onClick={handleMasukSubmit} disabled={submitting} className="bg-[#006837] hover:bg-[#005028]">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Proses Mutasi Masuk
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Mutasi Keluar */}
      <Dialog open={keluarDialogOpen} onOpenChange={setKeluarDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {currentRoleGroup === 'siswa' ? 'Form Mutasi Keluar Siswa' : 'Form Mutasi Keluar Guru/Tendik'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>{currentRoleGroup === 'siswa' ? 'Pilih Siswa' : 'Pilih Guru/Tendik'} <span className="text-rose-600">*</span></Label>
                <Select value={keluarForm.user_id || undefined} onValueChange={(val) => setKeluarForm({ ...keluarForm, user_id: val })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih..." />
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.full_name} {u.nisn ? `(NISN: ${u.nisn})` : ''} {u.nip_nuptk ? `(NIP: ${u.nip_nuptk})` : ''} {u.class_name ? `- ${u.class_name}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {currentRoleGroup === 'staff' && (
                <>
                  <div className="col-span-2">
                    <Label>Jenis Mutasi Keluar <span className="text-rose-600">*</span></Label>
                    <Select value={keluarForm.mutation_keluar_type || undefined} onValueChange={(val) => setKeluarForm({ ...keluarForm, mutation_keluar_type: val })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih..." />
                      </SelectTrigger>
                      <SelectContent>
                        {KELUAR_TYPES.map((kt) => (
                          <SelectItem key={kt.value} value={kt.value}>{kt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {keluarForm.mutation_keluar_type === 'pindah' && (
                    <div className="col-span-2">
                      <Label>Instansi Tujuan <span className="text-rose-600">*</span></Label>
                      <Input value={keluarForm.mutation_destination} onChange={(e) => setKeluarForm({ ...keluarForm, mutation_destination: e.target.value })} placeholder="Nama sekolah/instansi tujuan" />
                    </div>
                  )}
                </>
              )}

              {currentRoleGroup === 'siswa' && (
                <div className="col-span-2">
                  <Label>Sekolah Tujuan</Label>
                  <Input value={keluarForm.mutation_destination} onChange={(e) => setKeluarForm({ ...keluarForm, mutation_destination: e.target.value })} placeholder="Nama sekolah tujuan (opsional)" />
                </div>
              )}

              <div>
                <Label>Tanggal Mutasi <span className="text-rose-600">*</span></Label>
                <Input type="date" value={keluarForm.mutation_date} onChange={(e) => setKeluarForm({ ...keluarForm, mutation_date: e.target.value })} />
              </div>
              <div>
                <Label>Dokumen Pendukung (URL)</Label>
                <Input value={keluarForm.mutation_document_url} onChange={(e) => setKeluarForm({ ...keluarForm, mutation_document_url: e.target.value })} placeholder="https://..." />
              </div>
              <div className="col-span-2">
                <Label>Alasan Mutasi <span className="text-rose-600">*</span></Label>
                <Textarea value={keluarForm.mutation_note} onChange={(e) => setKeluarForm({ ...keluarForm, mutation_note: e.target.value })} rows={3} placeholder="Jelaskan alasan mutasi keluar..." />
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              <strong>Perhatian:</strong> Proses mutasi keluar akan menonaktifkan user dan mengubah statusnya di sistem.
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setKeluarDialogOpen(false)}>
                Batal
              </Button>
              <Button onClick={handleKeluarSubmit} disabled={submitting} className="bg-rose-600 hover:bg-rose-700">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Proses Mutasi Keluar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
