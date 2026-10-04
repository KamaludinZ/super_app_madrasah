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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Package, Plus, Pencil, Trash2, Loader2, Save, Search, AlertTriangle, XCircle, CalendarClock, CheckCircle2, ArrowDownCircle, ArrowUpCircle, Stethoscope } from 'lucide-react';
import { toast } from 'sonner';
import { confirmDialog } from '@/components/ui/confirm-dialog';
import { api } from '@/lib/api';




// Tanggal hari ini menurut WIB (UTC+7), sama dengan validasi backend.
const todayISO = () => new Date(Date.now() + 7 * 3600000).toISOString().split('T')[0];
const emptyMasukForm = () => ({ bmhp_id: '', tanggal: todayISO(), jumlah: 1, tanggal_kadaluarsa: '', sumber: '', keterangan: '' });

const validateMasuk = (form) => {
  const errors = {};
  if (!form.bmhp_id) errors.bmhp_id = 'Pilih BMHP terlebih dahulu';
  if (!form.tanggal) errors.tanggal = 'Tanggal wajib diisi';
  else if (form.tanggal > todayISO()) errors.tanggal = 'Tanggal tidak boleh melebihi hari ini';
  const jumlah = Number(form.jumlah);
  if (!Number.isInteger(jumlah) || jumlah < 1) errors.jumlah = 'Jumlah minimal 1';
  if (form.tanggal_kadaluarsa && form.tanggal && form.tanggal_kadaluarsa <= form.tanggal) {
    errors.tanggal_kadaluarsa = 'Tanggal kadaluarsa harus setelah tanggal masuk';
  }
  return errors;
};


const emptyBmhpForm = { nama_bmhp: '', jenis: '', satuan: 'pcs', stok_minimum: 0, keterangan: '' };

const JENIS_BMHP = ['Pembalut Luka', 'Antiseptik', 'APD', 'Alat Suntik & Infus', 'Alat Pemeriksaan', 'Lainnya'];
const SATUAN_BMHP = ['pcs', 'lembar', 'pasang', 'gulung', 'botol', 'box', 'pak'];

const validateForm = (form, list, editingId) => {
  const errors = {};
  const nama = form.nama_bmhp.trim();
  if (!nama) errors.nama_bmhp = 'Nama BMHP wajib diisi';
  else if (list.some((b) => b.id !== editingId && (b.nama_bmhp || '').trim().toLowerCase() === nama.toLowerCase())) {
    errors.nama_bmhp = 'Nama BMHP sudah terdaftar';
  }
  if (!form.satuan.trim()) errors.satuan = 'Satuan wajib diisi';
  const min = Number(form.stok_minimum);
  if (form.stok_minimum === '' || Number.isNaN(min) || min < 0 || !Number.isInteger(min)) {
    errors.stok_minimum = 'Stok minimum harus bilangan bulat 0 atau lebih';
  }
  return errors;
};

const KADALUARSA_WARNING_DAYS = 90;

