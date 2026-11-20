import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { ClipboardList, Loader2, RefreshCw, AlertTriangle, CalendarRange, Archive } from 'lucide-react';
import AksesDitolak from '@/components/security/AksesDitolak';
import DaftarUjian from '@/components/ujian/DaftarUjian';
import PintasanMenuPanitia from '@/components/ujian/PintasanMenuPanitia';
import KosongSemesterAktif from '@/components/ujian/KosongSemesterAktif';
import { useAuth } from '@/lib/AuthContext';
import { HALAMAN_ARSIP_SEMESTER, aksesDitolak, muatBerandaUjian, muatStatusFormulir, pesanGalat } from '@/lib/ujian';

function Ringkasan({ items }) {
  const hitung = (s) => items.filter((u) => u.formulir?.status === s).length;
  const kartu = [
    { label: 'Ujian Semester Ini', nilai: items.length, kelas: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
    { label: 'Formulir Dibuka', nilai: hitung('dibuka'), kelas: 'bg-sky-50 border-sky-200 text-sky-700' },
    { label: 'Masih Tertutup', nilai: hitung('tertutup'), kelas: 'bg-slate-50 border-slate-200 text-slate-600' },
    { label: 'Selesai', nilai: hitung('selesai'), kelas: 'bg-amber-50 border-amber-200 text-amber-700' },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="ujian-ringkasan">
      {kartu.map((k) => (
        <div key={k.label} className={`rounded-xl border p-3 ${k.kelas}`}>
          <div className="text-2xl font-bold">{k.nilai}</div>
          <div className="text-xs font-medium">{k.label}</div>
        </div>
      ))}
    </div>
  );
}

/**
 * Beranda Ujian (/ujian): halaman utama panitia ujian madrasah. Menampilkan semua ujian UTS/UAS pada semester
 * aktif beserta status formulir daftar hadir & berita acaranya (GET /ujian/beranda; data contoh bila server
 * belum siap).
 */
export default function UjianBerandaPage() {
  const { activeRole } = useAuth();
  const [data, setData] = useState(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState('');
  const [ditolak, setDitolak] = useState('');

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      setData(await muatBerandaUjian(activeRole));
      setGalat('');
    } catch (e) {
      if (aksesDitolak(e)) setDitolak(pesanGalat(e, 'Akses ditolak.'));
      else setGalat(pesanGalat(e, 'Gagal memuat daftar ujian. Periksa koneksi lalu coba lagi.'));
    } finally {
      setMemuat(false);
    }
  }, [activeRole]);

  useEffect(() => { muat(); }, [muat]);

  // Status formulir dipantau tiap menit (jendela jam buka–tutup berubah sepanjang hari) tanpa memuat ulang semua data.
  const adaData = !!data && !data.tiruan;
  useEffect(() => {
    if (!adaData) return undefined;
    const t = setInterval(async () => {
      try {
        const s = await muatStatusFormulir();
        const peta = Object.fromEntries(s.items.map((i) => [i.ujian_id, i.formulir]));
        setData((d) => (d ? { ...d, items: d.items.map((u) => (peta[u.id] ? { ...u, formulir: peta[u.id] } : u)) } : d));
      } catch { /* abaikan; badge tetap memakai data terakhir */ }
    }, 60000);
    return () => clearInterval(t);
  }, [adaData]);

  if (ditolak) return <AksesDitolak halaman="Beranda Ujian" untuk="admin, pimpinan, dan panitia ujian" pesan={ditolak} />;

  const items = data?.items || [];
  const konteks = data?.konteks;
  // Arsip semester lalu terbuka bagi yang berhak membuka arsip (pengelola, kepala madrasah, ketua, sekretaris).
  const bolehArsip = !!(data?.menu || []).find((m) => m.key === 'arsip')?.akses;

  return (
    <div className="space-y-6" data-testid="ujian-beranda">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <ClipboardList className="h-3 w-3 mr-1" /> Ujian Madrasah
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Beranda Ujian</h1>
          <p className="text-sm text-slate-600 mt-1">
            Semua ujian UTS dan UAS semester ini beserta status formulir daftar hadir dan berita acaranya.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {konteks?.tahun_pelajaran && (
            <Badge variant="outline" className="gap-1" data-testid="ujian-konteks">
              <CalendarRange className="h-3 w-3" /> Semester {konteks.semester_nama} · TP {konteks.tahun_pelajaran}
            </Badge>
          )}
          {bolehArsip && (
            <Button asChild variant="outline" className="gap-2" data-testid="btn-arsip-semester">
              <Link to={HALAMAN_ARSIP_SEMESTER}><Archive className="h-4 w-4" /> Arsip Semester Lalu</Link>
            </Button>
          )}
          <Button variant="outline" onClick={muat} disabled={memuat} className="gap-2" data-testid="btn-muat-ulang-ujian">
            {memuat ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Muat Ulang
          </Button>
        </div>
      </div>

      {data?.tiruan && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" data-testid="info-tiruan-ujian">
          Server belum menyediakan data ujian — menampilkan data contoh untuk mencoba tampilan.
        </p>
      )}
      {galat && (
        <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800" role="alert">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {galat}
        </div>
      )}

      {!data && memuat ? (
        <div className="p-12 text-center" data-testid="ujian-memuat">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-[#006837]" />
        </div>
      ) : (
        <>
          {items.length > 0 && <Ringkasan items={items} />}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Daftar Ujian</CardTitle>
            </CardHeader>
            <CardContent>
              {items.length ? <DaftarUjian items={items} /> : <KosongSemesterAktif konteks={konteks} akses={data?.akses} />}
            </CardContent>
          </Card>
          <PintasanMenuPanitia menu={data?.menu || []} akses={data?.akses} />
        </>
      )}
    </div>
  );
}
