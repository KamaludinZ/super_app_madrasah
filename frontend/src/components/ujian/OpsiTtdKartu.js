import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Loader2, PenLine, PenOff, Trash2, Upload, UserRound } from 'lucide-react';
import { formatWIBPanjang } from '@/lib/datetime';
import { pesanGalat } from '@/lib/ujian';
import { OPSI_TTD, TTD_MAKS_BYTE, ambilTtdKartu, hapusTtdKartu, unggahTtdKartu } from '@/lib/ujianKartu';

const IKON = { ketua: PenLine, kepala: UserRound, tanpa: PenOff };

/** Pratinjau gambar tanda tangan PNG (diambil dengan token, ditampilkan di atas latar kotak-kotak). */
function PratinjauTtd({ ujianId, penanda, versi }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let hidup = true;
    let dibuat = null;
    setUrl(null);
    ambilTtdKartu(ujianId, penanda).then((b) => {
      if (hidup && b) { dibuat = URL.createObjectURL(b); setUrl(dibuat); }
    }).catch(() => {});
    return () => { hidup = false; if (dibuat) URL.revokeObjectURL(dibuat); };
  }, [ujianId, penanda, versi]);
  return (
    <div className="flex h-16 w-40 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-[length:12px_12px] bg-[linear-gradient(45deg,#f1f5f9_25%,transparent_25%,transparent_75%,#f1f5f9_75%),linear-gradient(45deg,#f1f5f9_25%,transparent_25%,transparent_75%,#f1f5f9_75%)] bg-[position:0_0,6px_6px] bg-white p-1"
      data-testid={`pratinjau-ttd-${penanda}`}>
      {url ? <img src={url} alt={`Tanda tangan ${OPSI_TTD[penanda].label}`} className="max-h-full max-w-full object-contain" />
        : <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
    </div>
  );
}

/**
 * Pengaturan tanda tangan kartu: pilih penanda tangan (Ketua Panitia / Kepala Madrasah / Tanpa TTD) dan, bila berhak,
 * unggah/ganti/hapus berkas tanda tangan PNG penanda itu. Tanpa berkas, ruang tanda tangan dibiarkan kosong (TTD basah).
 * `penanda` = pilihan.penanda dari GET /kartu/pilihan; `onBerubah(penanda, ttd)` memperbarui status berkas di induk.
 */
