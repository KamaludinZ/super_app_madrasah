import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Edit2, Trash2, Plus, Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

const AdminTatibPenangananPage = () => {
  const [penangananList, setPenangananList] = useState([]);
  const [studentsList, setStudentsList] = useState([]);
  const [aturanList, setAturanList] = useState([]);
  const [kategoriList, setKategoriList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingPenanganan, setEditingPenanganan] = useState(null);

  // Filters
  const [filterSiswa, setFilterSiswa] = useState('');
  const [filterTipe, setFilterTipe] = useState(''); // 'pelanggaran' or 'prestasi'
  const [filterKategori, setFilterKategori] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Form
  const [penangananForm, setPenangananForm] = useState({
    siswa_id: '',
    aturan_id: '',
    tanggal: new Date().toISOString().split('T')[0],
    keterangan: '',
    penanganan_oleh: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [penangananRes, studentsRes, aturanRes, kategoriRes] = await Promise.all([
        api.get('/tatib/penanganan'),
        api.get('/students'),
        api.get('/tatib/aturan'),
        api.get('/tatib/kategori'),
      ]);
      setPenangananList(penangananRes.data || []);
      setStudentsList(studentsRes.data || []);
      setAturanList(aturanRes.data || []);
      setKategoriList(kategoriRes.data || []);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (penanganan = null) => {
    if (penanganan) {
      setEditingPenanganan(penanganan);
      setPenangananForm({
        siswa_id: penanganan.siswa_id,
        aturan_id: penanganan.aturan_id,
        tanggal: penanganan.tanggal,
        keterangan: penanganan.keterangan || '',
        penanganan_oleh: penanganan.penanganan_oleh || '',
      });
    } else {
      setEditingPenanganan(null);
      setPenangananForm({
        siswa_id: '',
        aturan_id: '',
        tanggal: new Date().toISOString().split('T')[0],
        keterangan: '',
        penanganan_oleh: '',
      });
    }
    setShowModal(true);
  };

  const handleSavePenanganan = async () => {
    if (!penangananForm.siswa_id || !penangananForm.aturan_id || !penangananForm.tanggal) {
      toast.error('Siswa, aturan, dan tanggal wajib diisi');
      return;
    }

    setSaving(true);
    try {
      if (editingPenanganan) {
        await api.put(`/tatib/penanganan/${editingPenanganan.id}`, penangananForm);
        toast.success('Penanganan berhasil diperbarui');
      } else {
        await api.post('/tatib/penanganan', penangananForm);
        toast.success('Penanganan berhasil ditambahkan');
      }
      setShowModal(false);
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menyimpan penanganan');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePenanganan = async (id) => {
    if (!window.confirm('Yakin ingin menghapus data penanganan ini?')) return;
    try {
      await api.delete(`/tatib/penanganan/${id}`);
      toast.success('Penanganan berhasil dihapus');
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menghapus penanganan');
    }
  };

  const getStudentName = (id) => {
    const student = studentsList.find(s => s.id === id);
    return student ? student.nama : '-';
  };

  const getStudentNIS = (id) => {
    const student = studentsList.find(s => s.id === id);
    return student ? student.nis : '-';
  };

  const getAturanInfo = (id) => {
    const aturan = aturanList.find(a => a.id === id);
    return aturan || { kode: '-', nama_aturan: '-', poin: 0, kategori_id: '' };
  };

  const getKategoriName = (id) => {
    const kat = kategoriList.find(k => k.id === id);
    return kat ? kat.nama : '-';
  };

  // Filter penanganan list
  const filteredPenanganan = penangananList.filter(p => {
    if (filterSiswa && p.siswa_id !== filterSiswa) return false;

    const aturan = getAturanInfo(p.aturan_id);
    if (filterTipe === 'pelanggaran' && aturan.poin >= 0) return false;
    if (filterTipe === 'prestasi' && aturan.poin < 0) return false;
    if (filterKategori && aturan.kategori_id !== filterKategori) return false;

    if (searchQuery) {
      const siswaName = getStudentName(p.siswa_id).toLowerCase();
      const siswaNIS = getStudentNIS(p.siswa_id).toLowerCase();
      const aturanNama = aturan.nama_aturan.toLowerCase();
      const query = searchQuery.toLowerCase();
      if (!siswaName.includes(query) && !siswaNIS.includes(query) && !aturanNama.includes(query)) {
        return false;
      }
    }

    return true;
  });

  // Get available aturan based on tipe filter
  const getFilteredAturanForForm = () => {
    if (!filterTipe) return aturanList;
    if (filterTipe === 'pelanggaran') return aturanList.filter(a => a.poin < 0);
    if (filterTipe === 'prestasi') return aturanList.filter(a => a.poin >= 0);
    return aturanList;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Input Penanganan Tatib</h1>
        <Button onClick={() => handleOpenModal()}>
          <Plus className="h-4 w-4 mr-2" />
          Tambah Penanganan
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Tipe</Label>
              <Select value={filterTipe || "all"} onValueChange={(v) => setFilterTipe(v === "all" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Semua Tipe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Tipe</SelectItem>
                  <SelectItem value="pelanggaran">Pelanggaran</SelectItem>
                  <SelectItem value="prestasi">Prestasi</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Kategori</Label>
              <Select value={filterKategori || "all"} onValueChange={(v) => setFilterKategori(v === "all" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Semua Kategori" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kategori</SelectItem>
                  {kategoriList.map(k => (
                    <SelectItem key={k.id} value={k.id}>{k.nama}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Siswa</Label>
              <Select value={filterSiswa || "all"} onValueChange={(v) => setFilterSiswa(v === "all" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Semua Siswa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Siswa</SelectItem>
                  {studentsList.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.nis} - {s.nama}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Cari (Nama/NIS/Aturan)</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Cari siswa atau aturan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center items-center p-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">Memuat data...</span>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>NIS</TableHead>
                  <TableHead>Nama Siswa</TableHead>
                  <TableHead>Kode</TableHead>
                  <TableHead>Aturan</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead className="text-right">Poin</TableHead>
                  <TableHead>Penanganan Oleh</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPenanganan.map(p => {
                  const aturan = getAturanInfo(p.aturan_id);
                  return (
                    <TableRow key={p.id}>
                      <TableCell>{p.tanggal}</TableCell>
                      <TableCell>{getStudentNIS(p.siswa_id)}</TableCell>
                      <TableCell>{getStudentName(p.siswa_id)}</TableCell>
                      <TableCell className="font-bold">{aturan.kode}</TableCell>
                      <TableCell>{aturan.nama_aturan}</TableCell>
                      <TableCell>{getKategoriName(aturan.kategori_id)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={aturan.poin >= 0 ? 'default' : 'destructive'}>
                          {aturan.poin >= 0 ? `+${aturan.poin}` : aturan.poin}
                        </Badge>
                      </TableCell>
                      <TableCell>{p.penanganan_oleh || '-'}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={() => handleOpenModal(p)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDeletePenanganan(p.id)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredPenanganan.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                      Belum ada data penanganan
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingPenanganan ? 'Edit Penanganan' : 'Tambah Penanganan'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Siswa*</Label>
              <Select
                value={penangananForm.siswa_id || "none"}
                onValueChange={(v) => setPenangananForm({ ...penangananForm, siswa_id: v === "none" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Siswa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Pilih Siswa</SelectItem>
                  {studentsList.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nis} - {s.nama} ({s.kelas})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Aturan Tata Tertib*</Label>
              <Select
                value={penangananForm.aturan_id || "none"}
                onValueChange={(v) => setPenangananForm({ ...penangananForm, aturan_id: v === "none" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Aturan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Pilih Aturan</SelectItem>
                  {getFilteredAturanForForm().map(a => {
                    const kategori = getKategoriName(a.kategori_id);
                    const tipe = a.poin >= 0 ? 'Prestasi' : 'Pelanggaran';
                    return (
                      <SelectItem key={a.id} value={a.id}>
                        [{a.kode}] {a.nama_aturan} - {kategori} ({tipe}: {a.poin >= 0 ? `+${a.poin}` : a.poin})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Tanggal*</Label>
              <Input
                type="date"
                value={penangananForm.tanggal}
                onChange={(e) => setPenangananForm({ ...penangananForm, tanggal: e.target.value })}
              />
            </div>

            <div>
              <Label>Ditangani Oleh</Label>
              <Input
                value={penangananForm.penanganan_oleh}
                onChange={(e) => setPenangananForm({ ...penangananForm, penanganan_oleh: e.target.value })}
                placeholder="Nama guru/petugas yang menangani"
              />
            </div>

            <div>
              <Label>Keterangan</Label>
              <Textarea
                value={penangananForm.keterangan}
                onChange={(e) => setPenangananForm({ ...penangananForm, keterangan: e.target.value })}
                placeholder="Keterangan tambahan (opsional)"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Batal
            </Button>
            <Button onClick={handleSavePenanganan} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminTatibPenangananPage;
