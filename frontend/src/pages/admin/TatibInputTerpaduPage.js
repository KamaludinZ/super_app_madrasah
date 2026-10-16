import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ClipboardEdit, History, Loader2, Lock, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { bolehInputTatib, bolehHapusTatib, tolakUbahTatib, pesanGalatTatib } from '@/lib/aksesTatib';
import { confirmDialog } from '@/components/ui/confirm-dialog';
import { formatPoin } from '@/components/tatib/RingkasanPoin';
import BannerModeLihat from '@/components/tatib/BannerModeLihat';
import PilihSiswaTatib from '@/components/tatib/PilihSiswaTatib';
import PilihKategoriTatib from '@/components/tatib/PilihKategoriTatib';
import KelolaKategoriInline from '@/components/tatib/KelolaKategoriInline';
import PilihJenisAturan from '@/components/tatib/PilihJenisAturan';
import RiwayatInputTerbaru from '@/components/tatib/RiwayatInputTerbaru';
import { Switch } from '@/components/ui/switch';
import { hariIniWIB } from '@/lib/tanggal';
import {
  ambilKategoriTatib, ambilJenisAturan, ambilSiswaTatib, ambilRiwayatInputTerbaru, simpanInputTatib, poinJenis,
  simpanKategoriTatib, ubahInputTatib, hapusInputTatib,
} from '@/lib/inputTatib';

const MAKS_KETERANGAN = 500;
const BATAS_RIWAYAT = 10;

