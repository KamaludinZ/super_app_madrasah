import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Pencil, Trash2, Target, FileText, Search, Upload } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const SKP_EMPTY_FORM = {
  gtk_id: '',
  year: new Date().getFullYear(),
  kegiatan: '',
  angka_kredit: '',
  target_output_kuantitas: '',
  target_output_kualitas: '',
  target_waktu: '',
  biaya: '',
  status: 'draft',
};

const LCKB_EMPTY_FORM = {
  gtk_id: '',
  month: '',
  year: new Date().getFullYear(),
  kegiatan: '',
  hasil: '',
  keterangan: '',
  jumlah_jam: '',
};

const SKP_STATUS = [
  { value: 'draft', label: 'Draft', color: 'bg-slate-100 text-slate-700' },
  { value: 'submitted', label: 'Diajukan', color: 'bg-blue-100 text-blue-700' },
  { value: 'approved', label: 'Disetujui', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'rejected', label: 'Ditolak', color: 'bg-rose-100 text-rose-700' },
];

export default function AdminEKinerjaPage() {
  const [activeTab, setActiveTab] = useState('skp');
  const [gtkList, setGtkList] = useState([]);
  const [skpData, setSkpData] = useState([]);
  const [lckbData, setLckbData] = useState([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formSKP, setFormSKP] = useState(SKP_EMPTY_FORM);
  const [formLCKB, setFormLCKB] = useState(LCKB_EMPTY_FORM);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: usersData } = await api.get('/users');
      const gtk = usersData.filter(u =>
        u.roles?.some(r => ['guru', 'wali_kelas', 'tenaga_kependidikan'].includes(r))
      );
      setGtkList(gtk);

      // TODO: Load SKP and LCKB data from API
      setSkpData([]);
      setLckbData([]);
    } catch (e) {
      toast.error('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  const openCreateSKP = () => {
    setEditing(null);
    setFormSKP(SKP_EMPTY_FORM);
    setOpen(true);
  };

  const openCreateLCKB = () => {
    setEditing(null);
    setFormLCKB(LCKB_EMPTY_FORM);
    setOpen(true);
  };

  const handleSubmitSKP = () => {
    if (!formSKP.gtk_id || !formSKP.kegiatan) {
      toast.error('GTK dan kegiatan wajib diisi');
      return;
    }
    toast.info('Fitur simpan SKP sedang dalam pengembangan');
    setOpen(false);
  };

  const handleSubmitLCKB = () => {
    if (!formLCKB.gtk_id || !formLCKB.month || !formLCKB.kegiatan) {
      toast.error('GTK, bulan, dan kegiatan wajib diisi');
      return;
    }
    toast.info('Fitur simpan LCKB sedang dalam pengembangan');
    setOpen(false);
  };

  const handleDelete = (id) => {
    if (!window.confirm('Hapus data ini?')) return;
    toast.info('Fitur hapus sedang dalam pengembangan');
  };

  const filteredSKP = skpData.filter(s => {
    if (!search) return true;
    const gtk = gtkList.find(g => g.id === s.gtk_id);
    const name = gtk?.full_name?.toLowerCase() || '';
    const kegiatan = s.kegiatan?.toLowerCase() || '';
    return name.includes(search.toLowerCase()) || kegiatan.includes(search.toLowerCase());
  });

  const filteredLCKB = lckbData.filter(l => {
    if (!search) return true;
    const gtk = gtkList.find(g => g.id === l.gtk_id);
    const name = gtk?.full_name?.toLowerCase() || '';
    const kegiatan = l.kegiatan?.toLowerCase() || '';
    return name.includes(search.toLowerCase()) || kegiatan.includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <Target className="h-3 w-3 mr-1" /> E-Kinerja GTK
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">E-Kinerja GTK</h1>
          <p className="text-sm text-slate-600 mt-1">Manajemen SKP dan LCKB Guru & Tenaga Kependidikan</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white border border-slate-200">
          <TabsTrigger value="skp" className="gap-2">
            <Target className="h-4 w-4" /> SKP (Sasaran Kinerja Pegawai)
          </TabsTrigger>
          <TabsTrigger value="lckb" className="gap-2">
            <FileText className="h-4 w-4" /> LCKB (Laporan Capaian Kinerja Bulanan)
          </TabsTrigger>
        </TabsList>

        {/* TAB SKP */}
        <TabsContent value="skp" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Cari GTK atau kegiatan..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Button onClick={openCreateSKP} className="bg-[#006837] hover:bg-[#0B7A3B] gap-2">
                  <Plus className="h-4 w-4" /> Tambah SKP
                </Button>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>GTK</TableHead>
                      <TableHead>Tahun</TableHead>
                      <TableHead>Kegiatan Tugas Jabatan</TableHead>
                      <TableHead>AK</TableHead>
                      <TableHead>Target Output</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-slate-500">Memuat data...</TableCell>
                      </TableRow>
                    ) : filteredSKP.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                          Belum ada data SKP. Klik "Tambah SKP" untuk membuat data baru.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredSKP.map((skp) => {
                        const gtk = gtkList.find(g => g.id === skp.gtk_id);
                        const statusInfo = SKP_STATUS.find(s => s.value === skp.status);
                        return (
                          <TableRow key={skp.id}>
                            <TableCell className="font-medium">{gtk?.full_name || '-'}</TableCell>
                            <TableCell>{skp.year}</TableCell>
                            <TableCell>{skp.kegiatan}</TableCell>
                            <TableCell>{skp.angka_kredit || '-'}</TableCell>
                            <TableCell>
                              <div className="text-xs">
                                <div>Kuantitas: {skp.target_output_kuantitas || '-'}</div>
                                <div>Kualitas: {skp.target_output_kualitas || '-'}</div>
                                <div>Waktu: {skp.target_waktu || '-'}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={statusInfo?.color}>{statusInfo?.label || skp.status}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button size="icon" variant="ghost"><Pencil className="h-4 w-4" /></Button>
                                <Button size="icon" variant="ghost" onClick={() => handleDelete(skp.id)} className="text-rose-600">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB LCKB */}
        <TabsContent value="lckb" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Cari GTK atau kegiatan..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Button onClick={openCreateLCKB} className="bg-[#006837] hover:bg-[#0B7A3B] gap-2">
                  <Plus className="h-4 w-4" /> Tambah LCKB
                </Button>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>GTK</TableHead>
                      <TableHead>Periode</TableHead>
                      <TableHead>Kegiatan</TableHead>
                      <TableHead>Hasil</TableHead>
                      <TableHead>Jumlah Jam</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-slate-500">Memuat data...</TableCell>
                      </TableRow>
                    ) : filteredLCKB.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                          Belum ada data LCKB. Klik "Tambah LCKB" untuk membuat data baru.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredLCKB.map((lckb) => {
                        const gtk = gtkList.find(g => g.id === lckb.gtk_id);
                        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
                        const monthName = months[parseInt(lckb.month) - 1] || lckb.month;
                        return (
                          <TableRow key={lckb.id}>
                            <TableCell className="font-medium">{gtk?.full_name || '-'}</TableCell>
                            <TableCell>{monthName} {lckb.year}</TableCell>
                            <TableCell>{lckb.kegiatan}</TableCell>
                            <TableCell className="text-sm">{lckb.hasil}</TableCell>
                            <TableCell>{lckb.jumlah_jam || '-'} jam</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button size="icon" variant="ghost"><Pencil className="h-4 w-4" /></Button>
                                <Button size="icon" variant="ghost" onClick={() => handleDelete(lckb.id)} className="text-rose-600">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog untuk SKP */}
      {activeTab === 'skp' && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit SKP' : 'Tambah SKP Baru'}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>GTK *</Label>
                  <Select value={formSKP.gtk_id} onValueChange={(v) => setFormSKP({ ...formSKP, gtk_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Pilih GTK..." /></SelectTrigger>
                    <SelectContent>
                      {gtkList.map(g => (
                        <SelectItem key={g.id} value={g.id}>{g.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tahun</Label>
                  <Input type="number" value={formSKP.year} onChange={(e) => setFormSKP({ ...formSKP, year: e.target.value })} />
                </div>
              </div>

              <div>
                <Label>Kegiatan Tugas Jabatan *</Label>
                <Textarea value={formSKP.kegiatan} onChange={(e) => setFormSKP({ ...formSKP, kegiatan: e.target.value })} rows={2} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Angka Kredit</Label>
                  <Input value={formSKP.angka_kredit} onChange={(e) => setFormSKP({ ...formSKP, angka_kredit: e.target.value })} />
                </div>
                <div>
                  <Label>Biaya (Rp)</Label>
                  <Input type="number" value={formSKP.biaya} onChange={(e) => setFormSKP({ ...formSKP, biaya: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Target Kuantitas</Label>
                  <Input value={formSKP.target_output_kuantitas} onChange={(e) => setFormSKP({ ...formSKP, target_output_kuantitas: e.target.value })} placeholder="Mis. 100%" />
                </div>
                <div>
                  <Label>Target Kualitas</Label>
                  <Input value={formSKP.target_output_kualitas} onChange={(e) => setFormSKP({ ...formSKP, target_output_kualitas: e.target.value })} placeholder="Mis. 90" />
                </div>
                <div>
                  <Label>Target Waktu</Label>
                  <Input value={formSKP.target_waktu} onChange={(e) => setFormSKP({ ...formSKP, target_waktu: e.target.value })} placeholder="Mis. 12 bulan" />
                </div>
              </div>

              <div>
                <Label>Status</Label>
                <Select value={formSKP.status} onValueChange={(v) => setFormSKP({ ...formSKP, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SKP_STATUS.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
              <Button onClick={handleSubmitSKP} className="bg-[#006837] hover:bg-[#0B7A3B]">Simpan</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog untuk LCKB */}
      {activeTab === 'lckb' && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit LCKB' : 'Tambah LCKB Baru'}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div>
                <Label>GTK *</Label>
                <Select value={formLCKB.gtk_id} onValueChange={(v) => setFormLCKB({ ...formLCKB, gtk_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Pilih GTK..." /></SelectTrigger>
                  <SelectContent>
                    {gtkList.map(g => (
                      <SelectItem key={g.id} value={g.id}>{g.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Bulan *</Label>
                  <Select value={formLCKB.month} onValueChange={(v) => setFormLCKB({ ...formLCKB, month: v })}>
                    <SelectTrigger><SelectValue placeholder="Pilih bulan..." /></SelectTrigger>
                    <SelectContent>
                      {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map((m, i) => (
                        <SelectItem key={m} value={m}>{['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][i]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tahun</Label>
                  <Input type="number" value={formLCKB.year} onChange={(e) => setFormLCKB({ ...formLCKB, year: e.target.value })} />
                </div>
              </div>

              <div>
                <Label>Kegiatan *</Label>
                <Textarea value={formLCKB.kegiatan} onChange={(e) => setFormLCKB({ ...formLCKB, kegiatan: e.target.value })} rows={2} placeholder="Kegiatan yang dilakukan..." />
              </div>

              <div>
                <Label>Hasil</Label>
                <Textarea value={formLCKB.hasil} onChange={(e) => setFormLCKB({ ...formLCKB, hasil: e.target.value })} rows={2} placeholder="Hasil yang dicapai..." />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Jumlah Jam</Label>
                  <Input type="number" value={formLCKB.jumlah_jam} onChange={(e) => setFormLCKB({ ...formLCKB, jumlah_jam: e.target.value })} placeholder="Jam kerja" />
                </div>
                <div>
                  <Label>Keterangan</Label>
                  <Input value={formLCKB.keterangan} onChange={(e) => setFormLCKB({ ...formLCKB, keterangan: e.target.value })} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
              <Button onClick={handleSubmitLCKB} className="bg-[#006837] hover:bg-[#0B7A3B]">Simpan</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
