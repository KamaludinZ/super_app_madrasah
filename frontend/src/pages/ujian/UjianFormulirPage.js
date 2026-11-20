import React, { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle, ArrowLeft, CalendarClock, Copy, FileText, History, Info, Link2, Loader2, PenLine, RefreshCw, SlidersHorizontal,
} from 'lucide-react';
import AksesDitolak from '@/components/security/AksesDitolak';
import PilihUjian from '@/components/ujian/PilihUjian';
import BadgeStatusFormulir from '@/components/ujian/BadgeStatusFormulir';
import PanelAktivasiFormulir from '@/components/ujian/PanelAktivasiFormulir';
import StatusFormulirUjian from '@/components/ujian/StatusFormulirUjian';
import EditorTemplateCetak from '@/components/ujian/EditorTemplateCetak';
import PolaTandaTangan from '@/components/ujian/PolaTandaTangan';
import JadwalSesiEditor from '@/components/ujian/JadwalSesiEditor';
import { formatWIBPanjang } from '@/lib/datetime';
import { HALAMAN_BERANDA_UJIAN, aksesDitolak, pesanGalat } from '@/lib/ujian';
import { muatFormulir, tautanLengkap } from '@/lib/ujianFormulir';
import { toast } from 'sonner';

// Stempel perubahan satu bagian: "Diubah 18 November 2026, 10:00 oleh Administrator".
function Stempel({ diubah, testid }) {
  return (
    <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-slate-400" data-testid={testid}>
      <History className="h-3 w-3" />
      {diubah?.pada ? `Diubah ${formatWIBPanjang(diubah.pada)}${diubah.oleh_nama ? ` oleh ${diubah.oleh_nama}` : ''}` : 'Belum pernah diubah (bawaan)'}
    </p>
  );
}