// Tanggal kemarin (YYYY-MM-DD) relatif terhadap hari ini WIB.
const kemarinWIB = () => {
  const d = new Date(`${hariIniWIB()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

const formKosong = () => ({ siswa_id: '', kategori_id: '', jenis_id: '', tanggal: hariIniWIB(), keterangan: '' });

const warnaPoin = (poin) => (poin < 0 ? 'text-red-700' : 'text-emerald-700');

// Input Tata Tertib terpadu: satu halaman untuk mencatat poin —
// pilih siswa → kategori → jenis aturan (poin otomatis dari master jenis) → tanggal & keterangan,
// dengan daftar pencatatan terbaru di sampingnya.
export default function TatibInputTerpaduPage() {
  const { activeRole } = useAuth();
  const bolehInput = bolehInputTatib(activeRole);
  const bolehHapus = bolehHapusTatib(activeRole);
  const [siswaList, setSiswaList] = useState([]);
  const [kategoriList, setKategoriList] = useState([]);
  const [jenisList, setJenisList] = useState([]);
  const [riwayat, setRiwayat] = useState({ items: [], ada_lagi: false });
  const [memuatRiwayat, setMemuatRiwayat] = useState(true);
  const [batasRiwayat, setBatasRiwayat] = useState(BATAS_RIWAYAT);
  const [hanyaSiswaTerpilih, setHanyaSiswaTerpilih] = useState(false);
  const [versiRiwayat, setVersiRiwayat] = useState(0);
  const [idBaru, setIdBaru] = useState(null);
  const [diperbaiki, setDiperbaiki] = useState(null); // catatan yang sedang diperbaiki di form
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(formKosong);

  useEffect(() => {
    Promise.all([ambilSiswaTatib(), ambilKategoriTatib(), ambilJenisAturan()])
      .then(([siswa, kategori, jenis]) => {
        setSiswaList(siswa);
        setKategoriList(kategori);
        setJenisList(jenis);
      })
      .catch((e) => toast.error(pesanGalatTatib(e, 'Gagal memuat data tata tertib')))
      .finally(() => setLoading(false));
  }, []);

  // Riwayat dimuat ulang saat batas, filter siswa, atau versi (setelah simpan) berubah.
  const siswaRiwayat = hanyaSiswaTerpilih ? form.siswa_id : '';
  useEffect(() => {
    let batal = false;
    setMemuatRiwayat(true);
    ambilRiwayatInputTerbaru({ batas: batasRiwayat, siswa_id: siswaRiwayat || undefined })
      .then((hasil) => { if (!batal) setRiwayat(hasil); })
      .catch((e) => toast.error(pesanGalatTatib(e, 'Gagal memuat pencatatan terbaru')))
      .finally(() => { if (!batal) setMemuatRiwayat(false); });
    return () => { batal = true; };
  }, [batasRiwayat, siswaRiwayat, versiRiwayat]);

  const jenisTersaring = useMemo(
    // Saat memperbaiki, jenis lama tetap tampil walau sudah nonaktif.
    () => jenisList.filter((j) => (j.aktif !== false || j.id === diperbaiki?.jenis_id) && (!form.kategori_id || j.kategori_id === form.kategori_id)),
    [jenisList, form.kategori_id, diperbaiki],
  );
  const jenis = jenisList.find((j) => j.id === form.jenis_id);
  const poin = poinJenis(jenis);

  const ubah = (isian) => setForm((f) => ({ ...f, ...isian }));
  // Format YYYY-MM-DD bisa dibandingkan sebagai teks.
  const galatTanggal = form.tanggal && form.tanggal > hariIniWIB() ? 'Tanggal kejadian tidak boleh melewati hari ini' : '';

  const jumlahJenis = useMemo(() => {
    const n = {};
    jenisList.filter((j) => j.aktif !== false).forEach((j) => { n[j.kategori_id] = (n[j.kategori_id] || 0) + 1; });
    return n;
  }, [jenisList]);

  const pilihKategori = (kategori_id) => {
    // Jenis yang sudah dipilih dilepas bila tidak termasuk kategori baru.
    const jenisMasihCocok = jenis && (!kategori_id || jenis.kategori_id === kategori_id);
    ubah({ kategori_id, jenis_id: jenisMasihCocok ? form.jenis_id : '' });
  };

  // Kategori ditambah/diubah dari halaman ini; daftar jenis dimuat ulang agar nama kategorinya ikut berubah.
  const simpanKategori = async (isian) => {
    if (tolakUbahTatib(activeRole)) throw new Error('Tidak berhak mengubah kategori');
    const kategori = await simpanKategoriTatib(isian);
    const [kategoriBaru, jenisBaru] = await Promise.all([ambilKategoriTatib(), ambilJenisAturan()]);
    setKategoriList(kategoriBaru);
    setJenisList(jenisBaru);
    if (!isian.id) pilihKategori(kategori.id);
    return kategori;
  };

  const perbaiki = (catatan) => {
    if (tolakUbahTatib(activeRole)) return;
    setDiperbaiki(catatan);
    setForm({
      siswa_id: catatan.siswa_id,
      kategori_id: catatan.kategori_id || '',
      jenis_id: catatan.jenis_id,
      tanggal: (catatan.tanggal || '').slice(0, 10),
      keterangan: catatan.keterangan || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const batalPerbaiki = () => {
    setDiperbaiki(null);
    setForm(formKosong());
  };

  const hapus = async (catatan) => {
    if (tolakUbahTatib(activeRole, { hapus: true })) return;
    if (!(await confirmDialog(`Hapus catatan "${catatan.jenis_nama}" untuk ${catatan.siswa_nama}?`))) return;
    try {
      await hapusInputTatib(catatan.id);
      toast.success('Catatan tata tertib dihapus');
      if (diperbaiki?.id === catatan.id) batalPerbaiki();
      setVersiRiwayat((v) => v + 1);
    } catch (e) {
      toast.error(pesanGalatTatib(e, e?.message || 'Gagal menghapus catatan'));
    }
  };

  const pilihJenis = (v) => {
    const j = jenisList.find((x) => x.id === v);
    ubah({ jenis_id: j ? v : '', kategori_id: j?.kategori_id || form.kategori_id });
  };

  const simpan = async () => {
    if (tolakUbahTatib(activeRole)) return;
    if (!form.siswa_id || !form.jenis_id || !form.tanggal) {
      toast.error('Siswa, jenis aturan, dan tanggal kejadian wajib diisi');
      return;
    }
    if (galatTanggal) {
      toast.error(galatTanggal);
      return;
    }
    setSaving(true);
    try {
      const catatan = diperbaiki ? await ubahInputTatib(diperbaiki.id, form) : await simpanInputTatib(form);
      toast.success(diperbaiki
        ? `Catatan ${catatan.siswa_nama} diperbaiki (${formatPoin(catatan.poin)})`
        : `${catatan.jenis_nama} (${formatPoin(catatan.poin)}) dicatat untuk ${catatan.siswa_nama}`);
      // Siswa & tanggal dipertahankan agar pencatatan beruntun lebih cepat.
      setForm((f) => ({ ...formKosong(), siswa_id: f.siswa_id, tanggal: f.tanggal }));
      setDiperbaiki(null);
      setIdBaru(catatan.id);
      setVersiRiwayat((v) => v + 1);
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
            <CardTitle className="text-lg">{diperbaiki ? 'Perbaiki Catatan' : 'Catat Tata Tertib'}</CardTitle>
            <CardDescription>
              {diperbaiki
                ? `Mengubah catatan ${diperbaiki.siswa_nama} tanggal ${diperbaiki.tanggal}. Poin dihitung ulang dari jenis yang dipilih.`
                : 'Pilih siswa, kategori, dan jenis aturan, lalu isi tanggal dan keterangan.'}
            </CardDescription>
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
                  <PilihSiswaTatib
                    siswaList={siswaList}
                    value={form.siswa_id}
                    onPilih={(siswa_id) => ubah({ siswa_id })}
                    disabled={!bolehInput}
                    testid="input-tatib-siswa"
                  />
                </div>

                <div>
                  <Label className="mb-2 block">Kategori</Label>
                  <PilihKategoriTatib
                    kategoriList={kategoriList}
                    value={form.kategori_id}
                    onPilih={pilihKategori}
                    jumlahJenis={jumlahJenis}
                    disabled={!bolehInput}
                    testid="input-tatib-kategori"
                  />
                  <div className="mt-2">
                    <KelolaKategoriInline
                      kategori={kategoriList.find((k) => k.id === form.kategori_id)}
                      onSimpan={simpanKategori}
                      disabled={!bolehInput}
                    />
                  </div>
                </div>

                <div>
                  <Label>Jenis aturan*</Label>
                  <PilihJenisAturan
                    jenisList={jenisTersaring}
                    value={form.jenis_id}
                    onPilih={pilihJenis}
                    disabled={!bolehInput}
                    testid="input-tatib-jenis"
                  />
                </div>

                <div
                  className={`flex items-center justify-between gap-3 rounded-lg px-4 py-3 ${poin == null ? 'bg-slate-50' : poin < 0 ? 'bg-red-50' : 'bg-emerald-50'}`}
                  data-testid="input-tatib-poin"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                      <Lock className="h-3.5 w-3.5" /> Poin otomatis
                      {jenis && (
                        <Badge variant="outline" className={`ml-1 px-1.5 py-0 text-[11px] ${warnaPoin(poin)}`}>
                          {jenis.jalur_poin === 'minus' ? 'Pelanggaran' : 'Kebaikan'}
                        </Badge>
                      )}
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
                    <Label htmlFor="input-tatib-tanggal">Tanggal kejadian*</Label>
                    <Input
                      id="input-tatib-tanggal"
                      type="date"
                      value={form.tanggal}
                      max={hariIniWIB()}
                      onChange={(e) => ubah({ tanggal: e.target.value })}
                      aria-invalid={Boolean(galatTanggal)}
                      className={galatTanggal ? 'border-red-500' : ''}
                      data-testid="input-tatib-tanggal"
                    />
                    {galatTanggal ? (
                      <p className="mt-1 text-xs text-red-600">{galatTanggal}</p>
                    ) : (
                      <div className="mt-1 flex gap-1">
                        {[['Hari ini', hariIniWIB()], ['Kemarin', kemarinWIB()]].map(([label, tgl]) => (
                          <button
                            key={label}
                            type="button"
                            onClick={() => ubah({ tanggal: tgl })}
                            className={`rounded px-2 py-0.5 text-xs ${form.tanggal === tgl ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="input-tatib-keterangan">Keterangan</Label>
                    <Textarea
                      id="input-tatib-keterangan"
                      value={form.keterangan}
                      onChange={(e) => ubah({ keterangan: e.target.value.slice(0, MAKS_KETERANGAN) })}
                      placeholder="Kronologi singkat, lokasi, atau saksi (opsional)"
                      rows={3}
                      data-testid="input-tatib-keterangan"
                    />
                    <p className="mt-1 text-right text-xs text-slate-400 tabular-nums">{form.keterangan.length}/{MAKS_KETERANGAN}</p>
                  </div>
                </div>

                {bolehInput && (
                  <div className="flex justify-end gap-2">
                    {diperbaiki ? (
                      <Button variant="outline" onClick={batalPerbaiki} disabled={saving} data-testid="input-tatib-batal-perbaiki">Batal perbaiki</Button>
                    ) : (
                      <Button variant="outline" onClick={() => setForm(formKosong())} disabled={saving}>Reset</Button>
                    )}
                    <Button onClick={simpan} disabled={saving} data-testid="input-tatib-simpan">
                      {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                      {diperbaiki ? 'Simpan perbaikan' : 'Simpan'}
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
            {form.siswa_id && (
              <label className="mb-2 flex items-center gap-2 text-sm text-slate-600">
                <Switch
                  checked={hanyaSiswaTerpilih}
                  onCheckedChange={(v) => { setHanyaSiswaTerpilih(v); setBatasRiwayat(BATAS_RIWAYAT); }}
                  data-testid="input-tatib-riwayat-siswa"
                />
                Hanya siswa terpilih
              </label>
            )}
            <RiwayatInputTerbaru
              items={riwayat.items}
              loading={memuatRiwayat && riwayat.items.length === 0}
              memuatLagi={memuatRiwayat}
              adaLagi={riwayat.ada_lagi}
              onMuatLagi={() => setBatasRiwayat((n) => n + BATAS_RIWAYAT)}
              idBaru={idBaru}
              idDiperbaiki={diperbaiki?.id}
              onPerbaiki={bolehInput ? perbaiki : undefined}
              onHapus={bolehHapus ? hapus : undefined}
              kosong={siswaRiwayat ? 'Siswa ini belum punya pencatatan.' : 'Belum ada pencatatan.'}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
