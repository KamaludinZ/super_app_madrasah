import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { confirmDialog } from '@/components/ui/confirm-dialog';
import { ArrowLeft, Loader2, RefreshCw, Search, Trash2, UserCheck, UserPlus, AlertTriangle, Info } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import AksesDitolak from '@/components/security/AksesDitolak';
import TambahPengawasDialog from '@/components/ujian/TambahPengawasDialog';
import { ROLE_LABELS } from '@/lib/api';
import { HALAMAN_BERANDA_UJIAN, aksesDitolak, pesanGalat } from '@/lib/ujian';
import { aturAktifPengawas, hapusPengawas, muatPengawas } from '@/lib/ujianPengawas';

/**
 * Master Guru Pengawas (/ujian/pengawas): daftar guru yang muncul sebagai pilihan nama pengawas pada berita acara
 * publik. Berlaku untuk semua ujian, tanpa plotting per ruang. Admin menambah dari akun GTK, menonaktifkan, atau
 * menghapus (yang belum pernah dipakai); ketua & sekretaris panitia melihat.
 */
export default function UjianPengawasPage() {
  const [data, setData] = useState(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState('');
  const [ditolak, setDitolak] = useState('');
  const [cari, setCari] = useState('');
  const [tambah, setTambah] = useState(false);
  const [proses, setProses] = useState(null);

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      setData(await muatPengawas());
      setGalat('');
    } catch (e) {
      if (aksesDitolak(e)) setDitolak(pesanGalat(e, 'Akses ditolak.'));
      else setGalat(pesanGalat(e, 'Gagal memuat guru pengawas.'));
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => { muat(); }, [muat]);

  const items = useMemo(() => data?.items || [], [data]);
  const tampil = useMemo(() => {
    const q = cari.toLowerCase().trim();
    return [...items]
      .filter((p) => !q || `${p.nama} ${p.nip}`.toLowerCase().includes(q))
      .sort((a, b) => Number(b.aktif) - Number(a.aktif) || a.nama.localeCompare(b.nama));
  }, [items, cari]);
  const sudah = useMemo(() => new Set(items.map((p) => p.user_id)), [items]);

  const aturAktif = async (p, aktif) => {
    setProses(p.id);
    try {
      await aturAktifPengawas(p.id, aktif);
      setData((d) => ({ ...d, items: d.items.map((x) => (x.id === p.id ? { ...x, aktif } : x)) }));
      toast.success(`${p.nama} ${aktif ? 'diaktifkan' : 'dinonaktifkan'} sebagai pengawas`);
    } catch (e) {
      toast.error(pesanGalat(e, 'Gagal mengubah status pengawas.'));
    } finally {
      setProses(null);
    }
  };

  const hapus = async (p) => {
    if (!(await confirmDialog(`Hapus ${p.nama} dari master guru pengawas?`, { confirmText: 'Hapus' }))) return;
    setProses(p.id);
    try {
      await hapusPengawas(p.id);
      toast.success(`${p.nama} dihapus dari master pengawas`);
      muat();
    } catch (e) {
      toast.error(pesanGalat(e, 'Gagal menghapus pengawas.'));
    } finally {
      setProses(null);
    }
  };

  if (ditolak) return <AksesDitolak halaman="Guru Pengawas" untuk="admin serta ketua dan sekretaris panitia" pesan={ditolak} />;

  const aktif = items.filter((p) => p.aktif).length;

  return (
    <div className="space-y-6" data-testid="ujian-pengawas">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link to={HALAMAN_BERANDA_UJIAN} className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-[#006837] hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> Beranda Ujian
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2">
            <UserCheck className="h-7 w-7 text-[#006837]" /> Guru Pengawas
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Master pilihan nama pengawas pada berita acara. Tidak ada plotting pengawas per ruang.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 self-start sm:self-auto">
          <Button variant="outline" onClick={muat} disabled={memuat} className="gap-2" data-testid="btn-muat-ulang-pengawas">
            {memuat ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Muat Ulang
          </Button>
          {data?.boleh_ubah && (
            <Button onClick={() => setTambah(true)} className="gap-2 bg-[#006837] hover:bg-[#00552d]" data-testid="btn-tambah-pengawas">
              <UserPlus className="h-4 w-4" /> Tambah Pengawas
            </Button>
          )}
        </div>
      </div>

      {data?.tiruan && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" data-testid="info-tiruan-pengawas">
          Server belum menyediakan data pengawas — menampilkan data contoh untuk mencoba tampilan. Perubahan tidak tersimpan.
        </p>
      )}
      {galat && (
        <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800" role="alert">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {galat}
        </div>
      )}
      {data && !data.boleh_ubah && (
        <p className="flex items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
          <Info className="h-4 w-4 shrink-0" /> Anda melihat sebagai panitia. Perubahan master pengawas hanya oleh admin.
        </p>
      )}

      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari nama atau NIP…" className="pl-9" aria-label="Cari pengawas" />
            </div>
            <p className="text-xs text-slate-500">{aktif} aktif dari {items.length} pengawas</p>
          </div>
          {!data && memuat ? (
            <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#006837]" /></div>
          ) : tampil.length === 0 ? (
            <EmptyState illustration="mosque" size="sm" title={items.length ? 'Pengawas tidak ditemukan' : 'Belum ada guru pengawas'}
              description="Tambahkan guru dari akun GTK agar namanya bisa dipilih pada berita acara." />
          ) : (
            <ul className="divide-y divide-slate-100" data-testid="daftar-pengawas">
              {tampil.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-3" data-testid={`pengawas-${p.id}`}>
                  <div className="min-w-0 flex-1">
                    <div className={`truncate text-sm font-medium ${p.aktif ? 'text-slate-900' : 'text-slate-400 line-through decoration-slate-300'}`}>{p.nama}</div>
                    <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                      <span>{p.nip && p.nip !== '-' ? `NIP ${p.nip}` : 'NIP -'}</span>
                      {p.peran && <span>· {ROLE_LABELS[p.peran] || p.peran}</span>}
                      {p.dipakai > 0 && <Badge variant="outline" className="font-normal">{p.dipakai} berita acara</Badge>}
                    </div>
                  </div>
                  {data.boleh_ubah ? (
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 text-xs text-slate-600">
                        <Switch checked={p.aktif} disabled={proses === p.id} onCheckedChange={(v) => aturAktif(p, v)} aria-label={`${p.aktif ? 'Nonaktifkan' : 'Aktifkan'} ${p.nama}`} />
                        <span className="hidden sm:inline">{p.aktif ? 'Aktif' : 'Nonaktif'}</span>
                      </label>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600 hover:bg-rose-50" disabled={proses === p.id}
                        onClick={() => hapus(p)} aria-label={`Hapus ${p.nama}`} data-testid={`btn-hapus-pengawas-${p.id}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Badge className={p.aktif ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}>
                      {p.aktif ? 'Aktif' : 'Nonaktif'}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <TambahPengawasDialog buka={tambah} sudah={sudah} onTutup={() => setTambah(false)} onTersimpan={() => { setTambah(false); muat(); }} />
    </div>
  );
}
