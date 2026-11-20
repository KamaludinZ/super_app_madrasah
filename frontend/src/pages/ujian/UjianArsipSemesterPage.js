import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Archive, ArrowLeft, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import AksesDitolak from '@/components/security/AksesDitolak';
import DaftarUjian from '@/components/ujian/DaftarUjian';
import { HALAMAN_BERANDA_UJIAN, aksesDitolak, muatArsipSemester, pesanGalat } from '@/lib/ujian';

/**
 * Arsip Semester Lalu (/ujian/arsip-semester): ujian UTS/UAS semester-semester sebelumnya, dikelompokkan per
 * semester (terbaru dulu) dan dapat disaring per tahun pelajaran. Beranda hanya memuat semester aktif; data lama
 * tetap tersimpan di sini untuk pengguna berhak (admin, waka kurikulum, kepala madrasah, ketua & sekretaris panitia).
 */
export default function UjianArsipSemesterPage() {
  const [data, setData] = useState(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState('');
  const [ditolak, setDitolak] = useState('');
  const [tp, setTp] = useState('semua');

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      setData(await muatArsipSemester());
      setGalat('');
    } catch (e) {
      if (aksesDitolak(e)) setDitolak(pesanGalat(e, 'Akses ditolak.'));
      else setGalat(pesanGalat(e, 'Gagal memuat arsip ujian. Periksa koneksi lalu coba lagi.'));
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => { muat(); }, [muat]);

  const semester = useMemo(() => data?.semester || [], [data]);
  const daftarTp = useMemo(() => [...new Set(semester.map((s) => s.tahun_pelajaran))], [semester]);
  const tampil = tp === 'semua' ? semester : semester.filter((s) => s.tahun_pelajaran === tp);

  if (ditolak) {
    return <AksesDitolak halaman="Arsip Semester Lalu" untuk="admin, waka kurikulum, kepala madrasah, serta ketua dan sekretaris panitia" pesan={ditolak} />;
  }

  return (
    <div className="space-y-6" data-testid="ujian-arsip-semester">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link to={HALAMAN_BERANDA_UJIAN} className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-[#006837] hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> Beranda Ujian
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2">
            <Archive className="h-7 w-7 text-[#006837]" /> Arsip Semester Lalu
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Ujian dari semester sebelumnya. Datanya tetap tersimpan meskipun beranda dimulai kosong di semester baru.
          </p>
        </div>
        <Button variant="outline" onClick={muat} disabled={memuat} className="gap-2 self-start sm:self-auto" data-testid="btn-muat-ulang-arsip-semester">
          {memuat ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Muat Ulang
        </Button>
      </div>

      {data?.tiruan && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" data-testid="info-tiruan-arsip-semester">
          Server belum menyediakan arsip ujian — menampilkan data contoh untuk mencoba tampilan.
        </p>
      )}
      {galat && (
        <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800" role="alert">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {galat}
        </div>
      )}

      {daftarTp.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label htmlFor="saring-tp-arsip" className="text-slate-600">Tahun pelajaran</label>
          <select
            id="saring-tp-arsip"
            value={tp}
            onChange={(e) => setTp(e.target.value)}
            className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006837]"
            data-testid="saring-tp-arsip"
          >
            <option value="semua">Semua</option>
            {daftarTp.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      )}

      {!data && memuat ? (
        <div className="p-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#006837]" /></div>
      ) : tampil.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              illustration="lantern"
              size="sm"
              title="Belum ada arsip ujian"
              description="Ujian semester sebelumnya yang dapat Anda buka akan tampil di sini."
            />
          </CardContent>
        </Card>
      ) : (
        tampil.map((s) => (
          <Card key={s.semester_id} data-testid={`arsip-semester-${s.semester_id}`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex flex-wrap items-center gap-2">
                Semester {s.semester_nama} · TP {s.tahun_pelajaran}
                <Badge variant="outline" className="font-normal">{s.items.length} ujian</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DaftarUjian items={s.items} saring={false} />
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
