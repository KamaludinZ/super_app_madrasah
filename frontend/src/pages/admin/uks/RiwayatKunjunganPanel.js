import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CalendarCheck, ChevronDown, ChevronUp, Eye, History, Loader2, RefreshCw } from 'lucide-react';

const STATUS_BADGE = {
  'Belum Ditangani': 'bg-amber-100 text-amber-700 border-amber-200',
  'Sudah Ditangani': 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const PERIODE_HARI = 365;

// Batas awal periode (YYYY-MM-DD) = hari ini (WIB) dikurangi 365 hari.
export const startOfRiwayatPeriode = () => {
  const now = new Date(Date.now() + 7 * 3600000);
  now.setUTCDate(now.getUTCDate() - PERIODE_HARI);
  return now.toISOString().split('T')[0];
};

// Urut terbaru ke terlama: tanggal, lalu jam (kosong dianggap paling awal di hari itu),
// lalu waktu input (created_at) agar urutan stabil untuk kunjungan di jam yang sama.
export const compareKunjunganTerbaru = (a, b) =>
  (b.tanggal || '').localeCompare(a.tanggal || '')
  || (b.waktu || '').localeCompare(a.waktu || '')
  || (b.created_at || '').localeCompare(a.created_at || '');

export const filterRiwayatSetahun = (items) => {
  const start = startOfRiwayatPeriode();
  return (items || [])
    .filter((k) => (k.tanggal || '') >= start)
    .sort(compareKunjunganTerbaru);
};

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const labelBulan = (tanggal) => {
  const m = String(tanggal || '').match(/^(\d{4})-(\d{2})/);
  return m ? `${BULAN[Number(m[2]) - 1]} ${m[1]}` : 'Tanpa tanggal';
};

function formatTanggal(dateStr) {
  const m = String(dateStr || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : (dateStr || '-');
}

// Kunjungan berulang: >= 3 kali dalam 30 hari terakhir.
const KUNJUNGAN_BERULANG_MIN = 3;
const KUNJUNGAN_BERULANG_HARI = 30;

const countRecent = (items, days) => {
  const now = new Date(Date.now() + 7 * 3600000);
  now.setUTCDate(now.getUTCDate() - days);
  const start = now.toISOString().split('T')[0];
  return items.filter((k) => (k.tanggal || '') >= start).length;
};

const SARAN_BERULANG = {
  siswa: 'Pertimbangkan memberi tahu wali kelas atau menghubungi orang tua/wali siswa.',
  gtk: 'Pertimbangkan menyarankan pemeriksaan lanjutan ke fasilitas kesehatan.',
};

export const penangananRingkas = (k) => {
  const parts = [];
  if (k.jenis_penanganan_nama?.length) parts.push(k.jenis_penanganan_nama.join(', '));
  if (k.penanganan) parts.push(k.penanganan);
  return parts.join(' — ');
};

export const pemakaianRingkas = (k) => [
  ...(k.obat_dipakai || []).map((o) => `${o.obat_nama} ×${o.jumlah}`),
  ...(k.bmhp_dipakai || []).map((b) => `${b.bmhp_nama} ×${b.jumlah}`),
].join(', ');

/**
 * Panel riwayat kunjungan UKS seorang pasien dalam 1 tahun terakhir, ditampilkan
 * di bawah form input kunjungan sebagai rujukan petugas (keluhan, diagnosa, dan
 * penanganan sebelumnya). `items` = kunjungan pasien yang sudah disaring 1 tahun.
 */
export default function RiwayatKunjunganPanel({ items, loading, error, onRetry, onDetail, initialVisible = 3, jenisPasien = 'siswa' }) {
  const [expanded, setExpanded] = useState(false);
  const list = items || [];
  const shown = expanded ? list : list.slice(0, initialVisible);
  const totalDitangani = list.filter((k) => k.status === 'Sudah Ditangani').length;
  const keluhanSering = (() => {
    const counts = {};
    list.forEach((k) => { if (k.diagnosa_utama_nama) counts[k.diagnosa_utama_nama] = (counts[k.diagnosa_utama_nama] || 0) + 1; });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return top && top[1] > 1 ? `${top[0]} (${top[1]}×)` : null;
  })();

  const recentCount = countRecent(list, KUNJUNGAN_BERULANG_HARI);
  const subjek = jenisPasien === 'gtk' ? 'GTK ini' : 'siswa ini';

  return (
    <div data-testid="riwayat-kunjungan-panel">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase">
          <History className="h-3.5 w-3.5" /> Kunjungan UKS — 1 tahun terakhir
        </div>
        {!loading && list.length > 0 && (
          <div className="text-xs text-slate-500">
            {list.length} kunjungan · {totalDitangani} sudah ditangani
            {keluhanSering && <> · paling sering: <span className="font-medium text-slate-700">{keluhanSering}</span></>}
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-4 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-[#006837]" /></div>
      ) : error ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" data-testid="riwayat-error">
          <span>Riwayat kunjungan gagal dimuat, jadi belum bisa dipastikan apakah {subjek} pernah berkunjung.</span>
          {onRetry && (
            <Button type="button" size="sm" variant="outline" onClick={onRetry} className="gap-1 shrink-0">
              <RefreshCw className="h-3.5 w-3.5" /> Coba lagi
            </Button>
          )}
        </div>
      ) : list.length === 0 ? (
        <div className="flex items-start gap-3 rounded-md border border-dashed border-slate-300 bg-white px-3 py-3 text-sm" data-testid="riwayat-kosong">
          <CalendarCheck className="h-5 w-5 shrink-0 text-emerald-600" />
          <div>
            <div className="font-medium text-slate-700">Belum ada kunjungan UKS dalam 1 tahun terakhir</div>
            <div className="text-xs text-slate-500">Ini kunjungan pertama {subjek} di UKS selama setahun terakhir; tidak ada keluhan atau penanganan sebelumnya untuk dirujuk.</div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {recentCount >= KUNJUNGAN_BERULANG_MIN && (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" data-testid="kunjungan-berulang">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{recentCount} kunjungan dalam {KUNJUNGAN_BERULANG_HARI} hari terakhir. {SARAN_BERULANG[jenisPasien] || SARAN_BERULANG.siswa}</span>
            </div>
          )}
          {shown.map((k, idx) => {
            const penanganan = penangananRingkas(k);
            const pemakaian = pemakaianRingkas(k);
            const bulan = labelBulan(k.tanggal);
            const bulanBaru = idx === 0 || labelBulan(shown[idx - 1].tanggal) !== bulan;
            return (
              <React.Fragment key={k.id}>
              {bulanBaru && (
                <div className="pt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400" data-testid="riwayat-bulan">{bulan}</div>
              )}
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm" data-testid="riwayat-item">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2">
                      <span className="font-mono text-slate-500">{formatTanggal(k.tanggal)}{k.waktu ? ` · ${k.waktu}` : ''}</span>
                      {k.diagnosa_utama_nama && <span className="font-medium text-slate-800">{k.diagnosa_utama_nama}</span>}
                    </div>
                    <div className="text-slate-700"><span className="text-slate-500">Keluhan:</span> {k.keluhan || '-'}</div>
                    {penanganan && <div className="text-slate-700"><span className="text-slate-500">Penanganan:</span> {penanganan}</div>}
                    {pemakaian && <div className="text-xs text-slate-500">Obat/BMHP: {pemakaian}</div>}
                    {k.kondisi_pulang && <div className="text-xs text-slate-500">Kondisi pulang: {k.kondisi_pulang}{k.dirujuk_ke ? ` (${k.dirujuk_ke})` : ''}</div>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge className={STATUS_BADGE[k.status] || ''}>{k.status}</Badge>
                    {onDetail && (
                      <Button size="icon" variant="ghost" onClick={() => onDetail(k)} className="h-7 w-7 text-blue-600 hover:text-blue-700" aria-label="Lihat detail kunjungan">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              </React.Fragment>
            );
          })}
          {list.length > initialVisible && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)} className="gap-1 text-slate-600">
              {expanded ? <><ChevronUp className="h-4 w-4" /> Tampilkan lebih sedikit</> : <><ChevronDown className="h-4 w-4" /> Tampilkan semua ({list.length})</>}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
