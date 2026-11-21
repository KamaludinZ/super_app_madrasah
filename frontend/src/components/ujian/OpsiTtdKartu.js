import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, PenLine, PenOff, Trash2, Upload, UserRound } from 'lucide-react';
import { formatWIBPanjang } from '@/lib/datetime';
import { pesanGalat } from '@/lib/ujian';
import { BERKAS_TTD, OPSI_TTD, TTD_MAKS_BYTE, ambilTtdKartu, hapusTtdKartu, unggahTtdKartu } from '@/lib/ujianKartu';

const IKON = { ketua: PenLine, kepala: UserRound, tanpa: PenOff };
const LATAR_KOTAK = 'bg-white bg-[length:12px_12px] bg-[position:0_0,6px_6px] bg-[linear-gradient(45deg,#f1f5f9_25%,transparent_25%,transparent_75%,#f1f5f9_75%),linear-gradient(45deg,#f1f5f9_25%,transparent_25%,transparent_75%,#f1f5f9_75%)]';

/** Pratinjau gambar PNG tanda tangan / stempel (diambil dengan token, ditampilkan di atas latar kotak-kotak). */
function PratinjauBerkas({ ujianId, penanda, berkas, versi, ada, tiruan }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    setUrl(null);
    if (!ada || tiruan) return undefined;
    let hidup = true;
    let dibuat = null;
    ambilTtdKartu(ujianId, penanda, berkas).then((b) => {
      if (hidup && b) { dibuat = URL.createObjectURL(b); setUrl(dibuat); }
    }).catch(() => {});
    return () => { hidup = false; if (dibuat) URL.revokeObjectURL(dibuat); };
  }, [ujianId, penanda, berkas, versi, ada, tiruan]);
  const lebar = berkas === 'stempel' ? 'w-16' : 'w-36';
  if (!ada || tiruan) {
    return (
      <div className={`flex h-16 ${lebar} shrink-0 items-center justify-center rounded-md border border-dashed border-slate-300 bg-white px-1 text-center text-[10px] leading-tight text-slate-400`}>
        Belum ada {BERKAS_TTD[berkas].label.toLowerCase()}
      </div>
    );
  }
  return (
    <div className={`flex h-16 ${lebar} shrink-0 items-center justify-center rounded-md border border-slate-200 p-1 ${LATAR_KOTAK}`} data-testid={`pratinjau-${berkas}-${penanda}`}>
      {url ? <img src={url} alt={`${BERKAS_TTD[berkas].label} ${OPSI_TTD[penanda].label}`} className="max-h-full max-w-full object-contain" />
        : <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
    </div>
  );
}

