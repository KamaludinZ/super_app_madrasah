import React from 'react';
import { Button } from '@/components/ui/button';
import { ClipboardX, RefreshCw } from 'lucide-react';

/** Daftar rekap hadir/tidak hadir per jenjang (terisi otomatis dari daftar hadir sesi). */
export function DaftarRekapBa({ rekap = [] }) {
  return (
    <ul className="space-y-2" data-testid="ba-rekap">
      {rekap.map((r) => (
        <li key={r.jenjang} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
          <div className="font-semibold text-slate-900">Kelas {r.jenjang}{r.mapel ? ` · ${r.mapel}` : ''}</div>
          <div className="text-slate-600">{r.total} peserta · <span className="text-emerald-700">{r.hadir} hadir</span> · {r.izin + r.sakit + r.alpa} tidak hadir
            {r.izin + r.sakit + r.alpa > 0 && <span className="text-xs"> (izin {r.izin}, sakit {r.sakit}, tanpa keterangan {r.alpa})</span>}</div>
          {r.nomor_tidak_hadir?.length > 0 && <div className="mt-1 text-xs text-slate-500">Tidak hadir: {r.nomor_tidak_hadir.join(', ')}</div>}
          {r.belum > 0 && <div className="mt-1 text-xs font-medium text-amber-700">{r.belum} peserta belum mengisi daftar hadir</div>}
        </li>
      ))}
    </ul>
  );
}

/**
 * Blokir syarat: berita acara baru dapat diisi setelah daftar hadir ruang itu pada sesi ini dinyatakan lengkap oleh
 * sistem (semua peserta hadir atau ditandai izin/sakit/tanpa keterangan). Menampilkan sisa peserta yang belum per
 * jenjang dan tombol periksa lagi; langkah pengisian berita acara tidak ditampilkan selama syarat belum terpenuhi.
 */
export default function BlokirSyaratDaftarHadir({ ruang, kelengkapan, rekap, onPeriksaLagi, memuat }) {
  return (
    <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-sm sm:p-5" role="alert" data-testid="ba-blokir-syarat">
      <div className="mb-3 flex gap-3">
        <ClipboardX className="mt-0.5 h-6 w-6 shrink-0 text-amber-600" />
        <div className="min-w-0 text-sm text-amber-900">
          <h2 className="text-base font-bold">Daftar hadir Ruang {ruang?.nama_ruang} belum lengkap</h2>
          <p className="mt-0.5">{kelengkapan?.pesan || 'Masih ada peserta yang belum mengisi daftar hadir.'}</p>
          <p className="mt-1 text-xs text-amber-800">
            Berita acara baru dapat diisi setelah semua peserta mengisi daftar hadir, atau panitia menandai yang tidak hadir
            sebagai izin/sakit/tanpa keterangan.
          </p>
        </div>
      </div>
      <DaftarRekapBa rekap={rekap} />
      {onPeriksaLagi && (
        <Button type="button" variant="outline" onClick={onPeriksaLagi} disabled={memuat} className="mt-3 w-full gap-2 border-amber-400 bg-white" data-testid="ba-periksa-lagi">
          <RefreshCw className={`h-4 w-4 ${memuat ? 'animate-spin' : ''}`} /> Periksa lagi
        </Button>
      )}
    </section>
  );
}
