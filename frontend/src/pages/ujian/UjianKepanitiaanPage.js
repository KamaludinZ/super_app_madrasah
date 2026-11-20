import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, Plus, RefreshCw, UsersRound, AlertTriangle, CalendarRange } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import AksesDitolak from '@/components/security/AksesDitolak';
import KartuSusunanPanitia from '@/components/ujian/KartuSusunanPanitia';
import FormUjianDialog from '@/components/ujian/FormUjianDialog';
import SusunPanitiaDialog from '@/components/ujian/SusunPanitiaDialog';
import { useAuth } from '@/lib/AuthContext';
import { PERAN_PENGELOLA_UJIAN } from '@/lib/menuUjian';
import { HALAMAN_BERANDA_UJIAN, aksesDitolak, muatKepanitiaan, pesanGalat } from '@/lib/ujian';

const SARINGAN = [{ key: 'semua', label: 'Semua' }, { key: 'UTS', label: 'UTS' }, { key: 'UAS', label: 'UAS' }];

/**
 * Kepanitiaan (/ujian/panitia): pengelola ujian (admin) membuat ujian UTS/UAS semester aktif dan
 * menyusun panitianya — penanggung jawab, ketua, sekretaris, bendahara — secara terpisah per ujian.
 */
export default function UjianKepanitiaanPage() {
  const { activeRole } = useAuth();
  const boleh = PERAN_PENGELOLA_UJIAN.includes(activeRole);
  const [data, setData] = useState(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState('');
  const [ditolak, setDitolak] = useState('');
  const [jenis, setJenis] = useState('semua');
  const [tambah, setTambah] = useState(false);
  const [susun, setSusun] = useState(null);
  const [sorot, setSorot] = useState(null);

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      setData(await muatKepanitiaan());
      setGalat('');
    } catch (e) {
      if (aksesDitolak(e)) setDitolak(pesanGalat(e, 'Akses ditolak.'));
      else setGalat(pesanGalat(e, 'Gagal memuat kepanitiaan. Periksa koneksi lalu coba lagi.'));
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => { if (boleh) muat(); }, [boleh, muat]);

  if (!boleh || ditolak) {
    return <AksesDitolak halaman="Kepanitiaan Ujian" untuk="admin" pesan={ditolak || undefined} peranBerhak={PERAN_PENGELOLA_UJIAN} />;
  }

  const items = data?.items || [];
  const tampil = jenis === 'semua' ? items : items.filter((i) => i.ujian.jenis === jenis);
  const konteks = data?.konteks;

  return (
    <div className="space-y-6" data-testid="ujian-kepanitiaan">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link to={HALAMAN_BERANDA_UJIAN} className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-[#006837] hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> Beranda Ujian
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2">
            <UsersRound className="h-7 w-7 text-[#006837]" /> Kepanitiaan Ujian
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Susun panitia untuk tiap ujian UTS dan UAS. Panitia yang ditetapkan otomatis mendapat menu kepanitiaan sesuai jabatannya.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {konteks?.tahun_pelajaran && (
            <Badge variant="outline" className="gap-1"><CalendarRange className="h-3 w-3" /> Semester {konteks.semester_nama} · TP {konteks.tahun_pelajaran}</Badge>
          )}
          <Button variant="outline" onClick={muat} disabled={memuat} className="gap-2" data-testid="btn-muat-ulang-panitia">
            {memuat ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Muat Ulang
          </Button>
          <Button onClick={() => setTambah(true)} disabled={!konteks?.semester_id} className="gap-2 bg-[#006837] hover:bg-[#00552d]" data-testid="btn-tambah-ujian">
            <Plus className="h-4 w-4" /> Tambah Ujian
          </Button>
        </div>
      </div>

      {data?.tiruan && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" data-testid="info-tiruan-panitia">
          Server belum menyediakan data kepanitiaan — menampilkan data contoh untuk mencoba tampilan. Perubahan tidak tersimpan.
        </p>
      )}
      {galat && (
        <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800" role="alert">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {galat}
        </div>
      )}

      {items.length > 0 && (
        <div role="group" aria-label="Saring jenis ujian" className="flex flex-wrap gap-1.5">
          {SARINGAN.map((s) => (
            <button key={s.key} type="button" onClick={() => setJenis(s.key)} aria-pressed={jenis === s.key}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006837] ${
                jenis === s.key ? 'border-[#006837] bg-[#006837] text-white' : 'border-slate-200 text-slate-600 hover:bg-emerald-50'}`}
              data-testid={`saring-panitia-${s.key}`}>
              {s.label}
            </button>
          ))}
        </div>
      )}

      {!data && memuat ? (
        <div className="p-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#006837]" /></div>
      ) : tampil.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              illustration="quran"
              size="sm"
              title={items.length ? `Belum ada ujian ${jenis}` : 'Belum ada ujian semester ini'}
              description="Tambahkan ujian UTS atau UAS terlebih dahulu, lalu susun panitianya dari akun GTK."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {['UTS', 'UAS'].filter((j) => jenis === 'semua' || jenis === j).map((j) => {
            const kelompok = tampil.filter((i) => i.ujian.jenis === j);
            if (!kelompok.length) return null;
            return (
              <section key={j} aria-labelledby={`judul-panitia-${j}`} className="space-y-3" data-testid={`kelompok-panitia-${j}`}>
                <h2 id={`judul-panitia-${j}`} className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Panitia {j} <span className="font-normal normal-case">({kelompok.length} ujian)</span>
                </h2>
                {kelompok.map((i) => (
                  <KartuSusunanPanitia key={i.ujian.id} ujian={i.ujian} panitia={i.panitia} diubah={i.diubah} sorot={sorot === i.ujian.id}
                    onUbah={(ujian, panitia, diubah) => setSusun({ ujian, panitia, diubah })} />
                ))}
              </section>
            );
          })}
        </div>
      )}

      <SusunPanitiaDialog sasaran={susun} onTutup={() => setSusun(null)}
        onTersimpan={() => { setSorot(susun?.ujian?.id || null); setSusun(null); muat(); }} />
      <FormUjianDialog buka={tambah} konteks={konteks} onTutup={() => setTambah(false)} onTersimpan={() => { setTambah(false); muat(); }} />
    </div>
  );
}
