import React, { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, DoorClosed, Loader2, RefreshCw, AlertTriangle, Info, Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { confirmDialog } from '@/components/ui/confirm-dialog';
import FormRuangDialog from '@/components/ujian/FormRuangDialog';
import PesertaRuangPanel from '@/components/ujian/PesertaRuangPanel';
import IndikatorPlotting from '@/components/ujian/IndikatorPlotting';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/ui/EmptyState';
import AksesDitolak from '@/components/security/AksesDitolak';
import PilihUjian from '@/components/ujian/PilihUjian';
import DaftarRuang, { BadgeJenjang } from '@/components/ujian/DaftarRuang';
import { HALAMAN_BERANDA_UJIAN, aksesDitolak, pesanGalat } from '@/lib/ujian';
import { hapusRuang, muatRuangUjian } from '@/lib/ujianRuang';

// Kesiapan plotting: hal yang masih perlu dilengkapi sebelum formulir dibuka.
function Kesiapan({ k }) {
  if (!k) return null;
  if (k.siap) {
    return <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800" data-testid="kesiapan-plotting">Semua siswa sudah ditempatkan dan bernomor peserta.</p>;
  }
  const butir = [
    k.belum_ditempatkan > 0 && `${k.belum_ditempatkan} siswa belum ditempatkan`,
    k.tanpa_nomor > 0 && `${k.tanpa_nomor} peserta belum bernomor`,
    k.ruang_kosong?.length > 0 && `ruang kosong: ${k.ruang_kosong.join(', ')}`,
  ].filter(Boolean);
  if (!butir.length) return null;
  return (
    <p className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" data-testid="kesiapan-plotting">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Belum lengkap: {butir.join(' · ')}.
    </p>
  );
}

function Ringkasan({ r }) {
  const kartu = [
    { label: 'Ruang Ujian', nilai: r.jumlah_ruang, kelas: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
    { label: 'Peserta Ditempatkan', nilai: r.jumlah_peserta, kelas: 'bg-sky-50 border-sky-200 text-sky-700' },
    { label: 'Kapasitas Total', nilai: r.kapasitas, kelas: 'bg-slate-50 border-slate-200 text-slate-600' },
    { label: 'Belum Ditempatkan', nilai: r.belum_ditempatkan, kelas: r.belum_ditempatkan ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-slate-50 border-slate-200 text-slate-600' },
  ];
  return (
    <div className="space-y-3" data-testid="ruang-ringkasan">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kartu.map((k) => (
          <div key={k.label} className={`rounded-xl border p-3 ${k.kelas}`}>
            <div className="text-2xl font-bold">{k.nilai ?? 0}</div>
            <div className="text-xs font-medium">{k.label}</div>
          </div>
        ))}
      </div>
      {Object.keys(r.per_jenjang || {}).length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
          Peserta per jenjang: {Object.entries(r.per_jenjang).map(([j, n]) => <BadgeJenjang key={j} jenjang={Number(j)} jumlah={n} />)}
        </div>
      )}
    </div>
  );
}

/**
 * Ruang & Peserta (/ujian/ruang?ujian=<id>): ruang ujian satu ujian (boleh campuran dua jenjang), keterisiannya, dan
 * pengelompokan siswa ke ruang beserta nomor peserta. Penempatan ditetapkan sekali untuk seluruh masa ujian; hanya
 * admin yang mengubah, ketua & sekretaris panitia melihat.
 */
export default function UjianRuangPage() {
  const [ujian, setUjian] = useState(null);
  const [data, setData] = useState(null);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState('');
  const [ditolak, setDitolak] = useState('');

  const [tab, setTab] = useState('ruang');
  const muat = useCallback(async (u, { diam = false } = {}) => {
    if (!u) { setData(null); return; }
    if (!diam) setMemuat(true);
    try {
      setData(await muatRuangUjian(u.id));
      setGalat('');
      setDitolak('');
    } catch (e) {
      if (aksesDitolak(e)) setDitolak(pesanGalat(e, 'Akses ditolak.'));
      else setGalat(pesanGalat(e, 'Gagal memuat ruang ujian. Periksa koneksi lalu coba lagi.'));
    } finally {
      setMemuat(false);
    }
  }, []);

  const gantiUjian = useCallback((u) => { setUjian(u); muat(u); }, [muat]);
  const [formRuang, setFormRuang] = useState(null);

  const hapus = async (ruang) => {
    if (!(await confirmDialog(`Hapus Ruang ${ruang.nama_ruang}? Ruang yang masih berisi peserta tidak dapat dihapus.`, { confirmText: 'Hapus' }))) return;
    try {
      const h = await hapusRuang(ujian.id, ruang.id);
      toast.success(`Ruang ${ruang.nama_ruang} dihapus${h.tiruan ? ' (contoh)' : ''}`);
      muat(ujian);
    } catch (e) {
      toast.error(pesanGalat(e, 'Gagal menghapus ruang.'));
    }
  };

  const aksiRuang = data?.boleh_ubah ? (r) => (
    <div className="flex shrink-0 gap-1">
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setFormRuang({ ruang: r })} aria-label={`Ubah ruang ${r.nama_ruang}`} data-testid={`btn-ubah-ruang-${r.id}`}>
        <Pencil className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => hapus(r)} aria-label={`Hapus ruang ${r.nama_ruang}`} data-testid={`btn-hapus-ruang-${r.id}`}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  ) : undefined;

  return (
    <div className="space-y-6" data-testid="ujian-ruang">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link to={HALAMAN_BERANDA_UJIAN} className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-[#006837] hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> Beranda Ujian
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2">
            <DoorClosed className="h-7 w-7 text-[#006837]" /> Ruang & Peserta
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Ruang ujian, pengelompokan siswa ke ruang, dan nomor peserta. Ditetapkan sekali untuk seluruh hari dan sesi ujian.
          </p>
        </div>
        <Button variant="outline" onClick={() => muat(ujian)} disabled={memuat || !ujian} className="gap-2 self-start sm:self-auto" data-testid="btn-muat-ulang-ruang">
          {memuat ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Muat Ulang
        </Button>
      </div>

      <PilihUjian onUbah={gantiUjian} />

      {ditolak && <AksesDitolak halaman="Ruang & Peserta" untuk="admin serta ketua dan sekretaris panitia ujian ini" pesan={ditolak} />}
      {data?.tiruan && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" data-testid="info-tiruan-ruang">
          Server belum menyediakan data ruang — menampilkan data contoh untuk mencoba tampilan. Perubahan tidak tersimpan.
        </p>
      )}
      {galat && (
        <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800" role="alert">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {galat}
        </div>
      )}

      {!ditolak && data && (
        <>
          {!data.boleh_ubah && (
            <p className="flex items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
              <Info className="h-4 w-4 shrink-0" /> Anda melihat sebagai panitia. Perubahan ruang dan peserta hanya dapat dilakukan admin.
            </p>
          )}
          <IndikatorPlotting ujian={ujian} plotting={data.plotting} bolehUbah={data.boleh_ubah} />
          <Ringkasan r={data.ringkasan || {}} />
          <Kesiapan k={data.kesiapan} />
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="ruang" data-testid="tab-daftar-ruang">Daftar Ruang</TabsTrigger>
              <TabsTrigger value="peserta" data-testid="tab-peserta-ruang">Peserta per Ruang</TabsTrigger>
            </TabsList>
            <TabsContent value="ruang" className="mt-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
                  <CardTitle className="text-base">Daftar Ruang Ujian</CardTitle>
                  {data.boleh_ubah && (
                    <Button size="sm" onClick={() => setFormRuang({ ruang: null })} className="gap-1 bg-[#006837] hover:bg-[#00552d]" data-testid="btn-tambah-ruang">
                      <Plus className="h-4 w-4" /> Tambah Ruang
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {data.items.length ? <DaftarRuang items={data.items} aksi={aksiRuang} /> : (
                    <EmptyState illustration="mosque" size="sm" title="Belum ada ruang ujian"
                      description={data.boleh_ubah
                        ? 'Tambahkan ruang ujian terlebih dahulu, mis. Ruang 01 untuk kelas 7 dan 8. Satu ruang boleh dipakai dua jenjang sekaligus.'
                        : 'Admin belum menambahkan ruang untuk ujian ini.'}
                      {...(data.boleh_ubah ? { actionLabel: 'Tambah Ruang Pertama', onAction: () => setFormRuang({ ruang: null }) } : {})} />
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="peserta" className="mt-4">
              <PesertaRuangPanel ujian={ujian} ruangList={data.items} bolehUbah={data.boleh_ubah} onBerubah={() => muat(ujian, { diam: true })} />
            </TabsContent>
          </Tabs>
        </>
      )}
      {!data && memuat && <div className="p-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#006837]" /></div>}
      {ujian && (
        <FormRuangDialog ujianId={ujian.id} sasaran={formRuang} onTutup={() => setFormRuang(null)}
          onTersimpan={() => { setFormRuang(null); muat(ujian); }} />
      )}
    </div>
  );
}
