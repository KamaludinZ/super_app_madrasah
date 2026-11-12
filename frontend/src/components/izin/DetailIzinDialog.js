import React from 'react';
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, ExternalLink, Eye, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { STATUS_IZIN, WAKTU_IZIN, labelPeran, teksDurasi, waktuIzin } from '@/lib/izinKamad';
import { formatWIBPanjang } from '@/lib/datetime';
import { hariIniWIB } from '@/lib/tanggal';
import FormCatatanIzin from '@/components/izin/FormCatatanIzin';
import CatatanIzinTerbatas from '@/components/izin/CatatanIzinTerbatas';

function Baris({ label, children, testid }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-2" data-testid={testid}>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="col-span-2 text-sm text-slate-900 break-words">{children}</dd>
    </div>
  );
}

/** Daftar rincian satu izin (pengaju, tanggal, jam, keperluan, keputusan). Dipakai dialog & halaman detail. */
export function RincianIzin({ izin }) {
  return (
    <dl className="divide-y divide-slate-100">
      <Baris label="Pengaju" testid="detail-izin-pengaju">
        <span className="font-semibold">{izin.pengaju_nama}</span>
        <span className="block text-xs text-slate-500">{labelPeran(izin.pengaju_peran)}</span>
      </Baris>
      <Baris label="Tanggal" testid="detail-izin-tanggal">{formatWIBPanjang(izin.tanggal, false)}</Baris>
      <Baris label="Jam" testid="detail-izin-jam">
        <span className="font-mono tabular-nums">{izin.jam_mulai}–{izin.jam_selesai} WIB</span>
        <span className="block text-xs text-slate-500">{teksDurasi(izin.jam_mulai, izin.jam_selesai)}</span>
      </Baris>
      <Baris label="Keperluan" testid="detail-izin-keperluan">{izin.keperluan}</Baris>
      <Baris label="Diajukan" testid="detail-izin-diajukan">{formatWIBPanjang(izin.dibuat_pada)}</Baris>
      {(izin.status === 'disetujui' || izin.status === 'ditolak') && (
        <Baris label="Diputuskan" testid="detail-izin-diputuskan">
          {izin.diputuskan_oleh_nama || '-'}
          <span className="block text-xs text-slate-500">{formatWIBPanjang(izin.diputuskan_pada)}</span>
        </Baris>
      )}
      {izin.status === 'ditolak' && (
        <Baris label="Alasan ditolak" testid="detail-izin-alasan">
          <span className="text-rose-800">{izin.alasan_penolakan || '-'}</span>
        </Baris>
      )}
    </dl>
  );
}

/**
 * Rincian satu izin, hanya-lihat: tidak ada tombol setujui/tolak/batalkan atau menandai jam
 * keluar/kembali. `bolehCatat` (satpam, izin disetujui) menampilkan formulir catatan satpam;
 * `onBatalkan` (pengaju sendiri) menampilkan tombol Batalkan selama status masih menunggu; `onSetujui`
 * (kepala madrasah) menampilkan tombol Setujui pada izin menunggu.
 * `izin` = null menutup dialog.
 */
export default function DetailIzinDialog({
  izin, jam, onTutup, bolehCatat = false, fokusCatatan = false, onBatalkan, onSetujui, onTolak, sibuk = false,
}) {
  const s = izin ? (STATUS_IZIN[izin.status] || STATUS_IZIN.menunggu) : null;
  const hariIni = izin && izin.status === 'disetujui' && izin.tanggal === hariIniWIB();
  const w = hariIni ? WAKTU_IZIN[waktuIzin(izin, jam)] : null;
  const tampilCatatan = bolehCatat && izin?.status === 'disetujui';
  const bisaBatal = !!onBatalkan && izin?.status === 'menunggu';
  const bisaPutus = !!onSetujui && izin?.status === 'menunggu';

  return (
    <Dialog open={!!izin} onOpenChange={(buka) => { if (!buka) onTutup(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" data-testid="dialog-detail-izin">
        {izin && (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2 pr-6">
                Detail Izin
                <Badge variant="outline" className={s.kelas}>{s.label}</Badge>
                {w && <Badge variant="outline" className={w.kelas}>{w.label}</Badge>}
              </DialogTitle>
              <DialogDescription className="flex items-center gap-1.5 text-xs">
                <Eye className="h-3.5 w-3.5" />
                {tampilCatatan ? 'Hanya-lihat — izin tidak dapat diubah, tetapi Anda dapat menambah catatan.'
                  : bisaBatal ? 'Pengajuan Anda masih menunggu keputusan; Anda dapat membatalkannya.'
                    : bisaPutus ? 'Pengajuan ini menunggu keputusan Anda.'
                    : 'Hanya-lihat — tidak ada aksi pada izin ini.'}
              </DialogDescription>
            </DialogHeader>

            <RincianIzin izin={izin} />

            {tampilCatatan && <FormCatatanIzin key={izin.id} izin={izin} fokus={fokusCatatan} />}
            {izin.status === 'disetujui' && <CatatanIzinTerbatas izinId={izin.id} />}

            <DialogFooter className="gap-2 sm:items-center">
              <Link to={`/izin/${izin.id}`} onClick={onTutup} className="mr-auto inline-flex items-center gap-1 text-xs text-[#006837] hover:underline" data-testid="tautan-halaman-detail-izin">
                <ExternalLink className="h-3 w-3" /> Buka halaman detail
              </Link>
              {bisaBatal && (
                <Button variant="outline" onClick={() => onBatalkan(izin)} disabled={sibuk}
                  className="gap-1.5 border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800" data-testid="btn-batalkan-detail-izin">
                  <XCircle className="h-4 w-4" /> {sibuk ? 'Membatalkan…' : 'Batalkan Pengajuan'}
                </Button>
              )}
              {bisaPutus && onTolak && (
                <Button variant="outline" onClick={() => onTolak(izin)} disabled={sibuk}
                  className="gap-1.5 border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800" data-testid="btn-tolak-detail-izin">
                  <XCircle className="h-4 w-4" /> Tolak
                </Button>
              )}
              {bisaPutus && (
                <Button onClick={() => onSetujui(izin)} disabled={sibuk} className="gap-1.5 bg-[#006837] hover:bg-[#00552d]" data-testid="btn-setujui-detail-izin">
                  <CheckCircle2 className="h-4 w-4" /> {sibuk ? 'Memproses…' : 'Setujui'}
                </Button>
              )}
              <DialogClose asChild>
                <Button variant="outline" data-testid="btn-tutup-detail-izin">Tutup</Button>
              </DialogClose>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
