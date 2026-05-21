import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Calendar, Check, Trash2, Pencil } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const SEMESTER_OPTIONS = {
  regular: [
    { code: 'ganjil', name: 'Ganjil' },
    { code: 'genap', name: 'Genap' },
  ],
  accelerated: [
    { code: '1', name: 'Semester 1' },
    { code: '2', name: 'Semester 2' },
    { code: '3', name: 'Semester 3' },
    { code: '4', name: 'Semester 4' },
    { code: '5', name: 'Semester 5' },
    { code: '6', name: 'Semester 6' },
  ],
};

export default function AdminSemestersPage() {
  const [items, setItems] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [tahunTakwimList, setTahunTakwimList] = useState([]);
  const [curriculums, setCurriculums] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: '',
    code: 'ganjil',
    codes: [],
    academic_year_id: '',
    tahun_takwim_id: '',
    semester_type: 'regular',
    curriculum_id: '',
    start_date: '',
    end_date: '',
    is_active: false,
  });

  const refresh = async () => {
    const [{ data: sems }, { data: ays }, { data: curs }, { data: tts }] = await Promise.all([
      api.get('/semesters'),
      api.get('/academic-years'),
      api.get('/curriculums'),
      api.get('/tahun-takwim'),
    ]);
    setItems(sems);
    setAcademicYears(ays || []);
    setCurriculums(curs || []);
    setTahunTakwimList(tts || []);
  };

  useEffect(() => {
    refresh();
  }, []);

  const ayById = (id) => academicYears.find((ay) => ay.id === id);

  const openCreate = () => {
    setEditing(null);
    const activeAY = academicYears.find((ay) => ay.is_active);
    const activeTT = tahunTakwimList.find((tt) => tt.is_active);
    setForm({
      name: 'Ganjil',
      code: 'ganjil',
      codes: [],
      academic_year_id: activeAY?.id || '',
      tahun_takwim_id: activeTT?.id || '',
      semester_type: 'regular',
      curriculum_id: '',
      start_date: '',
      end_date: '',
      is_active: false,
    });
    setOpen(true);
  };

  const openEdit = (sem) => {
    setEditing(sem);
    setForm({
      name: sem.name,
      code: sem.code,
      codes: sem.codes || [],
      academic_year_id: sem.academic_year_id,
      tahun_takwim_id: sem.tahun_takwim_id || '',
      semester_type: sem.semester_type || 'regular',
      curriculum_id: sem.curriculum_id || '',
      start_date: sem.start_date || '',
      end_date: sem.end_date || '',
      is_active: sem.is_active,
    });
    setOpen(true);
  };

  const onSemesterCodeChange = (code) => {
    const semOptions = SEMESTER_OPTIONS[form.semester_type];
    const selected = semOptions.find((s) => s.code === code);
    setForm({
      ...form,
      code,
      name: selected?.name || code,
    });
  };

  const handleSubmit = async () => {
    if (!form.name || !form.code || !form.academic_year_id) {
      toast.error('Nama, kode, dan tahun pelajaran wajib diisi');
      return;
    }

    try {
      if (editing) {
        await api.put(`/semesters/${editing.id}`, form);
        toast.success('Semester diperbarui');
      } else {
        await api.post('/semesters', form);
        toast.success('Semester ditambahkan');
      }
      setOpen(false);
      refresh();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menyimpan');
    }
  };

  const handleActivate = async (sem) => {
    if (!window.confirm(`Aktifkan semester ${sem.name} - ${sem.academic_year_name}?`)) return;
    try {
      await api.post(`/semesters/${sem.id}/activate`);
      toast.success('Semester diaktifkan');
      refresh();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal mengaktifkan');
    }
  };

  const handleDelete = async (sem) => {
    if (!window.confirm(`Hapus semester ${sem.name}?`)) return;
    try {
      await api.delete(`/semesters/${sem.id}`);
      toast.success('Semester dihapus');
      refresh();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menghapus');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <Calendar className="h-3 w-3 mr-1" /> Semester
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold">Kelola Semester</h1>
          <p className="text-sm text-slate-600 mt-1">
            Semester terpisah dari Tahun Pelajaran untuk fleksibilitas. Hanya 1 semester yang aktif di sistem.
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="bg-[#006837] hover:bg-[#0B7A3B] gap-2"
          data-testid="add-semester-button"
        >
          <Plus className="h-4 w-4" /> Tambah Semester
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Kode</TableHead>
                  <TableHead>Tahun Takwim</TableHead>
                  <TableHead>Tahun Pelajaran</TableHead>
                  <TableHead>Kurikulum</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead>Periode</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((sem) => {
                  // Get Tahun Takwim from semester itself
                  const tt = tahunTakwimList.find(t => t.id === sem.tahun_takwim_id);

                  return (
                    <TableRow key={sem.id} data-testid={`semester-row-${sem.code}`}>
                      <TableCell className="font-semibold">{sem.name}</TableCell>
                      <TableCell>
                        {sem.codes && sem.codes.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {sem.codes.map(c => (
                              <Badge key={c} variant="outline" className="font-mono text-[10px]">
                                {c}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <Badge variant="outline" className="font-mono">
                            {sem.code}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {tt ? (
                          <span className="text-xs font-mono text-slate-600">{tt.year}</span>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {sem.academic_year_name ? (
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {sem.academic_year_name}
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </TableCell>
                    <TableCell>
                      {sem.curriculum_name ? (
                        <Badge variant="outline" className="text-[10px]">
                          {sem.curriculum_code}
                        </Badge>
                      ) : (
                        <span className="text-xs text-slate-400 italic">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize text-xs">
                        {sem.semester_type === 'accelerated' ? 'Percepatan' : 'Regular'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      {sem.start_date && sem.end_date ? (
                        <span>
                          {sem.start_date} s/d {sem.end_date}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Belum diset</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {sem.is_active ? (
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                          Aktif
                        </Badge>
                      ) : (
                        <Badge variant="outline">Arsip</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEdit(sem)}
                        className="gap-1 mr-1"
                        data-testid={`edit-semester-${sem.code}`}
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                      {!sem.is_active && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleActivate(sem)}
                          className="gap-1 mr-1"
                          data-testid={`activate-semester-${sem.code}`}
                        >
                          <Check className="h-3.5 w-3.5" /> Aktifkan
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDelete(sem)}
                        className="text-rose-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Semester' : 'Tambah Semester'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tahun Takwim *</Label>
              <Select value={form.tahun_takwim_id} onValueChange={(v) => setForm({ ...form, tahun_takwim_id: v })}>
                <SelectTrigger data-testid="semester-form-tt">
                  <SelectValue placeholder="Pilih tahun takwim..." />
                </SelectTrigger>
                <SelectContent>
                  {tahunTakwimList.map((tt) => (
                    <SelectItem key={tt.id} value={tt.id}>
                      {tt.year} - {tt.name} {tt.is_active && <span className="text-green-600">(Aktif)</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 mt-1">
                Pilih 1 tahun takwim untuk semester ini
              </p>
            </div>

            <div>
              <Label>Tahun Pelajaran *</Label>
              <Select value={form.academic_year_id} onValueChange={(v) => setForm({ ...form, academic_year_id: v })}>
                <SelectTrigger data-testid="semester-form-ay">
                  <SelectValue placeholder="Pilih tahun pelajaran..." />
                </SelectTrigger>
                <SelectContent>
                  {academicYears.map((ay) => (
                    <SelectItem key={ay.id} value={ay.id}>
                      {ay.name} {ay.is_active && <span className="text-green-600">(Aktif)</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Tipe Semester *</Label>
              <Select value={form.semester_type} onValueChange={(v) => setForm({ ...form, semester_type: v })}>
                <SelectTrigger data-testid="semester-form-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="regular">Regular (Ganjil/Genap)</SelectItem>
                  <SelectItem value="accelerated">Percepatan (1-6)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Kode Semester - Single select untuk regular, multi-select untuk percepatan */}
            {form.semester_type === 'regular' ? (
              <div>
                <Label>Kode Semester *</Label>
                <Select value={form.code} onValueChange={onSemesterCodeChange}>
                  <SelectTrigger data-testid="semester-form-code">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEMESTER_OPTIONS[form.semester_type].map((opt) => (
                      <SelectItem key={opt.code} value={opt.code}>
                        {opt.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <Label>Kode Semester * (bisa pilih lebih dari 1)</Label>
                <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
                  {SEMESTER_OPTIONS[form.semester_type].map((opt) => (
                    <label key={opt.code} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1.5 rounded">
                      <input
                        type="checkbox"
                        checked={form.codes.includes(opt.code)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            const newCodes = [...form.codes, opt.code].sort();
                            setForm({
                              ...form,
                              codes: newCodes,
                              code: newCodes[0] || opt.code, // Set primary code
                            });
                          } else {
                            const newCodes = form.codes.filter(c => c !== opt.code);
                            setForm({
                              ...form,
                              codes: newCodes,
                              code: newCodes[0] || '',
                            });
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm font-medium">{opt.name}</span>
                      <span className="text-xs text-slate-500">({opt.code})</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {form.codes.length > 0 ? `Dipilih: ${form.codes.join(', ')}` : 'Pilih minimal 1 kode'}
                </p>
              </div>
            )}

            <div>
              <Label>Nama Semester *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ganjil"
                data-testid="semester-form-name"
              />
            </div>

            <div>
              <Label>Kurikulum</Label>
              <Select value={form.curriculum_id || '__none__'} onValueChange={(v) => setForm({ ...form, curriculum_id: v === '__none__' ? '' : v })}>
                <SelectTrigger data-testid="semester-form-curriculum">
                  <SelectValue placeholder="Pilih kurikulum (opsional)..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Tidak ada</SelectItem>
                  {curriculums.map((cur) => (
                    <SelectItem key={cur.id} value={cur.id}>
                      {cur.code} - {cur.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Tanggal Mulai</Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  data-testid="semester-form-start"
                />
              </div>
              <div>
                <Label>Tanggal Selesai</Label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  data-testid="semester-form-end"
                />
              </div>
            </div>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
              <span className="text-sm">Set sebagai semester aktif (akan menonaktifkan semester lain)</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSubmit} className="bg-[#006837]" data-testid="semester-form-submit">
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
