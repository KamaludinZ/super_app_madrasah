import React, { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Info, Link2, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AksesDitolak from '@/components/security/AksesDitolak';
import PilihUjian from '@/components/ujian/PilihUjian';
import KartuTautanPublik from '@/components/ujian/tautan/KartuTautanPublik';
import PanelJejakAuditTautan from '@/components/ujian/tautan/PanelJejakAuditTautan';
import { HALAMAN_BERANDA_UJIAN, aksesDitolak, pesanGalat } from '@/lib/ujian';
import { JENIS_TAUTAN_PUBLIK, muatTautanPublik } from '@/lib/ujianTautanPublik';

/**
 * Pengelolaan Tautan Publik (/ujian/tautan-publik?ujian=<id>): dua tautan ber-token acak per ujian — Info Ujian untuk
 * siswa dan Monitoring Pengumpulan untuk panitia/guru. Admin membuka/menutup tautan, mengatur jendela waktu akses, dan
 * mengganti token; kepala madrasah, waka kurikulum, serta ketua & sekretaris panitia melihat.
 */
export default function UjianTautanPublikPage() {
  const [ujian, setUjian] = useState(null);
  const [data, setData] = useState(null);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState('');
  const [ditolak, setDitolak] = useState('');
  const [segarkanAudit, setSegarkanAudit] = useState(0);

  const muat = useCallback(async (u) => {
    if (!u) { setData(null); return; }
    setMemuat(true);
    try {
      setData(await muatTautanPublik(u.id));
      setGalat('');
      setDitolak('');
    } catch (e) {
      setData(null);
      if (aksesDitolak(e)) setDitolak(pesanGalat(e, 'Akses ditolak.'));
      else setGalat(pesanGalat(e, 'Gagal memuat tautan publik.'));
    } finally {
      setMemuat(false);
    }
  }, []);

  const gantiUjian = useCallback((u) => { setUjian(u); muat(u); }, [muat]);
  const perbarui = (t, tiruan) => {
    setData((d) => ({ ...d, tiruan: d.tiruan || tiruan, tautan: { ...d.tautan, [t.jenis]: t } }));
    setSegarkanAudit((n) => n + 1); // perubahan pengaturan ikut tampil di jejak audit
  };

  return (
    <div className="space-y-6" data-testid="ujian-tautan-publik">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link to={HALAMAN_BERANDA_UJIAN} className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-[#006837] hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> Beranda Ujian
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 sm:text-3xl">
            <Link2 className="h-7 w-7 text-[#006837]" /> Tautan Publik
          </h1>
          <p className="mt-1 text-sm text-slate-600">Halaman info ujian untuk siswa dan monitoring pengumpulan soal — dibuka tanpa login, cukup dengan tautan.</p>
        </div>
        <Button variant="outline" onClick={() => muat(ujian)} disabled={memuat || !ujian} className="gap-2 self-start sm:self-auto" data-testid="btn-muat-ulang-tautan">
          {memuat ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Muat Ulang
        </Button>
      </div>

      <PilihUjian onUbah={gantiUjian} />

      {ditolak && <AksesDitolak halaman="Tautan Publik" untuk="admin, pimpinan, serta ketua dan sekretaris panitia ujian ini" pesan={ditolak} />}
      {data?.tiruan && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" data-testid="info-tiruan-tautan">
          Server belum menyediakan pengelolaan tautan — menampilkan data contoh untuk mencoba tampilan. Perubahan tidak tersimpan.
        </p>
      )}
      {galat && (
        <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800" role="alert">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {galat}
        </div>
      )}
      {!data && memuat && <div className="p-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-[#006837]" /></div>}

      {!ditolak && data && (
        <>
          {!data.boleh_ubah && (
            <p className="flex items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800" data-testid="tautan-hanya-lihat">
              <Info className="h-4 w-4 shrink-0" /> Anda melihat sebagai pemantau. Tautan publik hanya dapat diubah admin.
            </p>
          )}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {JENIS_TAUTAN_PUBLIK.map((meta) => data.tautan?.[meta.jenis] && (
              <KartuTautanPublik key={`${ujian?.id}-${meta.jenis}`} ujianId={ujian?.id} namaUjian={ujian?.nama} masaUjian={ujian} meta={meta} tautan={data.tautan[meta.jenis]}
                bolehUbah={!!data.boleh_ubah} onTersimpan={perbarui} />
            ))}
          </div>
          <PanelJejakAuditTautan ujianId={ujian?.id} segarkan={segarkanAudit} />
        </>
      )}
    </div>
  );
}
