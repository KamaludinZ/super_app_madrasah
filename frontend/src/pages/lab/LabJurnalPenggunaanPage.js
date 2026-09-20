import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { BookOpenCheck, Plus, Trash2, Loader2, Save, Download } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';
import { LAB_META } from './LabMeta';
const emptyForm = (userName) => ({
  tanggal: new Date().toISOString().split('T')[0], jam_mulai: '', jam_selesai: '', jp_mulai: '', jp_selesai: '',
  pengguna_nama_display: userName || '', judul_percobaan: '', alat_bahan_digunakan: '', keterangan: '',
});

export default function LabJurnalPenggunaanPage() {
  const { labKey } = useParams();
  const { user } = useAuth();
  const meta = LAB_META[labKey] || LAB_META.ipa;
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm(user?.full_name));

  useEffect(() => { loadData(); }, [labKey]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/lab/${labKey}/jurnal-penggunaan`);
      setList(data || []);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal memuat jurnal penggunaan lab');
    } finally {
      setLoading(false);
    }
  };

  const openModal = () => { setForm(emptyForm(user?.full_name)); setShowModal(true); };

  const handleSave = async () => {
    if (!form.tanggal || !form.judul_percobaan) {
      toast.error('Tanggal dan Judul Percobaan wajib diisi');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        tanggal: form.tanggal, jam_mulai: form.jam_mulai || null, jam_selesai: form.jam_selesai || null,
        jp_mulai: form.jp_mulai ? Number(form.jp_mulai) : null, jp_selesai: form.jp_selesai ? Number(form.jp_selesai) : null,
        judul_percobaan: form.judul_percobaan, alat_bahan_digunakan: form.alat_bahan_digunakan || null,
        keterangan: form.keterangan || null,
      };
      await api.post(`/lab/${labKey}/jurnal-penggunaan`, payload);
      toast.success('Jurnal penggunaan berhasil dicatat');
      setShowModal(false);
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menyimpan data');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Yakin ingin menghapus jurnal ini?')) return;
    try {
      await api.delete(`/lab/${labKey}/jurnal-penggunaan/${id}`);
      toast.success('Jurnal dihapus');
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menghapus data');
    }
  };

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      const response = await api.get(`/lab/${labKey}/jurnal-penggunaan/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Jurnal_Penggunaan_${meta.title.replace(' ', '_')}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal mengunduh PDF');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6" data-testid={`lab-${labKey}-jurnal-penggunaan-page`}>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <meta.icon className="h-3 w-3 mr-1" /> {meta.title}
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Jurnal Penggunaan {meta.title}</h1>
          <p className="text-sm text-slate-600 mt-1">Catat seluruh aktivitas percobaan, penggunaan alat/bahan, serta catatan kegiatan.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleDownloadPdf} variant="outline" disabled={downloading} className="gap-2">
            <Download className="h-4 w-4" /> {downloading ? 'Mengunduh...' : 'Cetak PDF (A4 Landscape)'}
          </Button>
          <Button onClick={openModal} className="gap-2 bg-[#006837] hover:bg-[#005830]">
            <Plus className="h-4 w-4" /> Tambah Jurnal Praktikum
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-[#006837]" /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">NO</TableHead>
                    <TableHead>PENGGUNA/GURU</TableHead>
                    <TableHead>TANGGAL & WAKTU</TableHead>
                    <TableHead>JUDUL PERCOBAAN/EKSPERIMEN</TableHead>
                    <TableHead>ALAT & BAHAN (JUMLAH)</TableHead>
                    <TableHead>CATATAN PENTING</TableHead>
                    <TableHead className="text-right">AKSI</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-12 text-slate-500">
                      <BookOpenCheck className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                      <div className="font-semibold">Belum ada jurnal penggunaan lab</div>
                    </TableCell></TableRow>
                  ) : (
                    list.map((item, idx) => {
                      const jp = item.jp_mulai && item.jp_selesai ? ` (JP ${item.jp_mulai}-${item.jp_selesai})` : '';
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="text-sm text-slate-500">{idx + 1}</TableCell>
                          <TableCell className="font-semibold">{item.pengguna_nama || '-'}</TableCell>
                          <TableCell className="text-xs font-mono">
                            {item.tanggal}<br />{item.jam_mulai}{item.jam_selesai ? `-${item.jam_selesai}` : ''}{jp}
                          </TableCell>
                          <TableCell className="max-w-xs"><div className="line-clamp-2 font-medium text-[#006837]">{item.judul_percobaan}</div></TableCell>
                          <TableCell className="max-w-xs"><div className="line-clamp-3 text-sm">{item.alat_bahan_digunakan || '-'}</div></TableCell>
                          <TableCell className="max-w-xs"><div className="line-clamp-2 text-sm italic text-slate-600">{item.keterangan || '-'}</div></TableCell>
                          <TableCell className="text-right">
                            <Button size="icon" variant="ghost" onClick={() => handleDelete(item.id)} className="text-rose-600 hover:text-rose-700"><Trash2 className="h-4 w-4" /></Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Tambah Jurnal Penggunaan Lab {meta.title}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nama Pengguna / Guru</Label>
              <Input value={form.pengguna_nama_display} disabled className="bg-slate-50" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Tanggal Penggunaan <span className="text-rose-500">*</span></Label>
                <Input type="date" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Jam Mulai</Label>
                <Input type="time" value={form.jam_mulai} onChange={(e) => setForm({ ...form, jam_mulai: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Jam Selesai</Label>
                <Input type="time" value={form.jam_selesai} onChange={(e) => setForm({ ...form, jam_selesai: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>JP Mulai (Jam Ke-)</Label>
                <Input type="number" min="1" value={form.jp_mulai} onChange={(e) => setForm({ ...form, jp_mulai: e.target.value })} placeholder="Mis. 3" />
              </div>
              <div className="space-y-2">
                <Label>JP Selesai (Jam Ke-)</Label>
                <Input type="number" min="1" value={form.jp_selesai} onChange={(e) => setForm({ ...form, jp_selesai: e.target.value })} placeholder="Mis. 4" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Judul Percobaan / Eksperimen / Demonstrasi <span className="text-rose-500">*</span></Label>
              <Input value={form.judul_percobaan} onChange={(e) => setForm({ ...form, judul_percobaan: e.target.value })} placeholder="Uji Bahan Makanan / Pengamatan Sel" />
            </div>
            <div className="space-y-2">
              <Label>Alat & Bahan yang Digunakan serta Jumlahnya</Label>
              <Textarea rows={3} value={form.alat_bahan_digunakan} onChange={(e) => setForm({ ...form, alat_bahan_digunakan: e.target.value })} placeholder="Contoh: Mikroskop (15 unit), Kaca Benda (15 pcs), Aquades (1 botol)" />
            </div>
            <div className="space-y-2">
              <Label>Catatan Penting (Opsional)</Label>
              <Textarea rows={2} value={form.keterangan} onChange={(e) => setForm({ ...form, keterangan: e.target.value })} placeholder="Catatan kendala, kondisi alat, atau saran..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)} disabled={saving}>Batal</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2 bg-[#006837] hover:bg-[#005830]">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan Jurnal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
