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
import { Switch } from '@/components/ui/switch';
import { AlertTriangle, Loader2, Save, Search, Eye, Sparkles, MessageSquareText, CheckCircle2, CalendarClock, Settings2, Check, X, ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { confirmDialog } from '@/components/ui/confirm-dialog';

// submitted_at/ditanggapi_pada are stored as naive UTC ISO strings (no timezone
// suffix). Appending 'Z' tells the browser to parse them as UTC so they convert
// correctly to the viewer's local time instead of being misread as already-local.
function formatServerTime(isoString) {
  if (!isoString) return '-';
  const hasTz = /[zZ]|[+-]\d{2}:?\d{2}$/.test(isoString);
  const d = new Date(hasTz ? isoString : `${isoString}Z`);
  return d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

function ScheduleCard({ schedule, onToggle, toggling, onSaveWindow, savingWindow }) {
  const [editing, setEditing] = useState(false);
  const [start, setStart] = useState(schedule?.open_start || '');
  const [end, setEnd] = useState(schedule?.open_end || '');
  const [info, setInfo] = useState(schedule?.info || '');

  useEffect(() => {
    setStart(schedule?.open_start || '');
    setEnd(schedule?.open_end || '');
    setInfo(schedule?.info || '');
  }, [schedule]);

  if (!schedule) {
    return (
      <Card>
        <CardContent className="p-4 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Memuat status jadwal...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={schedule.is_open ? 'border-emerald-200' : 'border-slate-200'}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-semibold text-slate-700">Jadwal Pengisian untuk Siswa</span>
            <Badge className={schedule.is_open ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}>
              {schedule.is_open ? (schedule.window_active ? 'Sedang Dibuka' : 'Dibuka (di luar jendela waktu)') : 'Ditutup'}
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <Button size="sm" variant="ghost" onClick={() => setEditing((v) => !v)} className="gap-1.5 text-slate-500">
              <Settings2 className="h-3.5 w-3.5" /> {editing ? 'Tutup' : 'Atur Jendela Waktu'}
            </Button>
            <Switch checked={!!schedule.is_open} onCheckedChange={onToggle} disabled={toggling} data-testid="pcl-schedule-toggle" />
          </div>
        </div>
        {editing && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            <div>
              <Label className="text-xs">Mulai (opsional)</Label>
              <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Selesai (opsional)</Label>
              <Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className="mt-1" />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Info Tambahan untuk Siswa</Label>
              <Input value={info} onChange={(e) => setInfo(e.target.value)} placeholder="Contoh: Isilah dengan jujur" className="mt-1" />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <Button size="sm" onClick={() => onSaveWindow({ start, end, info })} disabled={savingWindow} className="gap-1.5 bg-[#006837] hover:bg-[#005830]">
                {savingWindow ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Simpan
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminBKPclPage() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterTingkat, setFilterTingkat] = useState('');
  const [categories, setCategories] = useState([]);
  const [expandedCat, setExpandedCat] = useState({});

  const [schedule, setSchedule] = useState(null);
  const [scheduleToggling, setScheduleToggling] = useState(false);
  const [scheduleSaving, setScheduleSaving] = useState(false);

  const [detailItem, setDetailItem] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [respTanggapan, setRespTanggapan] = useState('');
  const [respRekomendasi, setRespRekomendasi] = useState('');
  const [savingResp, setSavingResp] = useState(false);

  useEffect(() => { loadData(); loadSchedule(); loadForm(); }, []);

  const loadForm = async () => {
    try {
      const { data } = await api.get('/bk/pcl/form');
      setCategories(data.categories || []);
    } catch (e) {
      // categories are only needed to render the review detail; fail silently
    }
  };

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

  const loadSchedule = async () => {
    try {
      const { data } = await api.get('/bk/pcl/schedule');
      setSchedule(data);
    } catch (e) {
      toast.error('Gagal memuat status jadwal PCL');
    }
  };

  const handleToggleSchedule = async (checked) => {
    setScheduleToggling(true);
    try {
      const { data } = await api.put('/bk/pcl/schedule', {
        is_open: checked,
        open_start: schedule?.open_start || null,
        open_end: schedule?.open_end || null,
        info: schedule?.info || null,
      });
      setSchedule(data);
      toast.success(checked ? 'Pengisian PCL dibuka untuk siswa' : 'Pengisian PCL ditutup');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal mengubah jadwal');
    } finally {
      setScheduleToggling(false);
    }
  };

  const handleSaveScheduleWindow = async ({ start, end, info }) => {
    setScheduleSaving(true);
    try {
      const { data } = await api.put('/bk/pcl/schedule', {
        is_open: !!schedule?.is_open,
        open_start: start || null,
        open_end: end || null,
        info: info || null,
      });
      setSchedule(data);
      toast.success('Jendela waktu PCL disimpan');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menyimpan jendela waktu');
    } finally {
      setScheduleSaving(false);
    }
  };

  const openDetail = (item) => {
    setDetailItem(item);
    setRespTanggapan(item.tanggapan_bk || '');
    setRespRekomendasi(item.rekomendasi_bk || '');
    const initExpanded = {};
    (item.scoring?.by_category || []).forEach((c) => { initExpanded[c.kode] = c.jumlah_dipilih > 0; });
    setExpandedCat(initExpanded);
  };

  const toggleExpandCat = (kode) => setExpandedCat((prev) => ({ ...prev, [kode]: !prev[kode] }));

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

  const handleDelete = async (item) => {
    if (!(await confirmDialog(`Yakin ingin menghapus data PCL milik ${item.siswa_nama}? Tindakan ini tidak dapat dibatalkan.`))) return;
    try {
      await api.delete(`/bk/pcl/${item.id}`);
      setList((prev) => prev.filter((x) => x.id !== item.id));
      if (detailItem?.id === item.id) setDetailItem(null);
      toast.success('Data PCL berhasil dihapus');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menghapus data');
    }
  };

  // Tingkat (grade level) is derived from the class name's leading digits,
  // e.g. "7B" -> "7" -- classes in this school always follow that pattern.
  const getTingkat = (kelas) => (kelas || '').match(/^\d+/)?.[0] || null;
  const tingkatOptions = [...new Set(list.map((item) => getTingkat(item.siswa_kelas)).filter(Boolean))].sort();

  const filtered = list.filter((item) => {
    if (filterStatus === 'responded' && !item.tanggapan_bk) return false;
    if (filterStatus === 'pending' && item.tanggapan_bk) return false;
    if (filterTingkat && getTingkat(item.siswa_kelas) !== filterTingkat) return false;
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
      </div>

      <ScheduleCard
        schedule={schedule}
        onToggle={handleToggleSchedule}
        toggling={scheduleToggling}
        onSaveWindow={handleSaveScheduleWindow}
        savingWindow={scheduleSaving}
      />

      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Cari nama atau NIS siswa..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterTingkat || 'all'} onValueChange={(v) => setFilterTingkat(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Semua Tingkat" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Tingkat</SelectItem>
              {tingkatOptions.map((t) => <SelectItem key={t} value={t}>Kelas {t}</SelectItem>)}
            </SelectContent>
          </Select>
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
                          <TableCell className="font-mono text-xs">{formatServerTime(item.submitted_at)}</TableCell>
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
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="ghost" onClick={() => openDetail(item)} className="gap-1 text-blue-600 hover:text-blue-700">
                                <Eye className="h-3.5 w-3.5" /> Tinjau
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => handleDelete(item)} className="text-rose-600 hover:text-rose-700">
                                <Trash2 className="h-3.5 w-3.5" />
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

              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Jawaban per Kategori</h3>
                <div className="space-y-2">
                  {categories.length === 0 ? (
                    <div className="p-4 text-center text-sm text-slate-500 border border-slate-200 rounded-lg">Memuat daftar pernyataan...</div>
                  ) : (
                    categories.map((cat) => {
                      const catScore = (detailItem.scoring?.by_category || []).find((c) => c.kode === cat.kode);
                      const selectedIdx = new Set(catScore?.item_dipilih || []);
                      const isOpen = !!expandedCat[cat.kode];
                      return (
                        <div key={cat.kode} className="border border-slate-200 rounded-lg overflow-hidden">
                          <button type="button" onClick={() => toggleExpandCat(cat.kode)} className="w-full flex items-center justify-between p-2.5 text-left bg-slate-50">
                            <div className="flex items-center gap-1.5">
                              {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
                              <span className="text-sm font-medium text-slate-700">{cat.nama}</span>
                            </div>
                            <Badge variant={selectedIdx.size > 0 ? 'default' : 'outline'} className={selectedIdx.size > 0 ? 'bg-[#006837]' : ''}>
                              {catScore?.jumlah_dipilih ?? 0}/{cat.items.length} ({catScore?.persentase ?? 0}%)
                            </Badge>
                          </button>
                          {isOpen && (
                            <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                              {cat.items.map((text, idx) => {
                                const isSelected = selectedIdx.has(idx);
                                return (
                                  <div key={idx} className={`flex items-start gap-2 p-2 text-sm ${isSelected ? 'bg-[#006837]/5' : ''}`}>
                                    {isSelected ? (
                                      <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                    ) : (
                                      <X className="h-3.5 w-3.5 text-slate-300 shrink-0 mt-0.5" />
                                    )}
                                    <span className={isSelected ? 'text-slate-800' : 'text-slate-400'}>
                                      <span className="text-slate-400 mr-1">{idx + 1}.</span>{text}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 space-y-2 text-sm">
                <h3 className="text-sm font-semibold text-slate-700 mb-1">Uraian Tambahan</h3>
                <div><span className="text-slate-500 block text-xs">Masalah lain:</span>{detailItem.masalah_lain || <span className="italic text-slate-400">tidak diisi</span>}</div>
                <div><span className="text-slate-500 block text-xs">Masalah saat ini:</span>{detailItem.masalah_saat_ini || <span className="italic text-slate-400">tidak diisi</span>}</div>
                <div><span className="text-slate-500 block text-xs">Tempat curhat:</span>{detailItem.tempat_curhat || <span className="italic text-slate-400">tidak diisi</span>}</div>
              </div>

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
                  <p className="text-xs text-emerald-700 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Terakhir ditanggapi oleh {detailItem.ditanggapi_oleh} pada {formatServerTime(detailItem.ditanggapi_pada)}</p>
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
