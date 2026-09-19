import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Stethoscope, History, Plus, Trash2, Loader2, Save, Search, Eye, ClipboardPlus, X, Pencil, Printer } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';

const KONDISI_PULANG_LIST = ['Membaik', 'Dirujuk', 'Dijemput Orang Tua', 'Istirahat di UKS', 'Istirahat di Mahad'];

function formatTanggalID(dateStr) {
  if (!dateStr) return '-';
  const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return dateStr;
  return `${m[3]}-${m[2]}-${m[1]}`;
}
const STATUS_BADGE = {
  'Belum Ditangani': 'bg-amber-100 text-amber-700 border-amber-200',
  'Sudah Ditangani': 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const emptyIntakeForm = {
  jenis_pasien: 'siswa', // 'siswa' or 'gtk'
  gtk_kategori: 'guru', // 'guru' or 'tenaga_kependidikan'
  tingkat: '',
  kelas_id: '',
  pasien_id: '',
  tanggal: new Date().toISOString().split('T')[0],
  waktu: '',
  keluhan: '',
  tinggi_badan: '',
  berat_badan: '',
  tekanan_darah: '',
  nadi: '',
  suhu: '',
  spo2: '',
};

const emptyPenangananForm = {
  jenis_penanganan_ids: [],
  obat_list: [], // [{ obat_id, jumlah }]
  penanganan: '',
  kondisi_pulang: '',
  dirujuk_ke: '',
  keterangan: '',
  tinggi_badan: '',
  berat_badan: '',
  tekanan_darah: '',
  nadi: '',
  suhu: '',
  spo2: '',
};

export default function AdminUKSKunjunganPage() {
  const { settings } = useAuth();
  const [tab, setTab] = useState('input');
  const [list, setList] = useState([]);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [gtkList, setGtkList] = useState([]);
  const [jenisList, setJenisList] = useState([]);
  const [obatList, setObatList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [intakeForm, setIntakeForm] = useState(emptyIntakeForm);

  const [showPenangananModal, setShowPenangananModal] = useState(false);
  const [penangananTarget, setPenangananTarget] = useState(null);
  const [penangananForm, setPenangananForm] = useState(emptyPenangananForm);
  const [savingPenanganan, setSavingPenanganan] = useState(false);

  const [detailItem, setDetailItem] = useState(null);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [riwayatPasien, setRiwayatPasien] = useState({ kunjungan: [], ckg: [], imunisasi: [] });
  const [loadingRiwayat, setLoadingRiwayat] = useState(false);

  const [detailProfile, setDetailProfile] = useState(null);
  const [loadingDetailProfile, setLoadingDetailProfile] = useState(false);

  useEffect(() => {
    if (!detailItem?.pasien_id) {
      setDetailProfile(null);
      return;
    }
    let cancelled = false;
    setLoadingDetailProfile(true);
    api.get(`/uks/pasien/${detailItem.pasien_id}/profile`)
      .then(({ data }) => { if (!cancelled) setDetailProfile(data); })
      .catch(() => { if (!cancelled) toast.error('Gagal memuat profil pasien'); })
      .finally(() => { if (!cancelled) setLoadingDetailProfile(false); });
    return () => { cancelled = true; };
  }, [detailItem?.pasien_id]);

  const [suratItem, setSuratItem] = useState(null);
  const [suratType, setSuratType] = useState(null); // 'rujukan' | 'perizinan'
  const [suratProfile, setSuratProfile] = useState(null);
  const [loadingSurat, setLoadingSurat] = useState(false);

  const openSurat = async (item, type) => {
    setSuratItem(item);
    setSuratType(type);
    setSuratProfile(null);
    setLoadingSurat(true);
    try {
      const { data } = await api.get(`/uks/pasien/${item.pasien_id}/profile`);
      setSuratProfile(data);
    } catch (e) {
      toast.error('Gagal memuat data pasien untuk surat');
    } finally {
      setLoadingSurat(false);
    }
  };

  const closeSurat = () => { setSuratItem(null); setSuratType(null); setSuratProfile(null); };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    const pasienId = intakeForm.pasien_id;
    if (!pasienId) {
      setRiwayatPasien({ kunjungan: [], ckg: [], imunisasi: [] });
      return;
    }
    let cancelled = false;
    setLoadingRiwayat(true);
    Promise.all([
      api.get('/uks/kunjungan', { params: { pasien_id: pasienId } }),
      api.get('/uks/ckg', { params: { pasien_id: pasienId } }),
      api.get('/uks/imunisasi', { params: { pasien_id: pasienId } }),
    ]).then(([kRes, cRes, iRes]) => {
      if (cancelled) return;
      setRiwayatPasien({ kunjungan: kRes.data || [], ckg: cRes.data || [], imunisasi: iRes.data || [] });
    }).catch(() => {
      if (!cancelled) toast.error('Gagal memuat riwayat periksa pasien');
    }).finally(() => {
      if (!cancelled) setLoadingRiwayat(false);
    });
    return () => { cancelled = true; };
  }, [intakeForm.pasien_id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [res, classesRes, jenisRes, obatRes] = await Promise.all([
        api.get('/uks/kunjungan'),
        api.get('/classes'),
        api.get('/uks/jenis-penanganan'),
        api.get('/uks/obat'),
      ]);
      setList(res.data || []);
      setClasses(classesRes.data || []);
      setJenisList(jenisRes.data || []);
      setObatList(obatRes.data || []);
    } catch (e) {
      toast.error('Gagal memuat data kunjungan UKS');
    } finally {
      setLoading(false);
    }
  };

  const tingkatOptions = [...new Set(classes.map((c) => c.grade).filter((g) => g !== undefined && g !== null))].sort((a, b) => a - b);
  const kelasOptions = classes.filter((c) => String(c.grade) === String(intakeForm.tingkat));

  const loadStudentsForClass = async (classId) => {
    if (!classId) { setStudents([]); return; }
    try {
      const { data } = await api.get('/students', { params: { class_id: classId } });
      setStudents(data || []);
    } catch (e) {
      toast.error('Gagal memuat data siswa');
    }
  };

  const loadGtkList = async (kategori) => {
    try {
      const { data } = await api.get('/uks/warga-madrasah', { params: { role: kategori } });
      setGtkList(data || []);
    } catch (e) {
      toast.error('Gagal memuat data GTK');
    }
  };

  useEffect(() => {
    if (intakeForm.jenis_pasien === 'gtk') {
      loadGtkList(intakeForm.gtk_kategori);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intakeForm.jenis_pasien, intakeForm.gtk_kategori]);

  const resetIntakeForm = () => {
    setIntakeForm(emptyIntakeForm);
    setStudents([]);
  };

  const handleSaveIntake = async () => {
    if (!intakeForm.pasien_id || !intakeForm.tanggal || !intakeForm.keluhan) {
      toast.error('Pasien, tanggal, dan keluhan wajib diisi');
      return;
    }
    setSaving(true);
    try {
      await api.post('/uks/kunjungan', {
        pasien_id: intakeForm.pasien_id,
        tanggal: intakeForm.tanggal,
        waktu: intakeForm.waktu || null,
        keluhan: intakeForm.keluhan,
        tinggi_badan: intakeForm.tinggi_badan ? Number(intakeForm.tinggi_badan) : null,
        berat_badan: intakeForm.berat_badan ? Number(intakeForm.berat_badan) : null,
        tekanan_darah: intakeForm.tekanan_darah || null,
        nadi: intakeForm.nadi ? Number(intakeForm.nadi) : null,
        suhu: intakeForm.suhu ? Number(intakeForm.suhu) : null,
        spo2: intakeForm.spo2 ? Number(intakeForm.spo2) : null,
      });
      toast.success('Kunjungan berhasil dicatat, silakan lanjut ke Riwayat untuk penanganan');
      resetIntakeForm();
      loadData();
      setTab('riwayat');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menyimpan data');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Yakin ingin menghapus data kunjungan ini?')) return;
    try {
      await api.delete(`/uks/kunjungan/${id}`);
      toast.success('Data kunjungan dihapus');
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menghapus data');
    }
  };

  const openEditKunjungan = (item) => {
    setEditTarget(item);
    setEditForm({
      tanggal: item.tanggal || '',
      waktu: item.waktu || '',
      keluhan: item.keluhan || '',
      tinggi_badan: item.tinggi_badan ?? '',
      berat_badan: item.berat_badan ?? '',
      tekanan_darah: item.tekanan_darah || '',
      nadi: item.nadi ?? '',
      suhu: item.suhu ?? '',
      spo2: item.spo2 ?? '',
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editForm.tanggal || !editForm.keluhan) {
      toast.error('Tanggal dan keluhan wajib diisi');
      return;
    }
    setSavingEdit(true);
    try {
      await api.put(`/uks/kunjungan/${editTarget.id}`, {
        pasien_id: editTarget.pasien_id,
        tanggal: editForm.tanggal,
        waktu: editForm.waktu || null,
        keluhan: editForm.keluhan,
        tinggi_badan: editForm.tinggi_badan ? Number(editForm.tinggi_badan) : null,
        berat_badan: editForm.berat_badan ? Number(editForm.berat_badan) : null,
        tekanan_darah: editForm.tekanan_darah || null,
        nadi: editForm.nadi ? Number(editForm.nadi) : null,
        suhu: editForm.suhu ? Number(editForm.suhu) : null,
        spo2: editForm.spo2 ? Number(editForm.spo2) : null,
      });
      toast.success('Data kunjungan berhasil diperbarui');
      setShowEditModal(false);
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal memperbarui data');
    } finally {
      setSavingEdit(false);
    }
  };

  const openPenanganan = (item) => {
    setPenangananTarget(item);
    setPenangananForm({
      jenis_penanganan_ids: item.jenis_penanganan_ids?.length ? item.jenis_penanganan_ids : [],
      obat_list: item.obat_dipakai?.length ? item.obat_dipakai.map((o) => ({ obat_id: o.obat_id, jumlah: o.jumlah })) : [],
      penanganan: item.penanganan || '',
      kondisi_pulang: item.kondisi_pulang || '',
      dirujuk_ke: item.dirujuk_ke || '',
      keterangan: item.keterangan || '',
      tinggi_badan: item.tinggi_badan ?? '',
      berat_badan: item.berat_badan ?? '',
      tekanan_darah: item.tekanan_darah || '',
      nadi: item.nadi ?? '',
      suhu: item.suhu ?? '',
      spo2: item.spo2 ?? '',
    });
    setShowPenangananModal(true);
  };

  const toggleJenisPenanganan = (id) => {
    setPenangananForm((prev) => ({
      ...prev,
      jenis_penanganan_ids: prev.jenis_penanganan_ids.includes(id)
        ? prev.jenis_penanganan_ids.filter((x) => x !== id)
        : [...prev.jenis_penanganan_ids, id],
    }));
  };

  const addObatRow = () => {
    setPenangananForm((prev) => ({ ...prev, obat_list: [...prev.obat_list, { obat_id: '', jumlah: 1 }] }));
  };

  const updateObatRow = (idx, field, value) => {
    setPenangananForm((prev) => {
      const next = [...prev.obat_list];
      next[idx] = { ...next[idx], [field]: value };
      return { ...prev, obat_list: next };
    });
  };

  const removeObatRow = (idx) => {
    setPenangananForm((prev) => ({ ...prev, obat_list: prev.obat_list.filter((_, i) => i !== idx) }));
  };

  const handleSavePenanganan = async () => {
    const invalidObat = penangananForm.obat_list.some((o) => !o.obat_id || !o.jumlah || o.jumlah < 1);
    if (invalidObat) {
      toast.error('Lengkapi obat dan jumlahnya, atau hapus baris obat yang kosong');
      return;
    }
    setSavingPenanganan(true);
    try {
      await api.put(`/uks/kunjungan/${penangananTarget.id}/penanganan`, {
        jenis_penanganan_ids: penangananForm.jenis_penanganan_ids,
        obat_list: penangananForm.obat_list.map((o) => ({ obat_id: o.obat_id, jumlah: Number(o.jumlah) })),
        penanganan: penangananForm.penanganan || null,
        kondisi_pulang: penangananForm.kondisi_pulang || null,
        dirujuk_ke: penangananForm.dirujuk_ke || null,
        keterangan: penangananForm.keterangan || null,
        tinggi_badan: penangananForm.tinggi_badan ? Number(penangananForm.tinggi_badan) : null,
        berat_badan: penangananForm.berat_badan ? Number(penangananForm.berat_badan) : null,
        tekanan_darah: penangananForm.tekanan_darah || null,
        nadi: penangananForm.nadi ? Number(penangananForm.nadi) : null,
        suhu: penangananForm.suhu ? Number(penangananForm.suhu) : null,
        spo2: penangananForm.spo2 ? Number(penangananForm.spo2) : null,
      });
      toast.success('Penanganan berhasil disimpan');
      setShowPenangananModal(false);
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menyimpan penanganan');
    } finally {
      setSavingPenanganan(false);
    }
  };

  const filtered = list.filter((item) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (item.pasien_nama || '').toLowerCase().includes(q) ||
      (item.keluhan || '').toLowerCase().includes(q);
  });

  const pasienOptions = intakeForm.jenis_pasien === 'gtk' ? gtkList : students;
  const selectedPasien = pasienOptions.find((p) => p.id === intakeForm.pasien_id);

  return (
    <div className="space-y-6" data-testid="admin-uks-kunjungan-page">
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
          <Stethoscope className="h-3 w-3 mr-1" /> Menu UKS
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Data Kunjungan UKS</h1>
        <p className="text-sm text-slate-600 mt-1">Input kunjungan dan riwayat pelayanan kesehatan</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-white border border-slate-200">
          <TabsTrigger value="input"><Stethoscope className="h-4 w-4 mr-2" /> Input Kunjungan</TabsTrigger>
          <TabsTrigger value="riwayat"><History className="h-4 w-4 mr-2" /> Riwayat ({list.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="input" className="mt-4 space-y-4">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <Label>Jenis Pasien <span className="text-rose-500">*</span></Label>
                <div className="flex gap-3">
                  <Button
                    type="button" variant={intakeForm.jenis_pasien === 'siswa' ? 'default' : 'outline'}
                    className={intakeForm.jenis_pasien === 'siswa' ? 'bg-[#006837] hover:bg-[#005830]' : ''}
                    onClick={() => setIntakeForm({ ...emptyIntakeForm, jenis_pasien: 'siswa', tanggal: intakeForm.tanggal })}
                  >
                    Siswa
                  </Button>
                  <Button
                    type="button" variant={intakeForm.jenis_pasien === 'gtk' ? 'default' : 'outline'}
                    className={intakeForm.jenis_pasien === 'gtk' ? 'bg-[#006837] hover:bg-[#005830]' : ''}
                    onClick={() => setIntakeForm({ ...emptyIntakeForm, jenis_pasien: 'gtk', tanggal: intakeForm.tanggal })}
                  >
                    GTK
                  </Button>
                </div>
              </div>

              {intakeForm.jenis_pasien === 'gtk' ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Kategori GTK</Label>
                    <Select
                      value={intakeForm.gtk_kategori}
                      onValueChange={(v) => setIntakeForm({ ...intakeForm, gtk_kategori: v, pasien_id: '' })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="guru">Guru</SelectItem>
                        <SelectItem value="tenaga_kependidikan">Tenaga Kependidikan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Nama <span className="text-rose-500">*</span></Label>
                    <Select value={intakeForm.pasien_id || 'none'} onValueChange={(v) => setIntakeForm({ ...intakeForm, pasien_id: v === 'none' ? '' : v })}>
                      <SelectTrigger><SelectValue placeholder="Pilih Nama" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Pilih Nama</SelectItem>
                        {pasienOptions.map((w) => <SelectItem key={w.id} value={w.id}>{w.full_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Tingkat <span className="text-rose-500">*</span></Label>
                    <Select
                      value={intakeForm.tingkat || 'none'}
                      onValueChange={(v) => {
                        const tingkat = v === 'none' ? '' : v;
                        setIntakeForm({ ...intakeForm, tingkat, kelas_id: '', pasien_id: '' });
                        setStudents([]);
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
                      value={intakeForm.kelas_id || 'none'}
                      onValueChange={(v) => {
                        const kelasId = v === 'none' ? '' : v;
                        setIntakeForm({ ...intakeForm, kelas_id: kelasId, pasien_id: '' });
                        loadStudentsForClass(kelasId);
                      }}
                      disabled={!intakeForm.tingkat}
                    >
                      <SelectTrigger><SelectValue placeholder="Pilih Kelas" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Pilih Kelas</SelectItem>
                        {kelasOptions.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Nama Siswa <span className="text-rose-500">*</span></Label>
                    <Select value={intakeForm.pasien_id || 'none'} onValueChange={(v) => setIntakeForm({ ...intakeForm, pasien_id: v === 'none' ? '' : v })} disabled={!intakeForm.kelas_id}>
                      <SelectTrigger><SelectValue placeholder={intakeForm.kelas_id ? 'Pilih Siswa' : 'Pilih kelas dahulu'} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Pilih Siswa</SelectItem>
                        {students.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {intakeForm.kelas_id && students.length === 0 && (
                      <p className="text-xs text-amber-600">Tidak ada siswa terdaftar di kelas ini</p>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tanggal <span className="text-rose-500">*</span></Label>
                  <Input type="date" value={intakeForm.tanggal} onChange={(e) => setIntakeForm({ ...intakeForm, tanggal: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Waktu</Label>
                  <div className="flex gap-2">
                    <Input type="time" value={intakeForm.waktu} onChange={(e) => setIntakeForm({ ...intakeForm, waktu: e.target.value })} className="flex-1" />
                    <Button
                      type="button" variant="outline"
                      onClick={() => {
                        const now = new Date();
                        setIntakeForm({
                          ...intakeForm,
                          tanggal: now.toISOString().split('T')[0],
                          waktu: now.toTimeString().slice(0, 5),
                        });
                      }}
                    >
                      Sekarang
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-600">Pemeriksaan Vital (opsional)</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-3 border border-slate-200 rounded-lg">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">Tinggi Badan (cm)</Label>
                    <Input type="number" step="0.1" min="0" value={intakeForm.tinggi_badan} onChange={(e) => setIntakeForm({ ...intakeForm, tinggi_badan: e.target.value })} placeholder="cm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">Berat Badan (kg)</Label>
                    <Input type="number" step="0.1" min="0" value={intakeForm.berat_badan} onChange={(e) => setIntakeForm({ ...intakeForm, berat_badan: e.target.value })} placeholder="kg" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">Tekanan Darah</Label>
                    <Input value={intakeForm.tekanan_darah} onChange={(e) => setIntakeForm({ ...intakeForm, tekanan_darah: e.target.value })} placeholder="120/80" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">Nadi (bpm)</Label>
                    <Input type="number" min="0" value={intakeForm.nadi} onChange={(e) => setIntakeForm({ ...intakeForm, nadi: e.target.value })} placeholder="bpm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">Suhu (°C)</Label>
                    <Input type="number" step="0.1" min="0" value={intakeForm.suhu} onChange={(e) => setIntakeForm({ ...intakeForm, suhu: e.target.value })} placeholder="°C" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">SpO2 (%)</Label>
                    <Input type="number" min="0" max="100" value={intakeForm.spo2} onChange={(e) => setIntakeForm({ ...intakeForm, spo2: e.target.value })} placeholder="%" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Keluhan <span className="text-rose-500">*</span></Label>
                <Textarea rows={3} value={intakeForm.keluhan} onChange={(e) => setIntakeForm({ ...intakeForm, keluhan: e.target.value })} placeholder="Keluhan yang dialami pasien" />
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveIntake} disabled={saving} className="gap-2 bg-[#006837] hover:bg-[#005830]">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saving ? 'Menyimpan...' : 'Simpan Kunjungan'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {intakeForm.pasien_id && (
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-slate-500" />
                  <h3 className="font-semibold text-slate-900">Riwayat Periksa Sebelumnya — {selectedPasien?.full_name}</h3>
                </div>

                {loadingRiwayat ? (
                  <div className="py-6 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-[#006837]" /></div>
                ) : (
                  <>
                    <div>
                      <div className="text-xs font-semibold text-slate-500 uppercase mb-2">Kunjungan UKS</div>
                      {riwayatPasien.kunjungan.length === 0 ? (
                        <p className="text-sm text-slate-400">Belum ada riwayat kunjungan</p>
                      ) : (
                        <div className="space-y-1.5 max-h-52 overflow-y-auto">
                          {riwayatPasien.kunjungan.map((item) => (
                            <div key={item.id} className="flex items-center justify-between gap-3 text-sm bg-slate-50 rounded-lg px-3 py-2">
                              <div className="min-w-0">
                                <span className="font-mono text-slate-500 mr-2">{item.tanggal}{item.waktu ? ` · ${item.waktu}` : ''}</span>
                                <span className="truncate">{item.keluhan}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <Badge className={STATUS_BADGE[item.status] || ''}>{item.status}</Badge>
                                <Button size="icon" variant="ghost" onClick={() => setDetailItem(item)} className="h-7 w-7 text-blue-600 hover:text-blue-700"><Eye className="h-3.5 w-3.5" /></Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="text-xs font-semibold text-slate-500 uppercase mb-2">Cek Kesehatan (CKG)</div>
                      {riwayatPasien.ckg.length === 0 ? (
                        <p className="text-sm text-slate-400">Belum ada riwayat CKG</p>
                      ) : (
                        <div className="space-y-1.5 max-h-52 overflow-y-auto">
                          {riwayatPasien.ckg.map((item) => (
                            <div key={item.id} className="flex items-center justify-between gap-3 text-sm bg-slate-50 rounded-lg px-3 py-2">
                              <div className="min-w-0">
                                <span className="font-mono text-slate-500 mr-2">{item.tanggal}</span>
                                <span className="truncate">TB {item.tinggi_badan ?? '-'} cm · BB {item.berat_badan ?? '-'} kg · Tensi {item.tekanan_darah || '-'}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="text-xs font-semibold text-slate-500 uppercase mb-2">Imunisasi</div>
                      {riwayatPasien.imunisasi.length === 0 ? (
                        <p className="text-sm text-slate-400">Belum ada riwayat imunisasi</p>
                      ) : (
                        <div className="space-y-1.5 max-h-52 overflow-y-auto">
                          {riwayatPasien.imunisasi.map((item) => (
                            <div key={item.id} className="flex items-center justify-between gap-3 text-sm bg-slate-50 rounded-lg px-3 py-2">
                              <div className="min-w-0">
                                <span className="font-mono text-slate-500 mr-2">{item.tanggal}</span>
                                <span className="truncate">{item.jenis_vaksin}{item.dosis_ke ? ` (Dosis ${item.dosis_ke})` : ''}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="riwayat" className="mt-4 space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input placeholder="Cari pasien atau keluhan..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
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
                        <TableHead>Tanggal</TableHead>
                        <TableHead>Pasien</TableHead>
                        <TableHead>Keluhan</TableHead>
                        <TableHead className="text-center">TB (cm)</TableHead>
                        <TableHead className="text-center">BB (kg)</TableHead>
                        <TableHead className="text-center">Tensi</TableHead>
                        <TableHead className="text-center">Nadi</TableHead>
                        <TableHead className="text-center">Suhu (°C)</TableHead>
                        <TableHead className="text-center">SpO2 (%)</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Kondisi</TableHead>
                        <TableHead className="text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={12} className="text-center py-12 text-slate-500">
                            <History className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                            <div className="font-semibold">Belum ada riwayat kunjungan</div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filtered.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-mono">{item.tanggal} {item.waktu ? `· ${item.waktu}` : ''}</TableCell>
                            <TableCell className="font-semibold">{item.pasien_nama}<div className="text-xs text-slate-500 font-normal">{item.pasien_identitas}</div></TableCell>
                            <TableCell className="max-w-xs"><div className="line-clamp-2">{item.keluhan}</div></TableCell>
                            <TableCell className="text-center font-mono">{item.tinggi_badan ?? '-'}</TableCell>
                            <TableCell className="text-center font-mono">{item.berat_badan ?? '-'}</TableCell>
                            <TableCell className="text-center font-mono">{item.tekanan_darah || '-'}</TableCell>
                            <TableCell className="text-center font-mono">{item.nadi ?? '-'}</TableCell>
                            <TableCell className="text-center font-mono">{item.suhu ?? '-'}</TableCell>
                            <TableCell className="text-center font-mono">{item.spo2 ?? '-'}</TableCell>
                            <TableCell><Badge className={STATUS_BADGE[item.status] || ''}>{item.status}</Badge></TableCell>
                            <TableCell>{item.kondisi_pulang || '-'}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1 flex-wrap">
                                <Button size="sm" variant="ghost" onClick={() => openPenanganan(item)} className="gap-1 text-amber-700 hover:text-amber-800">
                                  <ClipboardPlus className="h-3.5 w-3.5" /> Penanganan
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setDetailItem(item)} className="gap-1 text-blue-600 hover:text-blue-700">
                                  <Eye className="h-3.5 w-3.5" /> Detail
                                </Button>
                                {item.kondisi_pulang === 'Dirujuk' && (
                                  <Button size="sm" variant="ghost" onClick={() => openSurat(item, 'rujukan')} className="gap-1 text-purple-700 hover:text-purple-800">
                                    <Printer className="h-3.5 w-3.5" /> Surat Rujukan
                                  </Button>
                                )}
                                {item.kondisi_pulang === 'Dijemput Orang Tua' && (
                                  <Button size="sm" variant="ghost" onClick={() => openSurat(item, 'perizinan')} className="gap-1 text-purple-700 hover:text-purple-800">
                                    <Printer className="h-3.5 w-3.5" /> Surat Perizinan
                                  </Button>
                                )}
                                <Button size="icon" variant="ghost" onClick={() => openEditKunjungan(item)} className="text-slate-600 hover:text-slate-700">
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
        </TabsContent>
      </Tabs>

      {/* Penanganan Modal */}
      <Dialog open={showPenangananModal} onOpenChange={setShowPenangananModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Penanganan — {penangananTarget?.pasien_nama}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 rounded-lg bg-slate-50 text-sm">
              <span className="text-slate-500">Keluhan:</span> {penangananTarget?.keluhan}
            </div>

            <div className="space-y-2">
              <Label className="text-slate-600">Pemeriksaan Vital</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-3 border border-slate-200 rounded-lg">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">Tinggi Badan (cm)</Label>
                  <Input type="number" step="0.1" min="0" value={penangananForm.tinggi_badan} onChange={(e) => setPenangananForm({ ...penangananForm, tinggi_badan: e.target.value })} placeholder="cm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">Berat Badan (kg)</Label>
                  <Input type="number" step="0.1" min="0" value={penangananForm.berat_badan} onChange={(e) => setPenangananForm({ ...penangananForm, berat_badan: e.target.value })} placeholder="kg" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">Tekanan Darah</Label>
                  <Input value={penangananForm.tekanan_darah} onChange={(e) => setPenangananForm({ ...penangananForm, tekanan_darah: e.target.value })} placeholder="120/80" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">Nadi (bpm)</Label>
                  <Input type="number" min="0" value={penangananForm.nadi} onChange={(e) => setPenangananForm({ ...penangananForm, nadi: e.target.value })} placeholder="bpm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">Suhu (°C)</Label>
                  <Input type="number" step="0.1" min="0" value={penangananForm.suhu} onChange={(e) => setPenangananForm({ ...penangananForm, suhu: e.target.value })} placeholder="°C" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">SpO2 (%)</Label>
                  <Input type="number" min="0" max="100" value={penangananForm.spo2} onChange={(e) => setPenangananForm({ ...penangananForm, spo2: e.target.value })} placeholder="%" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Jenis Penanganan (boleh pilih lebih dari satu)</Label>
              <div className="grid grid-cols-2 gap-2 p-3 border border-slate-200 rounded-lg max-h-40 overflow-y-auto">
                {jenisList.length === 0 ? (
                  <p className="text-sm text-slate-500 col-span-2">Belum ada jenis penanganan terdaftar</p>
                ) : (
                  jenisList.map((j) => (
                    <label key={j.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={penangananForm.jenis_penanganan_ids.includes(j.id)} onCheckedChange={() => toggleJenisPenanganan(j.id)} />
                      {j.nama}
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Penggunaan Obat</Label>
                <Button type="button" size="sm" variant="outline" onClick={addObatRow} className="gap-1">
                  <Plus className="h-3.5 w-3.5" /> Tambah Obat
                </Button>
              </div>
              {penangananForm.obat_list.length === 0 ? (
                <p className="text-xs text-slate-500">Belum ada obat ditambahkan</p>
              ) : (
                <div className="space-y-2">
                  {penangananForm.obat_list.map((row, idx) => {
                    const selectedObat = obatList.find((o) => o.id === row.obat_id);
                    return (
                      <div key={idx} className="flex items-center gap-2">
                        <Select value={row.obat_id || 'none'} onValueChange={(v) => updateObatRow(idx, 'obat_id', v === 'none' ? '' : v)}>
                          <SelectTrigger className="flex-1"><SelectValue placeholder="Pilih Obat" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Pilih Obat</SelectItem>
                            {obatList.map((o) => <SelectItem key={o.id} value={o.id}>{o.nama_obat} (Stok: {o.stok_tersisa ?? 0})</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number" min="1" max={selectedObat?.stok_tersisa || undefined}
                          value={row.jumlah} onChange={(e) => updateObatRow(idx, 'jumlah', e.target.value)}
                          className="w-24" placeholder="Jml"
                        />
                        <Button size="icon" variant="ghost" onClick={() => removeObatRow(idx)} className="text-rose-600 hover:text-rose-700 shrink-0">
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Penanganan</Label>
              <Textarea rows={2} value={penangananForm.penanganan} onChange={(e) => setPenangananForm({ ...penangananForm, penanganan: e.target.value })} placeholder="Uraikan penanganan yang diberikan" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Kondisi</Label>
                <Select value={penangananForm.kondisi_pulang || 'none'} onValueChange={(v) => setPenangananForm({ ...penangananForm, kondisi_pulang: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Pilih Kondisi" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Pilih Kondisi</SelectItem>
                    {KONDISI_PULANG_LIST.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Dirujuk Ke</Label>
                <Input value={penangananForm.dirujuk_ke} onChange={(e) => setPenangananForm({ ...penangananForm, dirujuk_ke: e.target.value })} placeholder="Jika dirujuk (opsional)" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Keterangan</Label>
              <Textarea rows={2} value={penangananForm.keterangan} onChange={(e) => setPenangananForm({ ...penangananForm, keterangan: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPenangananModal(false)} disabled={savingPenanganan}>Batal</Button>
            <Button onClick={handleSavePenanganan} disabled={savingPenanganan} className="gap-2 bg-[#006837] hover:bg-[#005830]">
              {savingPenanganan ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {savingPenanganan ? 'Menyimpan...' : 'Simpan Penanganan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Kunjungan Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Kunjungan — {editTarget?.pasien_nama}</DialogTitle>
          </DialogHeader>
          {editForm && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tanggal <span className="text-rose-500">*</span></Label>
                  <Input type="date" value={editForm.tanggal} onChange={(e) => setEditForm({ ...editForm, tanggal: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Waktu</Label>
                  <Input type="time" value={editForm.waktu} onChange={(e) => setEditForm({ ...editForm, waktu: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Keluhan <span className="text-rose-500">*</span></Label>
                <Textarea rows={3} value={editForm.keluhan} onChange={(e) => setEditForm({ ...editForm, keluhan: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-600">Pemeriksaan Vital (opsional)</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-3 border border-slate-200 rounded-lg">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">Tinggi Badan (cm)</Label>
                    <Input type="number" step="0.1" min="0" value={editForm.tinggi_badan} onChange={(e) => setEditForm({ ...editForm, tinggi_badan: e.target.value })} placeholder="cm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">Berat Badan (kg)</Label>
                    <Input type="number" step="0.1" min="0" value={editForm.berat_badan} onChange={(e) => setEditForm({ ...editForm, berat_badan: e.target.value })} placeholder="kg" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">Tekanan Darah</Label>
                    <Input value={editForm.tekanan_darah} onChange={(e) => setEditForm({ ...editForm, tekanan_darah: e.target.value })} placeholder="120/80" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">Nadi (bpm)</Label>
                    <Input type="number" min="0" value={editForm.nadi} onChange={(e) => setEditForm({ ...editForm, nadi: e.target.value })} placeholder="bpm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">Suhu (°C)</Label>
                    <Input type="number" step="0.1" min="0" value={editForm.suhu} onChange={(e) => setEditForm({ ...editForm, suhu: e.target.value })} placeholder="°C" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">SpO2 (%)</Label>
                    <Input type="number" min="0" max="100" value={editForm.spo2} onChange={(e) => setEditForm({ ...editForm, spo2: e.target.value })} placeholder="%" />
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)} disabled={savingEdit}>Batal</Button>
            <Button onClick={handleSaveEdit} disabled={savingEdit} className="gap-2 bg-[#006837] hover:bg-[#005830]">
              {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {savingEdit ? 'Menyimpan...' : 'Simpan Perubahan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Modal */}
      <Dialog open={!!detailItem} onOpenChange={(v) => !v && setDetailItem(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Detail Kunjungan UKS</DialogTitle></DialogHeader>
          {detailItem && (
            <div className="space-y-3 py-2 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-slate-500 block text-xs">Pasien</span>{detailItem.pasien_nama}</div>
                <div><span className="text-slate-500 block text-xs">Tanggal</span>{detailItem.tanggal} {detailItem.waktu || ''}</div>
              </div>

              {loadingDetailProfile ? (
                <div className="py-3 text-center"><Loader2 className="h-4 w-4 animate-spin mx-auto text-[#006837]" /></div>
              ) : detailProfile && (
                <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                  <div className="text-xs font-semibold text-slate-500 uppercase">Data Pasien</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><span className="text-slate-400 block text-xs">Jenis Pasien</span>{detailProfile.jenis_pasien === 'siswa' ? 'Siswa' : 'GTK'}</div>
                    <div><span className="text-slate-400 block text-xs">NIK</span>{detailProfile.nik || '-'}</div>
                    <div><span className="text-slate-400 block text-xs">Tempat Lahir</span>{detailProfile.tempat_lahir || '-'}</div>
                    <div><span className="text-slate-400 block text-xs">Tgl Lahir</span>{detailProfile.tanggal_lahir || '-'}</div>
                    <div><span className="text-slate-400 block text-xs">Umur</span>{detailProfile.umur || '-'}</div>
                    {detailProfile.jenis_pasien === 'siswa' && (
                      <div><span className="text-slate-400 block text-xs">Wali Kelas</span>{detailProfile.wali_kelas_nama || '-'}</div>
                    )}
                  </div>
                  {detailProfile.jenis_pasien === 'siswa' && (
                    <>
                      <div><span className="text-slate-400 block text-xs">Alamat Siswa</span>{detailProfile.alamat_siswa || '-'}</div>
                      <div className="grid grid-cols-2 gap-2">
                        <div><span className="text-slate-400 block text-xs">Nama Ayah</span>{detailProfile.ayah_nama || '-'}</div>
                        <div><span className="text-slate-400 block text-xs">No. HP Ayah</span>{detailProfile.ayah_no_hp || '-'}</div>
                        <div><span className="text-slate-400 block text-xs">Nama Ibu</span>{detailProfile.ibu_nama || '-'}</div>
                        <div><span className="text-slate-400 block text-xs">No. HP Ibu</span>{detailProfile.ibu_no_hp || '-'}</div>
                        <div><span className="text-slate-400 block text-xs">Nama Wali</span>{detailProfile.wali_nama || '-'}</div>
                        <div><span className="text-slate-400 block text-xs">No. HP Wali</span>{detailProfile.wali_no_hp || '-'}</div>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-xs">Santri Mahad</span>
                        {detailProfile.santri_mahad ? (
                          <span>Ya{detailProfile.kamar_mahad ? ` — Kamar ${detailProfile.kamar_mahad}` : ''}</span>
                        ) : 'Bukan'}
                      </div>
                    </>
                  )}
                </div>
              )}

              <div><span className="text-slate-500 block text-xs">Keluhan</span>{detailItem.keluhan}</div>
              {(detailItem.tinggi_badan || detailItem.berat_badan || detailItem.tekanan_darah || detailItem.nadi || detailItem.suhu || detailItem.spo2) && (
                <div>
                  <span className="text-slate-500 block text-xs mb-1">Pemeriksaan Vital</span>
                  <div className="grid grid-cols-3 gap-2 text-xs bg-slate-50 rounded-lg p-2">
                    {detailItem.tinggi_badan != null && <div><span className="text-slate-400 block">TB</span>{detailItem.tinggi_badan} cm</div>}
                    {detailItem.berat_badan != null && <div><span className="text-slate-400 block">BB</span>{detailItem.berat_badan} kg</div>}
                    {detailItem.tekanan_darah && <div><span className="text-slate-400 block">Tensi</span>{detailItem.tekanan_darah}</div>}
                    {detailItem.nadi != null && <div><span className="text-slate-400 block">Nadi</span>{detailItem.nadi} bpm</div>}
                    {detailItem.suhu != null && <div><span className="text-slate-400 block">Suhu</span>{detailItem.suhu} °C</div>}
                    {detailItem.spo2 != null && <div><span className="text-slate-400 block">SpO2</span>{detailItem.spo2}%</div>}
                  </div>
                </div>
              )}
              <div><span className="text-slate-500 block text-xs">Status</span><Badge className={STATUS_BADGE[detailItem.status] || ''}>{detailItem.status}</Badge></div>
              {detailItem.jenis_penanganan_nama?.length > 0 && (
                <div><span className="text-slate-500 block text-xs">Jenis Penanganan</span>{detailItem.jenis_penanganan_nama.join(', ')}</div>
              )}
              {detailItem.obat_dipakai?.length > 0 && (
                <div>
                  <span className="text-slate-500 block text-xs mb-1">Obat Digunakan</span>
                  <div className="space-y-1">
                    {detailItem.obat_dipakai.map((o, i) => (
                      <div key={i} className="flex justify-between text-sm bg-slate-50 rounded px-2 py-1">
                        <span>{o.obat_nama}</span><span className="font-mono">×{o.jumlah}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {detailItem.penanganan && <div><span className="text-slate-500 block text-xs">Penanganan</span>{detailItem.penanganan}</div>}
              {detailItem.kondisi_pulang && <div><span className="text-slate-500 block text-xs">Kondisi</span>{detailItem.kondisi_pulang}</div>}
              {detailItem.dirujuk_ke && <div><span className="text-slate-500 block text-xs">Dirujuk Ke</span>{detailItem.dirujuk_ke}</div>}
              {detailItem.keterangan && <div><span className="text-slate-500 block text-xs">Keterangan</span>{detailItem.keterangan}</div>}
              {detailItem.ditangani_oleh && (
                <div className="text-xs text-slate-400 pt-2 border-t">Ditangani oleh {detailItem.ditangani_oleh}</div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Surat Rujukan / Perizinan Pulang */}
      <Dialog open={!!suratItem} onOpenChange={(v) => !v && closeSurat()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{suratType === 'rujukan' ? 'Surat Rujukan' : 'Surat Perizinan Pulang'}</DialogTitle>
          </DialogHeader>
          {loadingSurat ? (
            <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#006837]" /></div>
          ) : suratItem && (
            <>
              <div id="surat-uks-print" className="bg-white p-6 border border-slate-200 rounded-lg text-sm text-slate-900 space-y-4">
                <div className="text-center border-b-2 border-slate-800 pb-3 space-y-0.5">
                  <div className="font-bold text-base uppercase">{settings?.school_name || 'MTsN 2 Kota Malang'}</div>
                  {settings?.address && <div className="text-xs">{settings.address}</div>}
                  {settings?.npsn && <div className="text-xs">NPSN: {settings.npsn}</div>}
                </div>

                <div className="text-center space-y-0.5">
                  <div className="font-bold underline uppercase">{suratType === 'rujukan' ? 'Surat Rujukan Kesehatan' : 'Surat Perizinan Pulang'}</div>
                  <div className="text-xs">Nomor: UKS/{suratType === 'rujukan' ? 'RJK' : 'IZN'}/{(suratItem.tanggal || '').replace(/-/g, '')}/{suratItem.id?.slice(0, 6)}</div>
                </div>

                <p>Yang bertanda tangan di bawah ini, Petugas Unit Kesehatan Sekolah (UKS) {settings?.school_name || 'MTsN 2 Kota Malang'}, menerangkan bahwa:</p>

                <div className="grid grid-cols-3 gap-x-2 gap-y-1 pl-4">
                  <div>Nama</div><div className="col-span-2">: {suratItem.pasien_nama}</div>
                  <div>NIK</div><div className="col-span-2">: {suratProfile?.nik || '-'}</div>
                  <div>Jenis Pasien</div><div className="col-span-2">: {suratProfile?.jenis_pasien === 'siswa' ? 'Siswa' : 'GTK'}</div>
                  {suratProfile?.jenis_pasien === 'siswa' && (
                    <>
                      <div>Kelas</div><div className="col-span-2">: {suratProfile?.class_name || '-'}</div>
                      <div>Wali Kelas</div><div className="col-span-2">: {suratProfile?.wali_kelas_nama || '-'}</div>
                    </>
                  )}
                  <div>Tanggal / Waktu</div><div className="col-span-2">: {formatTanggalID(suratItem.tanggal)} {suratItem.waktu || ''}</div>
                  <div>Keluhan</div><div className="col-span-2">: {suratItem.keluhan}</div>
                </div>

                {suratType === 'rujukan' ? (
                  <p>
                    Berdasarkan pemeriksaan yang telah dilakukan, yang bersangkutan memerlukan penanganan lebih lanjut dan
                    dirujuk ke <strong>{suratItem.dirujuk_ke || '_______________'}</strong> untuk mendapatkan pemeriksaan/penanganan medis lebih lanjut.
                  </p>
                ) : (
                  <p>
                    Berdasarkan pemeriksaan yang telah dilakukan, yang bersangkutan diizinkan untuk pulang lebih awal dengan
                    kondisi <strong>Dijemput Orang Tua/Wali</strong> guna mendapatkan istirahat dan perawatan lebih lanjut di rumah.
                  </p>
                )}

                {(suratItem.tinggi_badan || suratItem.berat_badan || suratItem.tekanan_darah || suratItem.nadi || suratItem.suhu || suratItem.spo2) && (
                  <div>
                    <div className="mb-1">Hasil pemeriksaan vital:</div>
                    <div className="grid grid-cols-3 gap-x-2 gap-y-1 pl-4 text-xs">
                      {suratItem.tinggi_badan != null && <div>TB: {suratItem.tinggi_badan} cm</div>}
                      {suratItem.berat_badan != null && <div>BB: {suratItem.berat_badan} kg</div>}
                      {suratItem.tekanan_darah && <div>Tensi: {suratItem.tekanan_darah}</div>}
                      {suratItem.nadi != null && <div>Nadi: {suratItem.nadi} bpm</div>}
                      {suratItem.suhu != null && <div>Suhu: {suratItem.suhu} °C</div>}
                      {suratItem.spo2 != null && <div>SpO2: {suratItem.spo2}%</div>}
                    </div>
                  </div>
                )}

                <p>Demikian surat ini dibuat untuk dapat dipergunakan sebagaimana mestinya.</p>

                <div className="flex justify-between pt-2">
                  {suratProfile?.jenis_pasien === 'siswa' ? (
                    <div className="text-center">
                      <div className="invisible">Malang, {formatTanggalID(suratItem.tanggal)}</div>
                      <div>Mengetahui, Wali Kelas</div>
                      <div className="h-16"></div>
                      <div className="font-semibold underline">{suratProfile?.wali_kelas_nama || '(_________________)'}</div>
                    </div>
                  ) : <div />}
                  <div className="text-center">
                    <div>Malang, {formatTanggalID(suratItem.tanggal)}</div>
                    <div>Petugas UKS,</div>
                    <div className="h-16"></div>
                    <div className="font-semibold underline">{suratItem.ditangani_oleh || suratItem.petugas_nama || '(_________________)'}</div>
                  </div>
                </div>
              </div>

              <DialogFooter className="print:hidden">
                <Button variant="outline" onClick={closeSurat}>Tutup</Button>
                <Button onClick={() => window.print()} className="gap-2 bg-[#006837] hover:bg-[#005830]">
                  <Printer className="h-4 w-4" /> Cetak
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #surat-uks-print, #surat-uks-print * { visibility: visible; }
          #surat-uks-print { position: absolute; left: 0; top: 0; width: 100%; border: none !important; }
        }
      `}</style>
    </div>
  );
}
