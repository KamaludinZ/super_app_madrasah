import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useIdleTimeout } from '@/lib/useIdleTimeout';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { adalahGtk } from '@/lib/menuUmum';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Lock, LockKeyhole, Search, X, Plus } from 'lucide-react';
import KartuAkun from '@/components/simpan-akun/KartuAkun';
import KosongAkun from '@/components/simpan-akun/KosongAkun';
import DetailAkunDialog from '@/components/simpan-akun/DetailAkunDialog';
import GerbangPin from '@/components/simpan-akun/GerbangPin';
import FormAkunDialog from '@/components/simpan-akun/FormAkunDialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ambilDaftarAkun, kunciBrankas, onSesiBerakhir } from '@/lib/simpanAkun';

// Simpan Akun: brankas privat GTK untuk menyimpan akun-akun aplikasi madrasah.
// Isi brankas baru dimuat setelah PIN benar; kunci terbuka hanya selama halaman ini terbuka
// (meninggalkan menu = terkunci lagi).
const MENIT_KUNCI_OTOMATIS = 5;

export default function SimpanAkunPage() {
  const { activeRole } = useAuth();
  const [terbuka, setTerbuka] = useState(false);
  const [daftar, setDaftar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cari, setCari] = useState('');
  const [aplikasi, setAplikasi] = useState('');
  const [dipilihId, setDipilihId] = useState(null);
  // null = form tertutup; {} = tambah akun baru; {id, ...} = ubah akun.
  const [formAkun, setFormAkun] = useState(null);
  const [versi, setVersi] = useState(0);

  useEffect(() => {
    if (!terbuka) return;
    setLoading(true);
    ambilDaftarAkun()
      .then(setDaftar)
      .catch((e) => { if (!e.sesiBerakhir) toast.error(e.message || 'Gagal memuat daftar akun'); })
      .finally(() => setLoading(false));
  }, [terbuka, versi]);

  const kunci = useCallback(() => {
    kunciBrankas();
    setTerbuka(false);
    setDaftar([]);
    setDipilihId(null);
    setFormAkun(null);
    setCari('');
    setAplikasi('');
  }, []);

  // Kunci otomatis setelah beberapa menit tanpa aktivitas selama brankas terbuka.
  const kunciOtomatis = useCallback(() => {
    kunci();
    toast.info('Simpan Akun terkunci otomatis karena tidak ada aktivitas');
  }, [kunci]);
  useIdleTimeout(terbuka ? MENIT_KUNCI_OTOMATIS : 0, kunciOtomatis);

  // Sesi brankas (token PIN) berakhir di server -> kunci lagi; meninggalkan menu juga mengunci brankas.
  useEffect(() => onSesiBerakhir(() => {
    kunci();
    toast.info('Sesi Simpan Akun berakhir. Masukkan PIN kembali.');
  }), [kunci]);
  useEffect(() => () => kunciBrankas(), []);

  const daftarAplikasi = useMemo(
    () => [...new Set(daftar.map((a) => a.nama_aplikasi).filter(Boolean))].sort((x, y) => x.localeCompare(y, 'id')),
    [daftar],
  );

  // Cari berdasarkan nama akun atau nama aplikasi (tanpa membedakan huruf besar/kecil).
  const tersaring = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return daftar.filter((a) => (!aplikasi || a.nama_aplikasi === aplikasi)
      && (!q || `${a.nama_akun} ${a.nama_aplikasi}`.toLowerCase().includes(q)));
  }, [daftar, cari, aplikasi]);

  const aturUlang = () => {
    setCari('');
    setAplikasi('');
  };

  // Simpan Akun hanya untuk GTK (siswa, akun kelas, orang tua, alumni dialihkan).
  if (!adalahGtk(activeRole)) return <Navigate to="/dashboard" replace />;

  return (
    <div className="space-y-6" data-testid="simpan-akun-page">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <Lock className="h-3 w-3 mr-1" /> Privat
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Simpan Akun</h1>
          <p className="text-sm text-slate-600 mt-1">Semua akun aplikasi madrasah milik Anda di satu tempat. Hanya Anda yang dapat membukanya.</p>
        </div>
        {terbuka && (
          <div className="flex gap-2">
            <Button onClick={() => setFormAkun({})} className="bg-[#006837] hover:bg-[#005830]" data-testid="simpan-akun-tambah">
              <Plus className="mr-2 h-4 w-4" /> Tambah Akun
            </Button>
            <Button variant="outline" onClick={kunci} title={`Terkunci otomatis setelah ${MENIT_KUNCI_OTOMATIS} menit tanpa aktivitas`} data-testid="simpan-akun-kunci">
              <LockKeyhole className="mr-2 h-4 w-4" /> Kunci
            </Button>
          </div>
        )}
      </div>

      {!terbuka ? (
        <GerbangPin onTerbuka={() => setTerbuka(true)} />
      ) : loading ? (
        <div className="p-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-[#006837]" />
          <p className="text-slate-500">Memuat akun...</p>
        </div>
      ) : daftar.length === 0 ? (
        <KosongAkun
          jenis="belum-ada"
          aksi={(
            <Button onClick={() => setFormAkun({})} className="bg-[#006837] hover:bg-[#005830]">
              <Plus className="mr-2 h-4 w-4" /> Simpan akun pertama
            </Button>
          )}
        />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={cari}
                onChange={(e) => setCari(e.target.value)}
                placeholder="Cari nama akun atau aplikasi..."
                className="pl-10 pr-9"
                aria-label="Cari akun"
                data-testid="simpan-akun-cari"
              />
              {cari && (
                <button type="button" onClick={() => setCari('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600" aria-label="Hapus pencarian">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Select value={aplikasi || 'semua'} onValueChange={(v) => setAplikasi(v === 'semua' ? '' : v)}>
              <SelectTrigger className="w-full sm:w-56" data-testid="simpan-akun-filter-aplikasi"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="semua">Semua aplikasi</SelectItem>
                {daftarAplikasi.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-sm text-slate-500" aria-live="polite">
              {tersaring.length === daftar.length ? `${daftar.length} akun` : `${tersaring.length} dari ${daftar.length} akun`}
            </p>
          </div>

          {tersaring.length === 0 ? (
            <KosongAkun jenis="tidak-ditemukan" kataKunci={cari || aplikasi} onAturUlang={aturUlang} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="simpan-akun-daftar">
              {tersaring.map((a) => <KartuAkun key={a.id} akun={a} onPilih={(x) => setDipilihId(x.id)} />)}
            </div>
          )}
        </div>
      )}

      <DetailAkunDialog
        akunId={dipilihId}
        onClose={() => setDipilihId(null)}
        onUbah={(akun) => {
          setDipilihId(null);
          setFormAkun(akun);
        }}
        onTerhapus={() => {
          setDipilihId(null);
          setVersi((v) => v + 1);
        }}
      />
      <FormAkunDialog akun={formAkun} daftar={daftar} onClose={() => setFormAkun(null)} onTersimpan={() => setVersi((v) => v + 1)} />
    </div>
  );
}
