import React from 'react';
import { Button } from '@/components/ui/button';
import { CalendarClock, CalendarX2, Clock, Link2Off, Lock, RefreshCw } from 'lucide-react';
import { formatWIB } from '@/lib/datetime';

const tglPanjang = (iso) => formatWIB(iso, 'Date', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

// Penjelasan tiap alasan formulir tertutup (alasan dari server: cek_waktu_formulir).
const ALASAN = {
  nonaktif: { Ikon: Lock, judul: 'Formulir belum dibuka panitia', saran: 'Tunggu pengumuman panitia, lalu buka kembali tautan ini.' },
  belum_mulai: { Ikon: CalendarClock, judul: 'Masa ujian belum dimulai', saran: 'Tautan ini dapat dipakai mulai hari pertama ujian.' },
  sudah_selesai: { Ikon: CalendarX2, judul: 'Masa ujian sudah berakhir', saran: 'Formulir sudah ditutup. Hubungi panitia bila ada yang perlu diperbaiki.' },
  di_luar_jam: { Ikon: Clock, judul: 'Di luar jam formulir', saran: 'Buka kembali tautan ini pada jam yang ditentukan.' },
  tanpa_sesi: { Ikon: CalendarClock, judul: 'Tidak ada sesi ujian hari ini', saran: 'Daftar hadir hanya dapat diisi pada hari yang ada jadwal ujiannya.' },
};

/**
 * Tampilan formulir publik yang belum/tidak dapat diisi: alasan spesifik (belum dibuka, belum masa ujian, sudah selesai,
 * di luar jam, tanpa sesi) beserta jadwal & jam formulir, dan tombol periksa lagi. `formulir` = { alasan, pesan,
 * jam_buka, jam_tutup }; `ujian` = { mulai, selesai }.
 */
export function FormulirTertutup({ formulir, ujian, tanpaSesi, onMuatUlang, memuat }) {
  const alasan = tanpaSesi && formulir?.terbuka ? 'tanpa_sesi' : formulir?.alasan || 'nonaktif';
  const a = ALASAN[alasan] || ALASAN.nonaktif;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm" data-testid="formulir-tertutup" data-alasan={alasan}>
      <a.Ikon className="mx-auto mb-3 h-10 w-10 text-slate-500" />
      <h2 className="text-lg font-bold text-slate-900">{a.judul}</h2>
      <p className="mt-1 text-sm text-slate-600">{formulir?.pesan && alasan !== 'tanpa_sesi' ? formulir.pesan : a.saran}</p>
      <dl className="mx-auto mt-4 grid max-w-sm grid-cols-2 gap-2 text-left text-xs">
        {ujian?.mulai && (
          <div className="col-span-2 rounded-lg bg-slate-50 p-2">
            <dt className="text-slate-500">Masa ujian</dt>
            <dd className="font-medium text-slate-800">{tglPanjang(ujian.mulai)}{ujian.selesai && ujian.selesai !== ujian.mulai ? ` – ${tglPanjang(ujian.selesai)}` : ''}</dd>
          </div>
        )}
        {formulir?.jam_buka && formulir?.jam_tutup && (
          <div className="col-span-2 rounded-lg bg-slate-50 p-2">
            <dt className="text-slate-500">Jam formulir</dt>
            <dd className="font-medium text-slate-800">{formulir.jam_buka}–{formulir.jam_tutup} WIB</dd>
          </div>
        )}
      </dl>
      {onMuatUlang && alasan !== 'sudah_selesai' && (
        <Button variant="outline" onClick={onMuatUlang} disabled={memuat} className="mt-4 gap-2" data-testid="btn-periksa-lagi">
          <RefreshCw className={`h-4 w-4 ${memuat ? 'animate-spin' : ''}`} /> Periksa lagi
        </Button>
      )}
    </div>
  );
}

/** Tautan publik tidak dikenal / sudah diganti panitia. */
export function TautanTidakValid({ pesan }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm" data-testid="tautan-tidak-valid">
      <Link2Off className="mx-auto mb-3 h-10 w-10 text-amber-600" />
      <h2 className="text-lg font-bold text-slate-900">Tautan tidak valid</h2>
      <p className="mt-1 text-sm text-slate-600">{pesan || 'Tautan ini tidak ditemukan atau sudah diganti panitia.'}</p>
      <p className="mt-2 text-xs text-slate-500">Mintalah tautan terbaru kepada panitia ujian atau pengawas ruang.</p>
    </div>
  );
}
