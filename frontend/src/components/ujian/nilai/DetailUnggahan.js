import React from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { formatWIBPanjang } from '@/lib/datetime';
import { BadgeStatusImpor } from '@/components/ujian/nilai/MonitoringImpor';
import { labelTahap } from '@/lib/ujianNilai';

const durasi = (mulai, selesai) => {
  if (!mulai || !selesai) return null;
  const d = Math.max(0, Math.round((new Date(selesai) - new Date(mulai)) / 1000));
  return d < 60 ? `${d} detik` : `${Math.floor(d / 60)} menit ${d % 60} detik`;
};

/** Detail satu unggahan impor nilai: berkas, mapel & jenjang, pengunggah, waktu mulai/selesai, durasi, tahap, dan status. */
export default function DetailUnggahan({ log }) {
  if (!log) return null;
  const baris = [
    ['Berkas', log.berkas], ['Mata pelajaran', log.mapel_nama], ['Jenjang', `Kelas ${log.jenjang}`],
    ['Diunggah oleh', [log.diunggah_oleh_nama, log.diunggah_sebagai].filter(Boolean).join(' · ') || '—'], ['Mulai', formatWIBPanjang(log.waktu)],
    ['Selesai', log.selesai_pada ? formatWIBPanjang(log.selesai_pada) : '—'], ['Durasi', durasi(log.waktu, log.selesai_pada) || '—'],
    ['Sheet kelas', (log.per_sheet || []).map((s) => s.sheet).join(', ') || '—'],
    ['Tahap', log.status === 'gagal' ? `Berhenti saat: ${labelTahap(log.gagal_di?.tahap || log.tahap)}` : labelTahap(log.status === 'selesai' ? 'selesai' : log.tahap || 'diterima')],
    ['Aktivitas terakhir', log.diperbarui ? formatWIBPanjang(log.diperbarui) : '—'],
  ];
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4" data-testid="detail-unggahan">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><FileSpreadsheet className="h-4 w-4 text-[#006837]" /> Detail unggahan</h3>
        <BadgeStatusImpor status={log.status} />
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        {baris.map(([k, v]) => (
          <div key={k} className="flex gap-2"><dt className="w-32 shrink-0 text-slate-500">{k}</dt><dd className="min-w-0 break-words text-slate-900">{v}</dd></div>
        ))}
      </dl>
    </section>
  );
}