function Bagian({ ikon: Ikon, judul, keterangan, children, testid, aksi, diubah }) {
  return (
    <Card data-testid={testid}>
      <CardHeader className="flex flex-col gap-2 pb-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base"><Ikon className="h-4 w-4 text-[#006837]" /> {judul}</CardTitle>
          {keterangan && <p className="mt-1 text-xs text-slate-500">{keterangan}</p>}
          {diubah !== undefined && <div><Stempel diubah={diubah} testid={testid && `${testid}-diubah`} /></div>}
        </div>
        {aksi}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/**
 * Pengaturan Formulir (/ujian/formulir?ujian=<id>): admin menyalakan/mematikan formulir daftar hadir & berita acara
 * beserta jam buka–tutup untuk SEMUA ruang sekaligus, menyusun jadwal sesi (tanggal, jam, mapel per jenjang), serta
 * menyiapkan template cetak dan pola tanda tangan. Ketua & sekretaris panitia melihat.
 */
export default function UjianFormulirPage() {
  const [ujian, setUjian] = useState(null);
  const [data, setData] = useState(null);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState('');
  const [ditolak, setDitolak] = useState('');
  const [segarkan, setSegarkan] = useState(0);

  const muat = useCallback(async (u) => {
    if (!u) { setData(null); return; }
    setMemuat(true);
    try {
      setData(await muatFormulir(u.id));
      setGalat('');
      setDitolak('');
    } catch (e) {
      if (aksesDitolak(e)) setDitolak(pesanGalat(e, 'Akses ditolak.'));
      else setGalat(pesanGalat(e, 'Gagal memuat pengaturan formulir.'));
    } finally {
      setMemuat(false);
    }
  }, []);

  const gantiUjian = useCallback((u) => { setUjian(u); muat(u); }, [muat]);
  const f = data?.formulir;

  return (
    <div className="space-y-6" data-testid="ujian-formulir">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link to={HALAMAN_BERANDA_UJIAN} className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-[#006837] hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> Beranda Ujian
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2">
            <SlidersHorizontal className="h-7 w-7 text-[#006837]" /> Pengaturan Formulir
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Kapan formulir daftar hadir dan berita acara dibuka, jadwal sesi, serta format cetaknya — berlaku untuk semua ruang.
          </p>
        </div>
        <Button variant="outline" onClick={() => muat(ujian)} disabled={memuat || !ujian} className="gap-2 self-start sm:self-auto" data-testid="btn-muat-ulang-formulir">
          {memuat ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Muat Ulang
        </Button>
      </div>

      <PilihUjian onUbah={gantiUjian} />
      <StatusFormulirUjian segarkan={segarkan} />

      {ditolak && <AksesDitolak halaman="Pengaturan Formulir" untuk="admin serta ketua dan sekretaris panitia ujian ini" pesan={ditolak} />}
      {data?.tiruan && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" data-testid="info-tiruan-formulir">
          Server belum menyediakan pengaturan formulir — menampilkan data contoh untuk mencoba tampilan. Perubahan tidak tersimpan.
        </p>
      )}
      {galat && (
        <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800" role="alert">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {galat}
        </div>
      )}
      {!data && memuat && <div className="p-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#006837]" /></div>}

      {!ditolak && f && (
        <>
          {!data.boleh_ubah && (
            <p className="flex items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
              <Info className="h-4 w-4 shrink-0" /> Anda melihat sebagai panitia. Pengaturan formulir hanya dapat diubah admin.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            Status saat ini: <BadgeStatusFormulir formulir={f} ringkas />
            {f.diubah_pada && <span>· diperbarui {formatWIBPanjang(f.diubah_pada)}{f.diubah_oleh_nama ? ` oleh ${f.diubah_oleh_nama}` : ''}</span>}
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Bagian ikon={CalendarClock} judul="Aktivasi & Jendela Waktu" testid="bagian-aktivasi" diubah={f.diubah?.aktivasi || null}
              keterangan="Satu pengaturan untuk seluruh ruang pada ujian ini.">
              <PanelAktivasiFormulir ujian={ujian} formulir={f} bolehUbah={data.boleh_ubah}
                onTersimpan={(formulir) => { setData((d) => ({ ...d, formulir: { ...d.formulir, ...formulir } })); setSegarkan((n) => n + 1); }} />
            </Bagian>
            <Bagian ikon={Link2} judul="Tautan Publik" testid="bagian-tautan" keterangan="Dibagikan ke peserta dan pengawas; dibuka tanpa login.">
              <ul className="space-y-2 text-xs">
                {[['daftar_hadir', 'Daftar hadir peserta'], ['berita_acara', 'Berita acara pengawas']].map(([k, label]) => (
                  <li key={k} className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-slate-500">{label}</div>
                      <div className="truncate font-mono" title={tautanLengkap(f.tautan?.[k])}>{tautanLengkap(f.tautan?.[k])}</div>
                    </div>
                    <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 gap-1" data-testid={`btn-salin-${k}`}
                      onClick={() => navigator.clipboard?.writeText(tautanLengkap(f.tautan?.[k])).then(() => toast.success('Tautan disalin'), () => toast.error('Gagal menyalin tautan'))}>
                      <Copy className="h-3.5 w-3.5" /> Salin
                    </Button>
                  </li>
                ))}
              </ul>
            </Bagian>
            <Bagian ikon={FileText} judul="Template Cetak" testid="bagian-template" diubah={f.diubah?.template || null} keterangan="Kop dan judul lembar daftar hadir & berita acara.">
              <EditorTemplateCetak ujian={ujian} template={f.template} bolehUbah={data.boleh_ubah}
                onTersimpan={(formulir) => setData((d) => ({ ...d, formulir: { ...d.formulir, ...formulir } }))} />
            </Bagian>
            <Bagian ikon={PenLine} judul="Pola Tanda Tangan" testid="bagian-ttd" diubah={f.diubah?.pola_ttd || null} keterangan="Tanda tangan PNG digambar di layar seperti pada angket.">
              <PolaTandaTangan ujian={ujian} pola={f.pola_ttd} bolehUbah={data.boleh_ubah}
                onTersimpan={(formulir) => setData((d) => ({ ...d, formulir: { ...d.formulir, ...formulir } }))} />
            </Bagian>
          </div>
          <Bagian ikon={CalendarClock} judul="Jadwal Sesi" testid="bagian-jadwal" diubah={f.diubah?.jadwal || null} keterangan="Mengisi hari/tanggal, pukul, dan mata pelajaran pada daftar hadir & berita acara.">
            <JadwalSesiEditor ujian={ujian} jadwal={data.jadwal} bolehUbah={data.boleh_ubah}
              onTersimpan={(h) => setData((d) => ({ ...d, jadwal: h.jadwal, formulir: { ...d.formulir, ...h.formulir } }))} />
          </Bagian>
        </>
      )}
    </div>
  );
}
