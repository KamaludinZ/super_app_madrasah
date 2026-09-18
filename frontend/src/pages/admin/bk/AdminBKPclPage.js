import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Loader2, Save, Search, Eye, Sparkles, MessageSquareText, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export default function AdminBKPclPage() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [detailItem, setDetailItem] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [respTanggapan, setRespTanggapan] = useState('');
  const [respRekomendasi, setRespRekomendasi] = useState('');
  const [savingResp, setSavingResp] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/bk/pcl');
      setList(data || []);
    } catch (e) {
      toast.error('Gagal memuat data PCL');
    } finally {
      setLoading(false);
    }
  };

  const openDetail = (item) => {
    setDetailItem(item);
    setRespTanggapan(item.tanggapan_bk || '');
    setRespRekomendasi(item.rekomendasi_bk || '');
  };

  const handleGenerateAiSummary = async () => {
    if (!detailItem) return;
    setAiLoading(true);
    try {
      const { data } = await api.post(`/bk/pcl/${detailItem.id}/ai-summary`);
      setDetailItem({ ...detailItem, ai_summary: data.ai_summary });
      setList((prev) => prev.map((x) => x.id === detailItem.id ? { ...x, ai_summary: data.ai_summary } : x));
      toast.success('Ringkasan AI berhasil dibuat');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal membuat ringkasan AI');
    } finally {
      setAiLoading(false);
    }
  };

  const handleSaveResponse = async () => {
    if (!detailItem || !respTanggapan.trim()) {
      toast.error('Tanggapan wajib diisi');
      return;
    }
    setSavingResp(true);
    try {
      const { data } = await api.put(`/bk/pcl/${detailItem.id}/respond`, {
        tanggapan: respTanggapan,
        rekomendasi: respRekomendasi || null,
      });
      setDetailItem(data);
      setList((prev) => prev.map((x) => x.id === data.id ? data : x));
      toast.success('Tanggapan berhasil disimpan');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menyimpan tanggapan');
    } finally {
      setSavingResp(false);
    }
  };

  const filtered = list.filter((item) => {
    if (filterStatus === 'responded' && !item.tanggapan_bk) return false;
    if (filterStatus === 'pending' && item.tanggapan_bk) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (item.siswa_nama || '').toLowerCase().includes(q) || (item.siswa_nis || '').toLowerCase().includes(q);
  });

  const topCategory = (item) => {
    const cats = (item.scoring?.by_category || []).filter((c) => c.jumlah_dipilih > 0);
    if (cats.length === 0) return null;
    return cats.reduce((max, c) => c.jumlah_dipilih > max.jumlah_dipilih ? c : max, cats[0]);
  };

  return (
    <div className="space-y-6" data-testid="admin-bk-pcl-page">
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
          <AlertTriangle className="h-3 w-3 mr-1" /> Menu BK
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Problem Check List (PCL)</h1>
        <p className="text-sm text-slate-600 mt-1">Tinjau hasil pengisian PCL siswa, buat ringkasan AI, dan beri tanggapan</p>
        <p className="text-xs text-slate-500 mt-1">Atur jadwal buka/tutup pengisian di Pengaturan &gt; CLKB & PCL.</p>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Cari nama atau NIS siswa..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterStatus || 'all'} onValueChange={(v) => setFilterStatus(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-full sm:w-56"><SelectValue placeholder="Semua Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="pending">Menunggu Tanggapan</SelectItem>
              <SelectItem value="responded">Sudah Ditanggapi</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-[#006837]" /><p className="text-slate-500">Memuat data...</p></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Waktu Isi</TableHead>
                    <TableHead>Siswa</TableHead>
                    <TableHead>Kelas</TableHead>
                    <TableHead className="text-center">Total Dipilih</TableHead>
                    <TableHead>Kategori Menonjol</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-12 text-slate-500">
                      <AlertTriangle className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                      <div className="font-semibold">Belum ada pengisian PCL dari siswa</div>
                    </TableCell></TableRow>
                  ) : (
                    filtered.map((item) => {
                      const top = topCategory(item);
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono text-xs">{new Date(item.submitted_at).toLocaleString('id-ID')}</TableCell>
                          <TableCell className="font-semibold">{item.siswa_nama}<div className="text-xs text-slate-500 font-normal">{item.siswa_nis}</div></TableCell>
                          <TableCell>{item.siswa_kelas || '-'}</TableCell>
                          <TableCell className="text-center font-mono">{item.scoring?.total_dipilih} ({item.scoring?.persentase_keseluruhan}%)</TableCell>
                          <TableCell>{top ? <Badge variant="outline">{top.nama} ({top.jumlah_dipilih})</Badge> : '-'}</TableCell>
                          <TableCell>
                            {item.tanggapan_bk ? (
                              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Ditanggapi</Badge>
                            ) : (
                              <Badge variant="outline">Menunggu</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="ghost" onClick={() => openDetail(item)} className="gap-1 text-blue-600 hover:text-blue-700">
                              <Eye className="h-3.5 w-3.5" /> Tinjau
                            </Button>
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

      <Dialog open={!!detailItem} onOpenChange={(v) => !v && setDetailItem(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>PCL — {detailItem?.siswa_nama} ({detailItem?.siswa_kelas})</DialogTitle>
          </DialogHeader>
          {detailItem && (
            <div className="space-y-5 py-2">
              <div className="p-3 rounded-lg bg-slate-50 text-center">
                <div className="text-lg font-bold text-slate-900">{detailItem.scoring?.total_dipilih} / {detailItem.scoring?.total_item_keseluruhan}</div>
                <div className="text-xs text-slate-500">Total Masalah Dipilih ({detailItem.scoring?.persentase_keseluruhan}%)</div>
              </div>

              <div className="space-y-1.5">
                {(detailItem.scoring?.by_category || []).filter((c) => c.jumlah_dipilih > 0).sort((a, b) => b.jumlah_dipilih - a.jumlah_dipilih).map((c) => (
                  <div key={c.kode} className="flex items-center justify-between text-sm p-2 bg-slate-50 rounded">
                    <span className="text-slate-700">{c.nama}</span>
                    <Badge variant="outline">{c.jumlah_dipilih}/{c.total_item} ({c.persentase}%)</Badge>
                  </div>
                ))}
                {(detailItem.scoring?.by_category || []).every((c) => c.jumlah_dipilih === 0) && (
                  <p className="text-sm text-slate-500 text-center py-2">Tidak ada kategori masalah yang dipilih siswa.</p>
                )}
              </div>

              {(detailItem.masalah_lain || detailItem.masalah_saat_ini || detailItem.tempat_curhat) && (
                <div className="p-3 rounded-lg border border-slate-200 space-y-2 text-sm">
                  {detailItem.masalah_lain && <div><span className="text-slate-500 block text-xs">Masalah lain:</span>{detailItem.masalah_lain}</div>}
                  {detailItem.masalah_saat_ini && <div><span className="text-slate-500 block text-xs">Masalah saat ini:</span>{detailItem.masalah_saat_ini}</div>}
                  {detailItem.tempat_curhat && <div><span className="text-slate-500 block text-xs">Tempat curhat:</span>{detailItem.tempat_curhat}</div>}
                </div>
              )}

              <div className="p-4 rounded-lg border border-amber-200 bg-amber-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-amber-900 flex items-center gap-1.5"><Sparkles className="h-4 w-4" /> Ringkasan AI</h3>
                  <Button size="sm" variant="outline" onClick={handleGenerateAiSummary} disabled={aiLoading} className="gap-1.5 border-amber-300 text-amber-800 hover:bg-amber-100">
                    {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    {detailItem.ai_summary ? 'Buat Ulang' : 'Buat Ringkasan'}
                  </Button>
                </div>
                {detailItem.ai_summary ? (
                  <p className="text-sm text-amber-900 whitespace-pre-wrap">{detailItem.ai_summary}</p>
                ) : (
                  <p className="text-xs text-amber-700 italic">Belum ada ringkasan. Pastikan provider AI aktif di Pengaturan &gt; Integrasi AI.</p>
                )}
              </div>

              <div className="p-4 rounded-lg border border-emerald-200 bg-emerald-50/50 space-y-3">
                <h3 className="text-sm font-semibold text-emerald-900 flex items-center gap-1.5"><MessageSquareText className="h-4 w-4" /> Tanggapan & Rekomendasi Guru BK</h3>
                <div>
                  <Label className="text-xs">Tanggapan <span className="text-rose-500">*</span></Label>
                  <Textarea rows={3} value={respTanggapan} onChange={(e) => setRespTanggapan(e.target.value)} placeholder="Tanggapan terhadap hasil pengisian siswa..." className="mt-1 bg-white" />
                </div>
                <div>
                  <Label className="text-xs">Rekomendasi</Label>
                  <Textarea rows={2} value={respRekomendasi} onChange={(e) => setRespRekomendasi(e.target.value)} placeholder="Rekomendasi tindak lanjut (opsional)" className="mt-1 bg-white" />
                </div>
                {detailItem.ditanggapi_oleh && (
                  <p className="text-xs text-emerald-700 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Terakhir ditanggapi oleh {detailItem.ditanggapi_oleh} pada {new Date(detailItem.ditanggapi_pada).toLocaleString('id-ID')}</p>
                )}
                <div className="flex justify-end">
                  <Button onClick={handleSaveResponse} disabled={savingResp} className="gap-2 bg-[#006837] hover:bg-[#005830]">
                    {savingResp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Simpan Tanggapan
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
