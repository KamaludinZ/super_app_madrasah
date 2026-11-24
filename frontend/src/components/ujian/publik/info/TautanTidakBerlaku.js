import React, { useEffect, useState } from 'react';
import { CalendarClock, CalendarX2, Link2Off, Lock, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatWIB } from '@/lib/datetime';
import { msSampai, teksSisaWaktu } from '@/lib/ujianInfoPublik';

const waktuPanjang = (iso) => `${formatWIB(iso, '', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} WIB`;

// Alasan dari server (validator token + jendela waktu tautan publik). `periksa`: boleh dicek ulang (bisa berubah).
const ALASAN = {
  tidak_dikenal: { Ikon: Link2Off, warna: 'text-amber-600', judul: 'Tautan tidak ditemukan', saran: 'Tautan ini salah ketik atau sudah diganti panitia.' },
  tidak_lengkap: { Ikon: Link2Off, warna: 'text-amber-600', judul: 'Tautan tidak lengkap', saran: 'Sepertinya tautan terpotong saat disalin. Buka kembali pesan aslinya lalu ketuk tautannya secara utuh.' },
  nonaktif: { Ikon: Lock, warna: 'text-slate-500', judul: 'Tautan sedang ditutup', saran: 'Panitia menutup tautan ini untuk sementara.', periksa: true },
  belum_mulai: { Ikon: CalendarClock, warna: 'text-slate-500', judul: 'Tautan belum dibuka', saran: 'Buka kembali tautan ini pada waktu yang ditentukan panitia.', periksa: true },
  sudah_selesai: { Ikon: CalendarX2, warna: 'text-slate-500', judul: 'Masa akses sudah berakhir', saran: 'Tautan ini sudah tidak dapat dibuka.' },
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

/**
 * Halaman "tautan tidak berlaku" untuk tautan publik ber-token: token tidak dikenal, ditutup manual, belum masuk, atau
 * sudah lewat jendela waktu akses. `galat` = { alasan, pesan, mulai_at, selesai_at } dari galatTautanInfo. Untuk tautan
 * yang ditutup/belum dibuka tersedia tombol "Periksa lagi" (`onMuatUlang`); waktu buka ditampilkan dengan hitung mundur.
 * `kontak` = kepada siapa meminta tautan baru; `catatan` = keterangan kecil di bawah tombol (mis. pemeriksaan otomatis).
 */
export default function TautanTidakBerlaku({ galat, onMuatUlang, memuat, kontak = 'wali kelas atau panitia ujian', catatan }) {
  const alasan = ALASAN[galat?.alasan] ? galat.alasan : 'nonaktif';
  const a = ALASAN[alasan];
  const sisa = teksSisaWaktu(useSisaWaktu(alasan === 'belum_mulai' ? galat?.mulai_at : null));
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm" data-testid="tautan-tidak-berlaku" data-alasan={alasan}>
      <a.Ikon className={`mx-auto mb-3 h-10 w-10 ${a.warna}`} aria-hidden="true" />
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tautan tidak berlaku</p>
      <h2 className="mt-1 text-lg font-bold text-slate-900">{a.judul}</h2>
      <p className="mt-1 text-sm text-slate-600">{galat?.pesan || a.saran}</p>
      {alasan === 'belum_mulai' && galat.mulai_at && (
        <p className="mx-auto mt-4 max-w-sm rounded-lg bg-slate-50 p-2 text-sm" data-testid="tautan-mulai">
          <span className="block text-xs text-slate-500">Dapat dibuka mulai</span>
          <span className="font-medium text-slate-800">{waktuPanjang(galat.mulai_at)}</span>
          {sisa && <span className="block text-xs font-semibold text-[#006837]" data-testid="tautan-sisa">{sisa}</span>}
        </p>
      )}
      {alasan === 'sudah_selesai' && galat.selesai_at && (
        <p className="mx-auto mt-4 max-w-sm rounded-lg bg-slate-50 p-2 text-sm">
          <span className="block text-xs text-slate-500">Berakhir pada</span>
          <span className="font-medium text-slate-800">{waktuPanjang(galat.selesai_at)}</span>
        </p>
      )}
      {a.periksa && onMuatUlang && (
        <Button variant="outline" onClick={onMuatUlang} disabled={memuat} className="mt-4 gap-2" data-testid="tautan-periksa-lagi">
          <RefreshCw className={`h-4 w-4 ${memuat ? 'animate-spin' : ''}`} /> Periksa lagi
        </Button>
      )}
      {a.periksa && catatan && <p className="mt-2 text-xs text-slate-500" aria-live="polite" data-testid="tautan-catatan">{catatan}</p>}
      <p className="mt-4 text-xs text-slate-500" data-testid="tautan-kontak">Mintalah tautan terbaru kepada {kontak}.</p>
    </div>
  );
}
