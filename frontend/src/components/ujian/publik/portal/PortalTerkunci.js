import React, { useEffect, useState } from 'react';
import { CalendarClock, CalendarDays, CalendarX2, Lock, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import TautanTidakBerlaku from '@/components/ujian/publik/info/TautanTidakBerlaku';
import { formatWIB } from '@/lib/datetime';
import { labelJenjang, namaMapelUjian } from '@/lib/mapelUjian';
import { msSampai, teksSisaWaktu } from '@/lib/ujianInfoPublik';

const waktuPanjang = (iso) => `${formatWIB(iso, '', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} WIB`;
const tglPanjang = (t) => formatWIB(t, 'Date', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const jam = (iso) => formatWIB(iso, 'Time', { hour: '2-digit', minute: '2-digit' });

// Alasan penolakan portal dari server (jendela tautan portal = masa ujian). `periksa`: dapat berubah, boleh dicek ulang.
const ALASAN = {
  belum_mulai: { Ikon: CalendarClock, judul: 'Portal belum dibuka', saran: 'Portal ujian dibuka saat masa ujian dimulai.', periksa: true },
  nonaktif: { Ikon: Lock, judul: 'Portal sedang ditutup', saran: 'Panitia menutup portal ujian untuk sementara.', periksa: true },
  sudah_selesai: { Ikon: CalendarX2, judul: 'Portal sudah ditutup', saran: 'Masa ujian sudah berakhir.' },
};

// Sisa waktu menuju `iso`, diperbarui tiap 30 detik.
function useSisaWaktu(iso) {
  const [ms, setMs] = useState(() => (iso ? msSampai(iso) : null));
  useEffect(() => {
    if (!iso) return undefined;
    setMs(msSampai(iso));
    const t = setInterval(() => setMs(msSampai(iso)), 30000);
    return () => clearInterval(t);
  }, [iso]);
  return ms;
}

/** Hari ujian berikutnya beserta mapel pertama tiap jenjang (tanpa tautan soal). */
function JadwalBerikutnya({ jadwal }) {
  if (!jadwal?.soal?.length) return null;
  return (
    <div className="mx-auto mt-5 max-w-sm rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-left" data-testid="portal-jadwal-berikutnya">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#006837]">
        <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" /> Jadwal berikutnya
      </p>
      {jadwal.tanggal && <p className="mt-0.5 text-sm font-semibold text-slate-900">{tglPanjang(jadwal.tanggal)}</p>}
      <ul className="mt-2 divide-y divide-emerald-100">
        {jadwal.soal.map((s) => (
          <li key={`${s.jenjang}-${s.mapel}-${s.mulai_at}`} className="flex items-baseline gap-2 py-1.5 text-sm" data-testid={`portal-berikutnya-${s.jenjang}`}>
            <span className="w-16 shrink-0 text-xs font-medium text-slate-500">{labelJenjang(s.jenjang)}</span>
            <span className="min-w-0 flex-1 font-medium text-slate-800">{namaMapelUjian(s.mapel)}</span>
            <span className="shrink-0 text-xs tabular-nums text-slate-600">{jam(s.mulai_at)}{s.selesai_at ? `–${jam(s.selesai_at)}` : ''}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Pengganti seluruh isi portal saat server menolak membukanya (token sah, tetapi ditutup panitia / belum masuk / sudah
 * lewat masa ujian): pesan "portal belum dibuka" atau "portal sudah ditutup", waktu buka + hitung mundur, dan jadwal
 * ujian berikutnya bila server mengirimnya. Token tidak dikenal memakai halaman "tautan tidak berlaku" biasa.
 * `galat` = hasil galatPortal; `catatan` = keterangan kecil di bawah tombol (mis. pemeriksaan otomatis).
 */
export default function PortalTerkunci({ galat, onMuatUlang, memuat, catatan }) {
  const a = ALASAN[galat?.alasan];
  const sisa = teksSisaWaktu(useSisaWaktu(galat?.alasan === 'belum_mulai' ? galat?.mulai_at : null));
  if (!a) return <TautanTidakBerlaku galat={galat} kontak="pengawas ruang atau panitia ujian" />;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm" data-testid="portal-terkunci" data-alasan={galat.alasan}>
      <a.Ikon className="mx-auto mb-3 h-10 w-10 text-slate-500" aria-hidden="true" />
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Portal ujian terkunci</p>
      <h2 className="mt-1 text-lg font-bold text-slate-900">{a.judul}</h2>
      <p className="mt-1 text-sm text-slate-600">{galat.pesan || a.saran}</p>
      {galat.alasan === 'belum_mulai' && galat.mulai_at && (
        <p className="mx-auto mt-4 max-w-sm rounded-lg bg-slate-50 p-2 text-sm" data-testid="portal-dibuka-mulai">
          <span className="block text-xs text-slate-500">Dibuka mulai</span>
          <span className="font-medium text-slate-800">{waktuPanjang(galat.mulai_at)}</span>
          {sisa && <span className="block text-xs font-semibold text-[#006837]" data-testid="portal-sisa">{sisa}</span>}
        </p>
      )}
      {galat.alasan === 'sudah_selesai' && galat.selesai_at && (
        <p className="mx-auto mt-4 max-w-sm rounded-lg bg-slate-50 p-2 text-sm">
          <span className="block text-xs text-slate-500">Ditutup pada</span>
          <span className="font-medium text-slate-800">{waktuPanjang(galat.selesai_at)}</span>
        </p>
      )}
      <JadwalBerikutnya jadwal={galat.jadwal_berikutnya} />
      {a.periksa && onMuatUlang && (
        <Button variant="outline" onClick={onMuatUlang} disabled={memuat} className="mt-4 gap-2" data-testid="portal-periksa-lagi">
          <RefreshCw className={`h-4 w-4 ${memuat ? 'animate-spin' : ''}`} /> Periksa lagi
        </Button>
      )}
      {a.periksa && catatan && <p className="mt-2 text-xs text-slate-500" aria-live="polite" data-testid="portal-catatan-periksa">{catatan}</p>}
      <p className="mt-4 text-xs text-slate-500">Soal ujian hanya dapat dibuka lewat portal ini pada jam ujian. Tanyakan kepada pengawas ruang bila ada kendala.</p>
    </div>
  );
}
