import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClipboardEdit, History, Loader2, Lock, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { bolehInputTatib, tolakUbahTatib, pesanGalatTatib } from '@/lib/aksesTatib';
import { formatPoin } from '@/components/tatib/RingkasanPoin';
import BannerModeLihat from '@/components/tatib/BannerModeLihat';
import { hariIniWIB } from '@/lib/tanggal';
import {
  ambilKategoriTatib, ambilJenisAturan, ambilSiswaTatib, ambilRiwayatInputTerbaru, simpanInputTatib, poinJenis,
} from '@/lib/inputTatib';

const formKosong = () => ({ siswa_id: '', kategori_id: '', jenis_id: '', tanggal: hariIniWIB(), keterangan: '' });

const warnaPoin = (poin) => (poin < 0 ? 'text-red-700' : 'text-emerald-700');

// Input Tata Tertib terpadu: satu halaman untuk mencatat poin —
// pilih siswa → kategori → jenis aturan (poin otomatis dari master jenis) → tanggal & keterangan,
// dengan daftar pencatatan terbaru di sampingnya.
export default function TatibInputTerpaduPage() {
  const { activeRole } = useAuth();
  const bolehInput = bolehInputTatib(activeRole);
  const [siswaList, setSiswaList] = useState([]);
  const [kategoriList, setKategoriList] = useState([]);
  const [jenisList, setJenisList] = useState([]);
  const [riwayat, setRiwayat] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(formKosong);

  const muatRiwayat = () => ambilRiwayatInputTerbaru().then(setRiwayat);

  useEffect(() => {
    Promise.all([ambilSiswaTatib(), ambilKategoriTatib(), ambilJenisAturan(), ambilRiwayatInputTerbaru()])
      .then(([siswa, kategori, jenis, terbaru]) => {
        setSiswaList(siswa);
        setKategoriList(kategori);
        setJenisList(jenis);
        setRiwayat(terbaru);
      })
      .catch((e) => toast.error(pesanGalatTatib(e, 'Gagal memuat data tata tertib')))
      .finally(() => setLoading(false));
  }, []);

  const jenisTersaring = useMemo(
    () => jenisList.filter((j) => j.aktif !== false && (!form.kategori_id || j.kategori_id === form.kategori_id)),
    [jenisList, form.kategori_id],
  );
  const jenis = jenisList.find((j) => j.id === form.jenis_id);
  const poin = poinJenis(jenis);

  const ubah = (isian) => setForm((f) => ({ ...f, ...isian }));

  const pilihKategori = (v) => {
    const kategori_id = v === 'all' ? '' : v;
    // Jenis yang sudah dipilih dilepas bila tidak termasuk kategori baru.
    const jenisMasihCocok = jenis && (!kategori_id || jenis.kategori_id === kategori_id);
    ubah({ kategori_id, jenis_id: jenisMasihCocok ? form.jenis_id : '' });
  };

  const pilihJenis = (v) => {
    const j = jenisList.find((x) => x.id === v);
    ubah({ jenis_id: j ? v : '', kategori_id: j?.kategori_id || form.kategori_id });
  };

  const simpan = async () => {
    if (tolakUbahTatib(activeRole)) return;
    if (!form.siswa_id || !form.jenis_id || !form.tanggal) {
      toast.error('Siswa, jenis aturan, dan tanggal wajib diisi');
      return;
    }
    setSaving(true);
    try {
      const catatan = await simpanInputTatib(form);
      toast.success(`${catatan.jenis_nama} (${formatPoin(catatan.poin)}) dicatat untuk ${catatan.siswa_nama}`);
      // Siswa & tanggal dipertahankan agar pencatatan beruntun lebih cepat.
      setForm((f) => ({ ...formKosong(), siswa_id: f.siswa_id, tanggal: f.tanggal }));
      await muatRiwayat();
    } catch (e) {
      toast.error(pesanGalatTatib(e, e?.message || 'Gagal menyimpan catatan tata tertib'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6" data-testid="tatib-input-terpadu-page">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ClipboardEdit className="h-6 w-6" /> Input Tata Tertib
        </h1>
        <p className="text-sm text-slate-600">
          Catat poin pelanggaran atau kebaikan siswa dari satu halaman. Nilai poin mengikuti master jenis aturan.
        </p>
      </div>

      {!bolehInput && <BannerModeLihat />}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Catat Tata Tertib</CardTitle>
            <CardDescription>Pilih siswa, kategori, dan jenis aturan, lalu isi tanggal dan keterangan.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-10 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Memuat data...
              </div>
            ) : (
              <fieldset disabled={!bolehInput} className="space-y-4">
                <div>
                  <Label>Siswa*</Label>
                  <Select value={form.siswa_id || 'none'} onValueChange={(v) => ubah({ siswa_id: v === 'none' ? '' : v })}>
                    <SelectTrigger data-testid="input-tatib-siswa"><SelectValue placeholder="Pilih Siswa" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Pilih Siswa</SelectItem>
                      {siswaList.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.nis || '-'} - {s.full_name}{s.class_name ? ` (${s.class_name})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                  <div>
                    <Label>Kategori</Label>
                    <Select value={form.kategori_id || 'all'} onValueChange={pilihKategori}>
                      <SelectTrigger data-testid="input-tatib-kategori"><SelectValue placeholder="Semua Kategori" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua Kategori</SelectItem>
                        {kategoriList.map((k) => <SelectItem key={k.id} value={k.id}>{k.nama}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Jenis aturan*</Label>
                    <Select value={form.jenis_id || 'none'} onValueChange={pilihJenis}>
                      <SelectTrigger data-testid="input-tatib-jenis"><SelectValue placeholder="Pilih Jenis" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Pilih Jenis</SelectItem>
                        {jenisTersaring.map((j) => (
                          <SelectItem key={j.id} value={j.id}>
                            [{j.kode_aturan}] {j.nama} ({formatPoin(poinJenis(j))})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div
                  className={`flex items-center justify-between gap-3 rounded-lg px-4 py-3 ${poin == null ? 'bg-slate-50' : poin < 0 ? 'bg-red-50' : 'bg-emerald-50'}`}
                  data-testid="input-tatib-poin"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                      <Lock className="h-3.5 w-3.5" /> Poin otomatis
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {jenis ? `${jenis.kategori_nama} · ${jenis.nama}` : 'Pilih jenis aturan untuk melihat nilai poin'}
                    </p>
                  </div>
                  <span className={`shrink-0 text-2xl font-bold tabular-nums ${poin == null ? 'text-slate-400' : warnaPoin(poin)}`}>
                    {poin == null ? '—' : formatPoin(poin)}
                  </span>
                </div>

                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                  <div>
                    <Label>Tanggal*</Label>
                    <Input type="date" value={form.tanggal} max={hariIniWIB()} onChange={(e) => ubah({ tanggal: e.target.value })} data-testid="input-tatib-tanggal" />
                  </div>
                  <div>
                    <Label>Keterangan</Label>
                    <Textarea
                      value={form.keterangan}
                      onChange={(e) => ubah({ keterangan: e.target.value })}
                      placeholder="Kronologi singkat atau catatan (opsional)"
                      rows={2}
                      data-testid="input-tatib-keterangan"
                    />
                  </div>
                </div>

                {bolehInput && (
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setForm(formKosong())} disabled={saving}>Reset</Button>
                    <Button onClick={simpan} disabled={saving} data-testid="input-tatib-simpan">
                      {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                      Simpan
                    </Button>
                  </div>
                )}
              </fieldset>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><History className="h-5 w-5" /> Pencatatan Terbaru</CardTitle>
            <CardDescription>Periksa kembali catatan terakhir yang masuk.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
            ) : riwayat.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">Belum ada pencatatan.</p>
            ) : (
              <ul className="divide-y" data-testid="input-tatib-riwayat">
                {riwayat.map((r) => (
                  <li key={r.id} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{r.siswa_nama} <span className="text-xs font-normal text-slate-500">{r.siswa_kelas}</span></p>
                      <p className="text-sm text-slate-700 truncate">[{r.kode_aturan}] {r.jenis_nama}</p>
                      <p className="text-xs text-slate-500">
                        {r.tanggal} · <Badge variant="outline" className="px-1.5 py-0 text-[11px]">{r.kategori_nama}</Badge>
                        {r.keterangan ? ` · ${r.keterangan}` : ''}
                      </p>
                    </div>
                    <span className={`shrink-0 font-semibold tabular-nums ${warnaPoin(r.poin)}`}>{formatPoin(r.poin)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
