import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle, Loader2, Save, History, Info, Lock, Eye, ChevronDown, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export default function SiswaPCLPage() {
  const [tab, setTab] = useState('baru');
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [selected, setSelected] = useState({}); // { kategori_kode: Set(indices) }
  const [expanded, setExpanded] = useState({});
  const [masalahLain, setMasalahLain] = useState('');
  const [masalahSaatIni, setMasalahSaatIni] = useState('');
  const [tempatCurhat, setTempatCurhat] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [detailItem, setDetailItem] = useState(null);

  useEffect(() => { loadForm(); loadHistory(); }, []);

  const loadForm = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/bk/pcl/form');
      setForm(data);
      const initSel = {};
      const initExp = {};
      (data.categories || []).forEach((c, idx) => { initSel[c.kode] = new Set(); initExp[c.kode] = idx === 0; });
      setSelected(initSel);
      setExpanded(initExp);
    } catch (e) {
      toast.error('Gagal memuat formulir PCL');
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const { data } = await api.get('/bk/pcl/my-history');
      setHistory(data || []);
    } catch (e) {
      // ignore
    } finally {
      setHistoryLoading(false);
    }
  };

  const toggleItem = (kode, idx) => {
    setSelected((prev) => {
      const next = { ...prev };
      const set = new Set(next[kode]);
      if (set.has(idx)) set.delete(idx); else set.add(idx);
      next[kode] = set;
      return next;
    });
  };

  const toggleExpand = (kode) => setExpanded((prev) => ({ ...prev, [kode]: !prev[kode] }));

  const totalSelected = Object.values(selected).reduce((sum, set) => sum + set.size, 0);

  const resetForm = () => {
    const initSel = {};
    (form?.categories || []).forEach((c) => { initSel[c.kode] = new Set(); });
    setSelected(initSel);
    setMasalahLain(''); setMasalahSaatIni(''); setTempatCurhat('');
  };

  const handleSubmit = async () => {
    if (totalSelected === 0) {
      toast.error('Pilih minimal satu masalah yang pernah/sedang kamu alami');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {};
      Object.entries(selected).forEach(([kode, set]) => { payload[kode] = Array.from(set); });
      await api.post('/bk/pcl/submit', {
        selected: payload,
        masalah_lain: masalahLain || null,
        masalah_saat_ini: masalahSaatIni || null,
        tempat_curhat: tempatCurhat || null,
      });
      toast.success('PCL berhasil dikirim. Terima kasih!');
      resetForm();
      loadHistory();
      setTab('riwayat');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal mengirim PCL');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-[#006837]" />
        <p className="text-slate-500">Memuat formulir...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="siswa-pcl-page">
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
          <AlertTriangle className="h-3 w-3 mr-1" /> Bimbingan Konseling
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Problem Check List (PCL)</h1>
        <p className="text-sm text-slate-600 mt-1">Pilih masalah yang pernah/sedang kamu alami untuk membantu guru BK memahami kondisimu</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-white border border-slate-200">
          <TabsTrigger value="baru">Mulai Tes Baru</TabsTrigger>
          <TabsTrigger value="riwayat"><History className="h-4 w-4 mr-2" /> Riwayat ({history.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="baru" className="mt-4 space-y-4">
          {!form?.is_open ? (
            <Card>
              <CardContent className="p-10 text-center">
                <Lock className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                <div className="font-semibold text-slate-700">Pengisian PCL sedang ditutup</div>
                <p className="text-sm text-slate-500 mt-1">Admin/Guru BK akan membuka jadwal pengisian saat waktunya tiba.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                  <div className="flex gap-2 items-start">
                    <Info className="h-4 w-4 text-blue-700 mt-0.5 shrink-0" />
                    <div className="text-sm text-blue-900 space-y-1">
                      {(form.petunjuk || []).map((p, i) => <p key={i}>{i + 1}. {p}</p>)}
                      {form.info && <p className="italic mt-2">{form.info}</p>}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-slate-700">Progress Keseluruhan</span>
                    <span className="text-sm text-slate-500">{totalSelected} / {form.total_items} dipilih</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#006837] transition-all" style={{ width: `${(totalSelected / form.total_items) * 100}%` }} />
                  </div>
                </CardContent>
              </Card>

              {form.categories.map((cat) => {
                const set = selected[cat.kode] || new Set();
                const isOpen = !!expanded[cat.kode];
                return (
                  <Card key={cat.kode}>
                    <button type="button" onClick={() => toggleExpand(cat.kode)} className="w-full flex items-center justify-between p-4 text-left">
                      <div className="flex items-center gap-2">
                        {isOpen ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                        <span className="font-semibold text-slate-800 text-sm">{cat.nama}</span>
                      </div>
                      <Badge variant={set.size > 0 ? 'default' : 'outline'} className={set.size > 0 ? 'bg-[#006837]' : ''}>
                        {set.size}/{cat.items.length}
                      </Badge>
                    </button>
                    {isOpen && (
                      <CardContent className="pt-0 pb-4 space-y-1.5">
                        {cat.items.map((text, idx) => (
                          <label key={idx} className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${set.has(idx) ? 'bg-[#006837]/5 border-[#006837]/30' : 'border-slate-100 hover:bg-slate-50'}`}>
                            <Checkbox checked={set.has(idx)} onCheckedChange={() => toggleItem(cat.kode, idx)} className="mt-0.5" />
                            <span className="text-sm text-slate-700"><span className="text-slate-400 mr-1">{idx + 1}.</span>{text}</span>
                          </label>
                        ))}
                      </CardContent>
                    )}
                  </Card>
                );
              })}

              <Card>
                <CardContent className="p-4 sm:p-6 space-y-4">
                  <h3 className="text-sm font-semibold text-slate-700">Uraikan dengan Singkat (opsional)</h3>
                  {(form.essay_questions || []).map((q, i) => (
                    <div key={q.kode}>
                      <label className="text-xs text-slate-600">{i + 1}. {q.pertanyaan}</label>
                      <Textarea
                        rows={2}
                        className="mt-1"
                        value={q.kode === 'masalah_lain' ? masalahLain : q.kode === 'masalah_saat_ini' ? masalahSaatIni : tempatCurhat}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (q.kode === 'masalah_lain') setMasalahLain(v);
                          else if (q.kode === 'masalah_saat_ini') setMasalahSaatIni(v);
                          else setTempatCurhat(v);
                        }}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button onClick={handleSubmit} disabled={submitting} className="gap-2 bg-[#006837] hover:bg-[#005830]" data-testid="pcl-submit-button">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {submitting ? 'Mengirim...' : 'Kirim Jawaban'}
                </Button>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="riwayat" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {historyLoading ? (
                <div className="p-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-[#006837]" /></div>
              ) : history.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <History className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                  <div className="font-semibold">Belum ada riwayat pengisian PCL</div>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {history.map((h) => (
                    <div key={h.id} className="p-4 flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <div className="text-sm font-semibold text-slate-800">{new Date(h.submitted_at).toLocaleString('id-ID')}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {h.scoring?.total_dipilih} masalah dipilih ({h.scoring?.persentase_keseluruhan}%)
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {h.tanggapan_bk ? (
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Sudah Ditanggapi BK</Badge>
                        ) : (
                          <Badge variant="outline">Menunggu Tanggapan</Badge>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => setDetailItem(h)} className="gap-1">
                          <Eye className="h-3.5 w-3.5" /> Detail
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!detailItem} onOpenChange={(v) => !v && setDetailItem(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Detail Pengisian PCL</DialogTitle></DialogHeader>
          {detailItem && (
            <div className="space-y-4 py-2">
              <div className="p-3 rounded-lg bg-slate-50 text-center">
                <div className="text-lg font-bold text-slate-900">{detailItem.scoring?.total_dipilih} / {detailItem.scoring?.total_item_keseluruhan}</div>
                <div className="text-xs text-slate-500">Total Masalah Dipilih ({detailItem.scoring?.persentase_keseluruhan}%)</div>
              </div>
              <div className="space-y-1.5">
                {(detailItem.scoring?.by_category || []).filter((c) => c.jumlah_dipilih > 0).map((c) => (
                  <div key={c.kode} className="flex items-center justify-between text-sm p-2 bg-slate-50 rounded">
                    <span className="text-slate-700">{c.nama}</span>
                    <Badge variant="outline">{c.jumlah_dipilih}/{c.total_item} ({c.persentase}%)</Badge>
                  </div>
                ))}
              </div>
              {detailItem.tanggapan_bk && (
                <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50 space-y-1">
                  <div className="text-xs font-semibold text-emerald-800">Tanggapan Guru BK ({detailItem.ditanggapi_oleh})</div>
                  <p className="text-sm text-emerald-900">{detailItem.tanggapan_bk}</p>
                  {detailItem.rekomendasi_bk && (
                    <>
                      <div className="text-xs font-semibold text-emerald-800 mt-2">Rekomendasi</div>
                      <p className="text-sm text-emerald-900">{detailItem.rekomendasi_bk}</p>
                    </>
                  )}
                </div>
              )}
              {!detailItem.tanggapan_bk && (
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-500 text-center">
                  Belum ada tanggapan dari Guru BK
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