// Status persediaan dihitung dari stok tersisa terhadap stok minimum.
const getStokStatus = (item) => {
  const sisa = item.stok_tersisa ?? 0;
  if (sisa <= 0) return { key: 'habis', label: 'Habis', className: 'bg-slate-200 text-slate-700 border-slate-300' };
  if (sisa <= (item.stok_minimum ?? 0)) return { key: 'menipis', label: 'Menipis', className: 'bg-rose-100 text-rose-700 border-rose-200' };
  return { key: 'aman', label: 'Aman', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
};

// Sisa hari menuju tanggal kadaluarsa terdekat; null jika tidak ada tanggal.
const daysToExpiry = (item) => {
  if (!item.tanggal_kadaluarsa_terdekat) return null;
  const today = new Date(new Date().toISOString().split('T')[0]);
  const exp = new Date(item.tanggal_kadaluarsa_terdekat);
  return Math.round((exp - today) / 86400000);
};

const getKadaluarsaInfo = (item) => {
  const days = daysToExpiry(item);
  if (days === null) return null;
  if (days < 0) return { key: 'lewat', label: 'Sudah kadaluarsa', className: 'text-rose-700' };
  if (days <= KADALUARSA_WARNING_DAYS) return { key: 'segera', label: `${days} hari lagi`, className: 'text-amber-700' };
  return null;
};

const STATUS_FILTERS = [
  { value: 'semua', label: 'Semua Status' },
  { value: 'aman', label: 'Aman' },
  { value: 'menipis', label: 'Menipis' },
  { value: 'habis', label: 'Habis' },
  { value: 'kadaluarsa', label: 'Kadaluarsa / Segera' },
];

function SummaryCard({ icon: Icon, label, value, tone }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${tone}`}><Icon className="h-5 w-5" /></div>
        <div>
          <div className="text-2xl font-bold text-slate-900">{value}</div>
          <div className="text-xs text-slate-500">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminUKSBMHPPage() {
  const [bmhpList, setBmhpList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('semua');

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyBmhpForm);
  const [errors, setErrors] = useState({});

  const [tab, setTab] = useState('daftar');
  const [masukList, setMasukList] = useState([]);
  const [showMasukModal, setShowMasukModal] = useState(false);
  const [masukForm, setMasukForm] = useState(emptyMasukForm);
  const [masukErrors, setMasukErrors] = useState({});

  const [keluarList, setKeluarList] = useState([]);
  const [keluarBulan, setKeluarBulan] = useState('semua');
  const [keluarBmhp, setKeluarBmhp] = useState('semua');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [bmhpRes, masukRes, keluarRes] = await Promise.all([
        api.get('/uks/bmhp'),
        api.get('/uks/bmhp-masuk'),
        api.get('/uks/bmhp-keluar'),
      ]);
      setBmhpList(bmhpRes.data || []);
      setMasukList(masukRes.data || []);
      setKeluarList(keluarRes.data || []);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal memuat data BMHP');
    } finally {
      setLoading(false);
    }
  };

  const setField = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const openModal = (item = null) => {
    if (item) {
      setEditing(item);
      setForm({
        nama_bmhp: item.nama_bmhp || '', jenis: item.jenis || '', satuan: item.satuan || 'pcs',
        stok_minimum: item.stok_minimum ?? 0, keterangan: item.keterangan || '',
      });
    } else {
      setEditing(null);
      setForm(emptyBmhpForm);
    }
    setErrors({});
    setShowModal(true);
  };

  const handleSave = async () => {
    const found = validateForm(form, bmhpList, editing?.id);
    setErrors(found);
    if (Object.keys(found).length) { toast.error('Periksa kembali isian form'); return; }
    setSaving(true);
    const payload = {
      nama_bmhp: form.nama_bmhp.trim(),
      jenis: form.jenis || null,
      satuan: form.satuan.trim(),
      keterangan: form.keterangan.trim() || null,
      stok_minimum: Number(form.stok_minimum),
    };
    try {
      if (editing) {
        await api.put(`/uks/bmhp/${editing.id}`, payload);
        toast.success('Data BMHP berhasil diperbarui');
      } else {
        await api.post('/uks/bmhp', payload);
        toast.success('Data BMHP berhasil ditambahkan');
      }
      setShowModal(false);
      loadData();
    } catch (e) {
      const detail = e?.response?.data?.detail;
      if (typeof detail === 'string' && detail.toLowerCase().includes('nama')) setErrors({ nama_bmhp: detail });
      toast.error(detail || 'Gagal menyimpan data BMHP');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (masukList.some((m) => m.bmhp_id === id) || keluarList.some((k) => k.bmhp_id === id)) {
      toast.error('BMHP sudah memiliki riwayat masuk/keluar sehingga tidak dapat dihapus');
      return;
    }
    if (!(await confirmDialog('Yakin ingin menghapus BMHP ini?'))) return;
    try {
      await api.delete(`/uks/bmhp/${id}`);
      toast.success('Data BMHP dihapus');
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menghapus data BMHP');
    }
  };

  const bmhpById = (id) => bmhpList.find((b) => b.id === id);

  const setMasukField = (key, value) => {
    setMasukForm((f) => ({ ...f, [key]: value }));
    setMasukErrors((e) => ({ ...e, [key]: undefined }));
  };

  const openMasukModal = (bmhpId = '') => {
    setMasukForm({ ...emptyMasukForm(), bmhp_id: bmhpId });
    setMasukErrors({});
    setShowMasukModal(true);
  };

  const handleSaveMasuk = async () => {
    const found = validateMasuk(masukForm);
    setMasukErrors(found);
    if (Object.keys(found).length) { toast.error('Periksa kembali isian form'); return; }
    setSaving(true);
    try {
      await api.post('/uks/bmhp-masuk', {
        bmhp_id: masukForm.bmhp_id,
        tanggal: masukForm.tanggal,
        jumlah: Number(masukForm.jumlah),
        tanggal_kadaluarsa: masukForm.tanggal_kadaluarsa || null,
        sumber: masukForm.sumber.trim() || null,
        keterangan: masukForm.keterangan.trim() || null,
      });
      toast.success('BMHP masuk berhasil dicatat');
      setShowMasukModal(false);
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menyimpan BMHP masuk');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMasuk = async (entry) => {
    if ((entry.stok_sisa ?? entry.jumlah) < entry.jumlah) {
      toast.error('Batch ini sudah terpakai sebagian sehingga tidak dapat dihapus');
      return;
    }
    if (!(await confirmDialog('Yakin ingin menghapus data ini? Stok akan disesuaikan kembali.'))) return;
    try {
      await api.delete(`/uks/bmhp-masuk/${entry.id}`);
      toast.success('Data BMHP masuk dihapus');
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menghapus BMHP masuk');
    }
  };

  const keluarBulanOptions = [...new Set(keluarList.map((k) => (k.tanggal || '').slice(0, 7)).filter(Boolean))].sort().reverse();
  const formatBulan = (ym) => new Date(`${ym}-01`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  const filteredKeluar = keluarList
    .filter((k) => keluarBulan === 'semua' || (k.tanggal || '').startsWith(keluarBulan))
    .filter((k) => keluarBmhp === 'semua' || k.bmhp_id === keluarBmhp)
    .sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));

  const totalKeluar = filteredKeluar.length;
  const totalKunjungan = new Set(filteredKeluar.map((k) => k.kunjungan_id)).size;

  const sortedMasuk = [...masukList].sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));

  const matchesStatus = (b) => {
    if (statusFilter === 'semua') return true;
    if (statusFilter === 'kadaluarsa') return !!getKadaluarsaInfo(b);
    return getStokStatus(b).key === statusFilter;
  };

  const filtered = bmhpList.filter((b) =>
    (!search || (b.nama_bmhp || '').toLowerCase().includes(search.toLowerCase())) && matchesStatus(b));

  const summary = {
    total: bmhpList.length,
    menipis: bmhpList.filter((b) => getStokStatus(b).key === 'menipis').length,
    habis: bmhpList.filter((b) => getStokStatus(b).key === 'habis').length,
    kadaluarsa: bmhpList.filter((b) => getKadaluarsaInfo(b)).length,
  };

  return (
    <div className="space-y-6" data-testid="admin-uks-bmhp-page">
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
          <Package className="h-3 w-3 mr-1" /> Menu UKS
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Data BMHP</h1>
        <p className="text-sm text-slate-600 mt-1">Kelola daftar Bahan Medis Habis Pakai (BMHP) sebagai aset lancar UKS</p>
      </div>


      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-white border border-slate-200">
          <TabsTrigger value="daftar"><Package className="h-4 w-4 mr-2" /> Daftar BMHP ({bmhpList.length})</TabsTrigger>
          <TabsTrigger value="masuk"><ArrowDownCircle className="h-4 w-4 mr-2" /> BMHP Masuk ({masukList.length})</TabsTrigger>
          <TabsTrigger value="keluar"><ArrowUpCircle className="h-4 w-4 mr-2" /> BMHP Keluar ({keluarList.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="daftar" className="mt-4 space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard icon={CheckCircle2} label="Total Jenis BMHP" value={summary.total} tone="bg-emerald-100 text-emerald-700" />
        <SummaryCard icon={AlertTriangle} label="Stok Menipis" value={summary.menipis} tone="bg-rose-100 text-rose-700" />
        <SummaryCard icon={XCircle} label="Stok Habis" value={summary.habis} tone="bg-slate-200 text-slate-700" />
        <SummaryCard icon={CalendarClock} label={`Kadaluarsa ≤ ${KADALUARSA_WARNING_DAYS} hari`} value={summary.kadaluarsa} tone="bg-amber-100 text-amber-700" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Cari nama BMHP..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => openModal()} className="gap-2 bg-[#006837] hover:bg-[#005830]">
          <Plus className="h-4 w-4" /> Tambah BMHP
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama BMHP</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead className="text-center">Stok Tersisa</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Stok Terpakai</TableHead>
                  <TableHead className="text-center">Stok Min</TableHead>
                  <TableHead>Kadaluarsa Terdekat</TableHead>
                  <TableHead>Keterangan</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-12 text-slate-500">
                    <Package className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                    {loading
                      ? <div className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin text-[#006837]" /> Memuat data...</div>
                      : <div className="font-semibold">{bmhpList.length === 0 ? 'Belum ada data BMHP' : 'Tidak ada BMHP yang cocok dengan filter'}</div>}
                  </TableCell></TableRow>
                ) : (
                  filtered.map((item) => {
                    const status = getStokStatus(item);
                    const kadaluarsa = getKadaluarsaInfo(item);
                    return (
                    <TableRow key={item.id}>
                      <TableCell className="font-semibold">{item.nama_bmhp}</TableCell>
                      <TableCell>{item.jenis || '-'}</TableCell>
                      <TableCell className="text-center">
                        <span className="font-mono font-semibold">{item.stok_tersisa ?? 0}</span>{' '}
                        <span className="text-slate-500">{item.satuan}</span>
                      </TableCell>
                      <TableCell className="text-center"><Badge className={status.className}>{status.label}</Badge></TableCell>
                      <TableCell className="text-center font-mono">{item.stok_terpakai ?? 0}</TableCell>
                      <TableCell className="text-center font-mono">{item.stok_minimum}</TableCell>
                      <TableCell>
                        <div className="font-mono">{item.tanggal_kadaluarsa_terdekat || '-'}</div>
                        {kadaluarsa && <div className={`text-xs font-medium ${kadaluarsa.className}`}>{kadaluarsa.label}</div>}
                      </TableCell>
                      <TableCell className="max-w-xs"><div className="line-clamp-2">{item.keterangan || '-'}</div></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openModal(item)} className="text-blue-600 hover:text-blue-700"><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDelete(item.id)} className="text-rose-600 hover:text-rose-700"><Trash2 className="h-4 w-4" /></Button>
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

        <TabsContent value="masuk" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => openMasukModal()} className="gap-2 bg-[#006837] hover:bg-[#005830]"><Plus className="h-4 w-4" /> Catat BMHP Masuk</Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>BMHP</TableHead>
                      <TableHead className="text-center">Jumlah</TableHead>
                      <TableHead>Kadaluarsa</TableHead>
                      <TableHead>Sumber</TableHead>
                      <TableHead>Petugas</TableHead>
                      <TableHead>Keterangan</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedMasuk.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center py-12 text-slate-500">Belum ada data BMHP masuk</TableCell></TableRow>
                    ) : (
                      sortedMasuk.map((item) => {
                        const bmhp = bmhpById(item.bmhp_id);
                        return (
                          <TableRow key={item.id}>
                            <TableCell className="font-mono">{item.tanggal}</TableCell>
                            <TableCell className="font-semibold">{bmhp?.nama_bmhp || item.bmhp_nama || '(BMHP terhapus)'}</TableCell>
                            <TableCell className="text-center"><Badge className="bg-emerald-100 text-emerald-700 border-emerald-200" title={`Sisa batch: ${item.stok_sisa ?? item.jumlah}`}>+{item.jumlah} {bmhp?.satuan || item.satuan || ''}</Badge></TableCell>
                            <TableCell className="font-mono">{item.tanggal_kadaluarsa || '-'}</TableCell>
                            <TableCell>{item.sumber || '-'}</TableCell>
                            <TableCell>{item.petugas_nama || '-'}</TableCell>
                            <TableCell className="max-w-xs"><div className="line-clamp-2">{item.keterangan || '-'}</div></TableCell>
                            <TableCell className="text-right">
                              <Button size="icon" variant="ghost" onClick={() => handleDeleteMasuk(item)} className="text-rose-600 hover:text-rose-700"><Trash2 className="h-4 w-4" /></Button>
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

        <TabsContent value="keluar" className="mt-4 space-y-4">
          <div className="flex items-start gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
            <Stethoscope className="h-4 w-4 mt-0.5 shrink-0" />
            <span>BMHP keluar tercatat otomatis dari penanganan kunjungan UKS, sehingga tidak diinput manual di sini.</span>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-3">
              <Select value={keluarBulan} onValueChange={setKeluarBulan}>
                <SelectTrigger className="sm:w-52"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="semua">Semua Bulan</SelectItem>
                  {keluarBulanOptions.map((ym) => <SelectItem key={ym} value={ym}>{formatBulan(ym)}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={keluarBmhp} onValueChange={setKeluarBmhp}>
                <SelectTrigger className="sm:w-60"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="semua">Semua BMHP</SelectItem>
                  {bmhpList.map((b) => <SelectItem key={b.id} value={b.id}>{b.nama_bmhp}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-slate-600">{totalKeluar} catatan dari {totalKunjungan} kunjungan</p>
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>BMHP</TableHead>
                      <TableHead className="text-center">Jumlah</TableHead>
                      <TableHead>Pasien</TableHead>
                      <TableHead>Keluhan (Kunjungan)</TableHead>
                      <TableHead>Petugas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredKeluar.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-12 text-slate-500">Belum ada data BMHP keluar pada filter ini</TableCell></TableRow>
                    ) : (
                      filteredKeluar.map((item) => {
                        const bmhp = bmhpById(item.bmhp_id);
                        return (
                          <TableRow key={item.id}>
                            <TableCell className="font-mono">{item.tanggal}</TableCell>
                            <TableCell className="font-semibold">{bmhp?.nama_bmhp || item.bmhp_nama || '(BMHP terhapus)'}</TableCell>
                            <TableCell className="text-center"><Badge className="bg-rose-100 text-rose-700 border-rose-200">-{item.jumlah} {bmhp?.satuan || item.satuan || ''}</Badge></TableCell>
                            <TableCell>
                              <div className="font-medium">{item.pasien_nama}</div>
                              <div className="text-xs text-slate-500">{item.pasien_tipe === 'gtk' ? 'GTK' : `Siswa${item.pasien_kelas ? ` · ${item.pasien_kelas}` : ''}`}</div>
                            </TableCell>
                            <TableCell className="max-w-xs"><div className="line-clamp-2">{item.keluhan || '-'}</div></TableCell>
                            <TableCell>{item.petugas_nama || '-'}</TableCell>
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

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editing ? 'Edit BMHP' : 'Tambah BMHP Baru'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nama BMHP <span className="text-rose-500">*</span></Label>
              <Input value={form.nama_bmhp} onChange={(e) => setField('nama_bmhp', e.target.value)} placeholder="Contoh: Kasa Steril 16x16" aria-invalid={!!errors.nama_bmhp} />
              {errors.nama_bmhp && <p className="text-xs text-rose-600">{errors.nama_bmhp}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Jenis</Label>
                <Select value={form.jenis || 'none'} onValueChange={(v) => setField('jenis', v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Pilih Jenis" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Pilih Jenis</SelectItem>
                    {JENIS_BMHP.map((j) => <SelectItem key={j} value={j}>{j}</SelectItem>)}
                    {form.jenis && !JENIS_BMHP.includes(form.jenis) && <SelectItem value={form.jenis}>{form.jenis}</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Satuan <span className="text-rose-500">*</span></Label>
                <Input list="satuan-bmhp-options" value={form.satuan} onChange={(e) => setField('satuan', e.target.value)} aria-invalid={!!errors.satuan} />
                <datalist id="satuan-bmhp-options">
                  {SATUAN_BMHP.map((s) => <option key={s} value={s} />)}
                </datalist>
                {errors.satuan && <p className="text-xs text-rose-600">{errors.satuan}</p>}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Stok Minimum <span className="text-rose-500">*</span></Label>
              <Input type="number" min="0" step="1" value={form.stok_minimum} onChange={(e) => setField('stok_minimum', e.target.value)} aria-invalid={!!errors.stok_minimum} />
              {errors.stok_minimum
                ? <p className="text-xs text-rose-600">{errors.stok_minimum}</p>
                : <p className="text-xs text-slate-500">Ambang batas untuk peringatan "Stok Menipis". Stok aktual dikelola lewat BMHP Masuk.</p>}
            </div>
            <div className="space-y-2">
              <Label>Keterangan</Label>
              <Textarea rows={2} value={form.keterangan} onChange={(e) => setField('keterangan', e.target.value)} placeholder="Ukuran, merek, atau catatan lain" />
            </div>
            {editing && (
              <p className="text-xs text-slate-500">Stok tersisa saat ini: <span className="font-semibold">{editing.stok_tersisa ?? 0} {editing.satuan}</span>. Stok tidak diubah dari form ini.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)} disabled={saving}>Batal</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2 bg-[#006837] hover:bg-[#005830]">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={showMasukModal} onOpenChange={setShowMasukModal}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Catat BMHP Masuk</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>BMHP <span className="text-rose-500">*</span></Label>
              <Select value={masukForm.bmhp_id || 'none'} onValueChange={(v) => setMasukField('bmhp_id', v === 'none' ? '' : v)}>
                <SelectTrigger aria-invalid={!!masukErrors.bmhp_id}><SelectValue placeholder="Pilih BMHP" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Pilih BMHP</SelectItem>
                  {bmhpList.map((b) => <SelectItem key={b.id} value={b.id}>{b.nama_bmhp} (Stok: {b.stok_tersisa ?? 0} {b.satuan})</SelectItem>)}
                </SelectContent>
              </Select>
              {masukErrors.bmhp_id && <p className="text-xs text-rose-600">{masukErrors.bmhp_id}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tanggal Masuk <span className="text-rose-500">*</span></Label>
                <Input type="date" max={todayISO()} value={masukForm.tanggal} onChange={(e) => setMasukField('tanggal', e.target.value)} aria-invalid={!!masukErrors.tanggal} />
                {masukErrors.tanggal && <p className="text-xs text-rose-600">{masukErrors.tanggal}</p>}
              </div>
              <div className="space-y-2">
                <Label>Jumlah <span className="text-rose-500">*</span></Label>
                <Input type="number" min="1" step="1" value={masukForm.jumlah} onChange={(e) => setMasukField('jumlah', e.target.value)} aria-invalid={!!masukErrors.jumlah} />
                {masukErrors.jumlah && <p className="text-xs text-rose-600">{masukErrors.jumlah}</p>}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tanggal Kadaluarsa</Label>
              <Input type="date" value={masukForm.tanggal_kadaluarsa} onChange={(e) => setMasukField('tanggal_kadaluarsa', e.target.value)} aria-invalid={!!masukErrors.tanggal_kadaluarsa} />
              {masukErrors.tanggal_kadaluarsa
                ? <p className="text-xs text-rose-600">{masukErrors.tanggal_kadaluarsa}</p>
                : <p className="text-xs text-slate-500">Kosongkan bila BMHP tidak memiliki tanggal kadaluarsa.</p>}
            </div>
            <div className="space-y-2">
              <Label>Sumber</Label>
              <Input value={masukForm.sumber} onChange={(e) => setMasukField('sumber', e.target.value)} placeholder="Pembelian, Donasi, Puskesmas" />
            </div>
            <div className="space-y-2">
              <Label>Keterangan</Label>
              <Textarea rows={2} value={masukForm.keterangan} onChange={(e) => setMasukField('keterangan', e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMasukModal(false)} disabled={saving}>Batal</Button>
            <Button onClick={handleSaveMasuk} disabled={saving} className="gap-2 bg-[#006837] hover:bg-[#005830]">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
