import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ClipboardCheck, Loader2, Save, History, Info, CheckCircle2, XCircle, Lock, Eye, ThumbsUp, ThumbsDown, Check, X, CalendarClock } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

// submitted_at is stored as a naive UTC ISO string (no timezone suffix).
// Appending 'Z' tells the browser to parse it as UTC so it converts correctly
// to the viewer's local time instead of being misread as already-local.
function formatServerTime(isoString) {
  if (!isoString) return '-';
  const hasTz = /[zZ]|[+-]\d{2}:?\d{2}$/.test(isoString);
  const d = new Date(hasTz ? isoString : `${isoString}Z`);
  return d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

// clkb_open_start/end come from a <datetime-local> input: already WIB
// wall-clock time with no timezone marker, so it's formatted directly
// (no UTC conversion) to avoid double-shifting the hour.
function formatWibWindow(isoLocalString) {
  if (!isoLocalString) return null;
  const [datePart, timePart] = isoLocalString.split('T');
  if (!datePart || !timePart) return isoLocalString;
  const [y, m, d] = datePart.split('-');
  return `${d}/${m}/${y} ${timePart} WIB`;
}

export default function SiswaCLKBPage() {
  const [tab, setTab] = useState('baru');
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [waktuJam, setWaktuJam] = useState('');
  const [waktuDari, setWaktuDari] = useState('');
  const [waktuSampai, setWaktuSampai] = useState('');
  const [perluInfo, setPerluInfo] = useState(null);
  const [topikDiminati, setTopikDiminati] = useState([]);
  const [topikLainnya, setTopikLainnya] = useState('');
  const [kebiasaan, setKebiasaan] = useState(['', '', '']);
  const [submitting, setSubmitting] = useState(false);
  const [detailItem, setDetailItem] = useState(null);

  const TOPIK_OPTIONS = [
    'Cara belajar yang efektif',
    'Cara membaca yang efektif',
    'Cara membuat ringkasan',
    'Cara menghafal yang efektif',
    'Cara mempelajari jenis pelajaran tertentu',
  ];

  useEffect(() => { loadForm(); loadHistory(); }, []);

  const loadForm = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/bk/clkb/form');
      setForm(data);
    } catch (e) {
      toast.error('Gagal memuat formulir CLKB');
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const { data } = await api.get('/bk/clkb/my-history');
      setHistory(data || []);
    } catch (e) {
      // ignore, tab may just be empty
    } finally {
      setHistoryLoading(false);
    }
  };

  const toggleItem = (no) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(no)) next.delete(no); else next.add(no);
      return next;
    });
  };

  const toggleTopik = (t) => {
    setTopikDiminati((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);
  };

  const resetForm = () => {
    setSelected(new Set());
    setWaktuJam(''); setWaktuDari(''); setWaktuSampai('');
    setPerluInfo(null); setTopikDiminati([]); setTopikLainnya('');
    setKebiasaan(['', '', '']);
  };

  const handleSubmit = async () => {
    if (selected.size === 0) {
      toast.error('Pilih minimal satu pernyataan yang sesuai dengan dirimu');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/bk/clkb/submit', {
        selected: Array.from(selected),
        waktu_belajar_jam: waktuJam || null,
        waktu_belajar_dari: waktuDari || null,
        waktu_belajar_sampai: waktuSampai || null,
        perlu_info_cara_belajar: perluInfo,
        topik_diminati: topikDiminati,
        topik_lainnya: topikLainnya || null,
        kebiasaan_diperbaiki: kebiasaan.filter((k) => k.trim()),
      });
      toast.success('CLKB berhasil dikirim. Terima kasih!');
      resetForm();
      loadHistory();
      setTab('riwayat');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal mengirim CLKB');
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
    <div className="space-y-6" data-testid="siswa-clkb-page">
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
          <ClipboardCheck className="h-3 w-3 mr-1" /> Bimbingan Konseling
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Cek List Kebiasaan Belajar (CLKB)</h1>
        <p className="text-sm text-slate-600 mt-1">Isi kebiasaan belajarmu untuk membantu guru BK memberi bimbingan yang tepat</p>
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
                <div className="font-semibold text-slate-700">Pengisian CLKB sedang ditutup</div>
                <p className="text-sm text-slate-500 mt-1">Admin/Guru BK akan membuka jadwal pengisian saat waktunya tiba.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {(form.open_start || form.open_end) && (
                <Card className="bg-emerald-50 border-emerald-200">
                  <CardContent className="p-4">
                    <div className="flex gap-2 items-start">
                      <CalendarClock className="h-4 w-4 text-emerald-700 mt-0.5 shrink-0" />
                      <div className="text-sm text-emerald-900">
                        <span className="font-semibold">Jadwal Pengisian: </span>
                        {form.open_start ? formatWibWindow(form.open_start) : 'Kapan saja'}
                        {form.open_end && ` s.d. ${formatWibWindow(form.open_end)}`}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

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
                    <span className="text-sm font-semibold text-slate-700">Progress</span>
                    <span className="text-sm text-slate-500">{selected.size} / {form.total_items} dipilih</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#006837] transition-all" style={{ width: `${(selected.size / form.total_items) * 100}%` }} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 sm:p-6 space-y-2">
                  {form.items.map((item) => (
                    <label key={item.no} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selected.has(item.no) ? 'bg-[#006837]/5 border-[#006837]/30' : 'border-slate-200 hover:bg-slate-50'}`}>
                      <Checkbox checked={selected.has(item.no)} onCheckedChange={() => toggleItem(item.no)} className="mt-0.5" />
                      <span className="text-sm text-slate-700"><span className="text-slate-400 mr-1">{item.no}.</span>{item.pernyataan}</span>
                    </label>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 sm:p-6 space-y-4">
                  <h3 className="text-sm font-semibold text-slate-700">Lengkapi Keterangan Berikut</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">Rata-rata jam belajar/hari</Label>
                      <Input value={waktuJam} onChange={(e) => setWaktuJam(e.target.value)} placeholder="Contoh: 2 jam" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs">Dari jam</Label>
                      <Input type="time" value={waktuDari} onChange={(e) => setWaktuDari(e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs">Sampai jam</Label>
                      <Input type="time" value={waktuSampai} onChange={(e) => setWaktuSampai(e.target.value)} className="mt-1" />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">Apakah kamu memerlukan informasi tentang cara belajar yang baik?</Label>
                    <div className="flex gap-3 mt-2">
                      <Button type="button" size="sm" variant={perluInfo === true ? 'default' : 'outline'} onClick={() => setPerluInfo(true)} className={perluInfo === true ? 'bg-[#006837] hover:bg-[#005830]' : ''}>Ya</Button>
                      <Button type="button" size="sm" variant={perluInfo === false ? 'default' : 'outline'} onClick={() => setPerluInfo(false)} className={perluInfo === false ? 'bg-[#006837] hover:bg-[#005830]' : ''}>Tidak</Button>
                    </div>
                  </div>

                  {perluInfo && (
                    <div>
                      <Label className="text-xs">Topik yang ingin diketahui (boleh pilih lebih dari satu)</Label>
                      <div className="space-y-2 mt-2">
                        {TOPIK_OPTIONS.map((t) => (
                          <label key={t} className="flex items-center gap-2 text-sm">
                            <Checkbox checked={topikDiminati.includes(t)} onCheckedChange={() => toggleTopik(t)} />
                            {t}
                          </label>
                        ))}
                        <Input value={topikLainnya} onChange={(e) => setTopikLainnya(e.target.value)} placeholder="Lain-lain, sebutkan..." className="mt-1" />
                      </div>
                    </div>
                  )}

                  <div>
                    <Label className="text-xs">Tiga kebiasaan belajar yang menurutmu perlu diperbaiki</Label>
                    <div className="space-y-2 mt-2">
                      {[0, 1, 2].map((idx) => (
                        <Input key={idx} value={kebiasaan[idx]} onChange={(e) => {
                          const next = [...kebiasaan]; next[idx] = e.target.value; setKebiasaan(next);
                        }} placeholder={`Kebiasaan ${idx + 1} (opsional)`} />
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button onClick={handleSubmit} disabled={submitting} className="gap-2 bg-[#006837] hover:bg-[#005830]" data-testid="clkb-submit-button">
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
                  <div className="font-semibold">Belum ada riwayat pengisian CLKB</div>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {history.map((h) => (
                    <div key={h.id} className="p-4 flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <div className="text-sm font-semibold text-slate-800">{formatServerTime(h.submitted_at)}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {h.scoring?.total_selected} dipilih ({h.scoring?.completion_percentage}%) ·
                          <span className="text-emerald-600"> +{h.scoring?.plus_count}</span> ·
                          <span className="text-rose-600"> -{h.scoring?.minus_count}</span>
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
          <DialogHeader><DialogTitle>Detail Pengisian CLKB</DialogTitle></DialogHeader>
          {detailItem && (
            <div className="space-y-4 py-2">
              <div className="text-xs text-slate-500">{formatServerTime(detailItem.submitted_at)}</div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-lg bg-slate-50">
                  <div className="text-lg font-bold text-slate-900">{detailItem.scoring?.total_selected}</div>
                  <div className="text-xs text-slate-500">Total Dipilih</div>
                </div>
                <div className="p-3 rounded-lg bg-emerald-50">
                  <div className="text-lg font-bold text-emerald-700 flex items-center justify-center gap-1"><ThumbsUp className="h-4 w-4" />{detailItem.scoring?.plus_count}</div>
                  <div className="text-xs text-emerald-600">Positif</div>
                </div>
                <div className="p-3 rounded-lg bg-rose-50">
                  <div className="text-lg font-bold text-rose-700 flex items-center justify-center gap-1"><ThumbsDown className="h-4 w-4" />{detailItem.scoring?.minus_count}</div>
                  <div className="text-xs text-rose-600">Negatif</div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Jawaban Pernyataan</h3>
                <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-72 overflow-y-auto">
                  {(form?.items || []).map((it) => {
                    const isSelected = (detailItem.selected || []).includes(it.no);
                    return (
                      <div key={it.no} className={`flex items-start gap-2 p-2 text-sm ${isSelected ? 'bg-[#006837]/5' : ''}`}>
                        {isSelected ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <X className="h-3.5 w-3.5 text-slate-300 shrink-0 mt-0.5" />
                        )}
                        <span className={isSelected ? 'text-slate-800' : 'text-slate-400'}>
                          <span className="text-slate-400 mr-1">{it.no}.</span>{it.pernyataan}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 space-y-1.5 text-sm">
                <h3 className="text-sm font-semibold text-slate-700 mb-1">Keterangan Tambahan</h3>
                <div><span className="text-slate-500">Rata-rata belajar:</span> {detailItem.waktu_belajar_jam || <span className="italic text-slate-400">tidak diisi</span>}
                  {(detailItem.waktu_belajar_dari || detailItem.waktu_belajar_sampai) && ` (${detailItem.waktu_belajar_dari || '-'}–${detailItem.waktu_belajar_sampai || '-'})`}
                </div>
                <div><span className="text-slate-500">Perlu info cara belajar:</span> {detailItem.perlu_info_cara_belajar === true ? 'Ya' : detailItem.perlu_info_cara_belajar === false ? 'Tidak' : <span className="italic text-slate-400">tidak diisi</span>}</div>
                {detailItem.perlu_info_cara_belajar && (
                  <div><span className="text-slate-500">Topik diminati:</span> {(detailItem.topik_diminati || []).length > 0 || detailItem.topik_lainnya
                    ? [...(detailItem.topik_diminati || []), detailItem.topik_lainnya].filter(Boolean).join(', ')
                    : <span className="italic text-slate-400">tidak diisi</span>}
                  </div>
                )}
                <div><span className="text-slate-500">Kebiasaan ingin diperbaiki:</span> {detailItem.kebiasaan_diperbaiki?.length > 0
                  ? detailItem.kebiasaan_diperbaiki.join('; ')
                  : <span className="italic text-slate-400">tidak diisi</span>}
                </div>
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
