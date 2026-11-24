import React from 'react';
import { Eye } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatWIBPanjang } from '@/lib/datetime';
import { LABEL_HASIL_AKSES, lamaPantau, ringkasPerangkat } from '@/lib/ujianTautanPublik';
import { LABEL_JENIS, LABEL_MODE_UNDUH } from '@/lib/ujianBerkasAdmin';
import { namaMapelUjian } from '@/lib/mapelUjian';

const NAMA_TAUTAN = { info: 'Info ujian', monitoring: 'Monitoring pengumpulan' };
const waktu = (iso) => (iso ? `${formatWIBPanjang(iso)} WIB` : '-');

/** Baris detail (label, nilai) untuk satu entri log — hanya field yang terisi. */
export function barisDetail(entri, jenis) {
  if (!entri) return [];
  const x = entri;
  const umum = [['Waktu', waktu(x.waktu)], ['IP sumber', x.ip], ['Rantai proxy (X-Forwarded-For)', x.ip_rantai],
    ['Perangkat', x.perangkat ? `${ringkasPerangkat(x.perangkat)} — ${x.perangkat}` : null]];
  const khusus = jenis === 'akses'
    ? [['Tautan', NAMA_TAUTAN[x.jenis_tautan] || 'Tidak dikenal'], ['Hasil', LABEL_HASIL_AKSES[x.hasil] || x.hasil], ['Sesi halaman', x.sesi],
      ['Terakhir aktif', x.jumlah_segarkan ? waktu(x.terakhir_aktif) : null], ['Pemantauan', lamaPantau(x)]]
    : [['Mode', LABEL_MODE_UNDUH[x.mode] || x.mode],
      ['Berkas', x.jenis_berkas === 'panduan_cbt' ? 'Panduan CBT' : LABEL_JENIS[x.jenis_berkas] || x.jenis_berkas],
      ['Kelas & mapel', x.jenjang ? `Kelas ${x.jenjang} · ${x.mapel ? namaMapelUjian(x.mapel) : 'semua mapel'}` : null],
      ['Isi ZIP', x.jumlah_berkas != null ? `${x.jumlah_berkas} berkas` : null],
      ['Mapel kosong di ZIP', x.mapel_kosong?.length ? x.mapel_kosong.map(namaMapelUjian).join(', ') : null],
      ['Pengunduh', x.pengunduh_nama || (x.mode === 'publik' ? 'Pengunjung tanpa login' : null)]];
  return [...khusus, ...umum].filter(([, v]) => v !== null && v !== undefined && v !== '');
}

/**
 * Detail satu entri jejak audit (akses tautan / unduhan) — HANYA BACA: tidak ada aksi ubah atau hapus; log tidak dapat
 * diubah dari aplikasi. `jenis` = 'akses' | 'unduh'; `entri` null = tertutup.
 */
export default function DetailLogAudit({ entri, jenis, onTutup }) {
  const baris = barisDetail(entri, jenis);
  return (
    <Dialog open={!!entri} onOpenChange={(o) => { if (!o) onTutup(); }}>
      <DialogContent className="max-w-lg" data-testid="detail-log-audit">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Eye className="h-4 w-4 text-[#006837]" /> Detail {jenis === 'akses' ? 'akses tautan' : 'unduhan'}</DialogTitle>
          <DialogDescription>Catatan jejak audit — hanya baca, tidak dapat diubah atau dihapus.</DialogDescription>
        </DialogHeader>
        <dl className="divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
          {baris.map(([label, nilai]) => (
            <div key={label} className="grid grid-cols-3 gap-2 px-3 py-2">
              <dt className="text-xs text-slate-500">{label}</dt>
              <dd className="col-span-2 break-words text-slate-800" data-testid={`detail-${label}`}>{nilai}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