/** Satu slot berkas (tanda tangan atau stempel): pratinjau, info unggahan, tombol Unggah/Ganti & Hapus. */
function SlotBerkas({ ujianId, penanda, berkas, info, bolehUbah, tiruan, onBerubah }) {
  const masukan = useRef(null);
  const [proses, setProses] = useState(null);
  const [versi, setVersi] = useState(0);
  const label = BERKAS_TTD[berkas].label;

  const unggah = async (file) => {
    if (!file) return;
    if (file.type !== 'image/png' && !/\.png$/i.test(file.name)) { toast.error(`Berkas ${label.toLowerCase()} harus berformat PNG.`); return; }
    if (file.size > TTD_MAKS_BYTE) { toast.error(`Berkas ${label.toLowerCase()} maksimal 2 MB.`); return; }
    setProses('unggah');
    try {
      const h = await unggahTtdKartu(ujianId, penanda, file, berkas);
      onBerubah(penanda, berkas, h[berkas]);
      setVersi((v) => v + 1);
      toast.success(`${label} ${OPSI_TTD[penanda].label} tersimpan — latar putih otomatis dibuat transparan.`);
    } catch (e) {
      toast.error(pesanGalat(e, `Gagal mengunggah ${label.toLowerCase()}.`));
    } finally {
      setProses(null);
      if (masukan.current) masukan.current.value = '';
    }
  };

  const hapus = async () => {
    setProses('hapus');
    try {
      await hapusTtdKartu(ujianId, penanda, berkas);
      onBerubah(penanda, berkas, null);
      toast.success(`${label} ${OPSI_TTD[penanda].label} dihapus.`);
    } catch (e) {
      toast.error(pesanGalat(e, `Gagal menghapus ${label.toLowerCase()}.`));
    } finally {
      setProses(null);
    }
  };

  return (
    <div className="flex min-w-0 items-start gap-2" data-testid={`slot-${berkas}`}>
      <PratinjauBerkas ujianId={ujianId} penanda={penanda} berkas={berkas} versi={versi} ada={!!info} tiruan={tiruan} />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-xs font-medium text-slate-700">{label}</p>
        <p className="text-[11px] leading-snug text-slate-500">
          {info
            ? `Diunggah${info.diunggah_oleh_nama ? ` oleh ${info.diunggah_oleh_nama}` : ''}${info.diunggah_pada ? ` · ${formatWIBPanjang(info.diunggah_pada)}` : ''}`
            : berkas === 'ttd' ? 'Belum ada — ruang tanda tangan dicetak kosong (TTD basah).' : 'Belum ada — kartu dicetak tanpa stempel.'}
        </p>
        {bolehUbah && (
          <div className="flex flex-wrap gap-1.5">
            <input ref={masukan} type="file" accept="image/png,.png" className="hidden" onChange={(e) => unggah(e.target.files?.[0])} data-testid={`input-${berkas}-kartu`} />
            <Button type="button" variant="outline" size="sm" onClick={() => masukan.current?.click()} disabled={!!proses || tiruan}
              className="h-8 gap-1 px-2 text-xs" data-testid={`btn-unggah-${berkas}`}>
              {proses === 'unggah' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} {info ? 'Ganti' : 'Unggah PNG'}
            </Button>
            {info && (
              <Button type="button" variant="outline" size="sm" onClick={hapus} disabled={!!proses || tiruan}
                className="h-8 gap-1 px-2 text-xs text-rose-700 hover:text-rose-800" data-testid={`btn-hapus-${berkas}`}>
                {proses === 'hapus' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Hapus
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Pengaturan tanda tangan kartu: pilih penanda tangan (Ketua Panitia / Kepala Madrasah / Tanpa TTD), lalu (bila berhak)
 * unggah/ganti/hapus berkas tanda tangan PNG dan stempel PNG penanda itu, serta pilih cetak dengan/tanpa stempel.
 * `penanda` = pilihan.penanda dari GET /kartu/pilihan; `onBerubah(penanda, berkas, info)` memperbarui status di induk.
 */
export default function OpsiTtdKartu({ ujianId, nilai, onUbah, penanda = {}, bolehUbah, tiruan, onBerubah, stempel, onStempel }) {
  const orang = nilai !== 'tanpa' ? penanda[nilai] : null;

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
        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3" data-testid={`info-penanda-${nilai}`}>
          <div className="text-xs">
            <p className="text-slate-500">{orang.jabatan}</p>
            <p className="font-semibold text-slate-900">{orang.nama}</p>
            <p className="text-slate-500">NIP {orang.nip || '-'}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.keys(BERKAS_TTD).map((b) => (
              <SlotBerkas key={b} ujianId={ujianId} penanda={nilai} berkas={b} info={orang[b]} bolehUbah={bolehUbah} tiruan={tiruan} onBerubah={onBerubah} />
            ))}
          </div>
          {orang.stempel && (
            <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-700" data-testid="opsi-cetak-stempel">
              <Checkbox checked={stempel === 'pakai'} onCheckedChange={(v) => onStempel(v ? 'pakai' : 'tanpa')} aria-label="Cetak stempel" />
              Cetak stempel di kartu (menimpa sisi kiri tanda tangan)
            </label>
          )}
        </div>
      )}
      {nilai !== 'tanpa' && bolehUbah && (
        <p className="text-[11px] text-slate-500">Berkas PNG maks. 2 MB, sebaiknya tinta di atas latar putih atau transparan. Latar putih otomatis dibuat transparan dan tepi kosong dipangkas.</p>
      )}
    </div>
  );
}