export default function OpsiTtdKartu({ ujianId, nilai, onUbah, penanda = {}, bolehUbah, tiruan, onBerubah }) {
  const masukan = useRef(null);
  const [proses, setProses] = useState(null);
  const [versi, setVersi] = useState(0);
  const orang = nilai !== 'tanpa' ? penanda[nilai] : null;

  const unggah = async (berkas) => {
    if (!berkas) return;
    if (berkas.type !== 'image/png' && !/\.png$/i.test(berkas.name)) { toast.error('Berkas tanda tangan harus berformat PNG.'); return; }
    if (berkas.size > TTD_MAKS_BYTE) { toast.error('Berkas tanda tangan maksimal 2 MB.'); return; }
    setProses('unggah');
    try {
      const h = await unggahTtdKartu(ujianId, nilai, berkas);
      onBerubah(nilai, h.ttd);
      setVersi((v) => v + 1);
      toast.success(`Tanda tangan ${OPSI_TTD[nilai].label} tersimpan — latar putih otomatis dibuat transparan.`);
    } catch (e) {
      toast.error(pesanGalat(e, 'Gagal mengunggah tanda tangan.'));
    } finally {
      setProses(null);
      if (masukan.current) masukan.current.value = '';
    }
  };

  const hapus = async () => {
    setProses('hapus');
    try {
      await hapusTtdKartu(ujianId, nilai);
      onBerubah(nilai, null);
      toast.success(`Tanda tangan ${OPSI_TTD[nilai].label} dihapus — kartu dicetak dengan ruang tanda tangan kosong.`);
    } catch (e) {
      toast.error(pesanGalat(e, 'Gagal menghapus tanda tangan.'));
    } finally {
      setProses(null);
    }
  };

  return (
    <div className="space-y-2" data-testid="opsi-ttd-kartu">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tanda tangan kartu</p>
      <div className="grid w-full grid-cols-3 gap-1 rounded-lg border border-slate-200 bg-white p-1 sm:inline-flex sm:w-auto sm:gap-0" role="radiogroup" aria-label="Tanda tangan kartu">
        {Object.entries(OPSI_TTD).map(([k, o]) => {
          const Ikon = IKON[k];
          const aktif = nilai === k;
          return (
            <button key={k} type="button" role="radio" aria-checked={aktif} onClick={() => onUbah(k)} data-testid={`opsi-ttd-${k}`}
              className={`flex min-w-0 items-center justify-center gap-1.5 rounded-md px-1.5 py-1.5 text-xs font-medium leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006837] sm:px-2.5 sm:text-sm ${
                aktif ? 'bg-[#006837] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
              <Ikon className="hidden h-4 w-4 shrink-0 sm:block" /> <span className="min-w-0 text-center">{o.label}</span>
            </button>
          );
        })}
      </div>

      {nilai === 'tanpa' ? (
        <p className="text-xs text-slate-500">Kartu dicetak tanpa blok tanda tangan.</p>
      ) : !orang ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" data-testid="info-penanda-kosong">
          {nilai === 'ketua'
            ? 'Ketua Panitia ujian ini belum ditetapkan — nama penanda tangan dicetak titik-titik. Tetapkan di menu Kepanitiaan.'
            : 'Nama Kepala Madrasah belum diisi — isi di Pengaturan Sekolah atau tetapkan akun Kepala Madrasah. Nama dicetak titik-titik.'}
        </p>
      ) : (
        <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3 sm:flex-row sm:items-center" data-testid={`info-penanda-${nilai}`}>
          {orang.ttd && !tiruan ? <PratinjauTtd ujianId={ujianId} penanda={nilai} versi={versi} /> : (
            <div className="flex h-16 w-40 shrink-0 items-center justify-center rounded-md border border-dashed border-slate-300 bg-white px-2 text-center text-[11px] text-slate-400">
              Belum ada berkas TTD
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-0.5 text-xs">
            <p className="text-slate-500">{orang.jabatan}</p>
            <p className="font-semibold text-slate-900">{orang.nama}</p>
            <p className="text-slate-500">NIP {orang.nip || '-'}</p>
            <p className="text-slate-500">
              {orang.ttd
                ? `Tanda tangan PNG diunggah ${orang.ttd.diunggah_oleh_nama ? `oleh ${orang.ttd.diunggah_oleh_nama} ` : ''}${orang.ttd.diunggah_pada ? `· ${formatWIBPanjang(orang.ttd.diunggah_pada)}` : ''} — ikut tercetak di kartu.`
                : 'Tanpa berkas TTD, ruang tanda tangan dibiarkan kosong untuk ditandatangani basah.'}
            </p>
          </div>
          {bolehUbah && (
            <div className="flex shrink-0 gap-2">
              <input ref={masukan} type="file" accept="image/png,.png" className="hidden" onChange={(e) => unggah(e.target.files?.[0])} data-testid="input-ttd-kartu" />
              <Button type="button" variant="outline" size="sm" onClick={() => masukan.current?.click()} disabled={!!proses || tiruan} className="gap-1" data-testid="btn-unggah-ttd">
                {proses === 'unggah' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {orang.ttd ? 'Ganti TTD' : 'Unggah TTD (PNG)'}
              </Button>
              {orang.ttd && (
                <Button type="button" variant="outline" size="sm" onClick={hapus} disabled={!!proses || tiruan} className="gap-1 text-rose-700 hover:text-rose-800" data-testid="btn-hapus-ttd">
                  {proses === 'hapus' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Hapus
                </Button>
              )}
            </div>
          )}
        </div>
      )}
      {nilai !== 'tanpa' && bolehUbah && (
        <p className="text-[11px] text-slate-500">Berkas PNG maks. 2 MB, sebaiknya tinta gelap di atas latar putih atau transparan. Latar putih otomatis dibuat transparan dan tepi kosong dipangkas.</p>
      )}
    </div>
  );
}
