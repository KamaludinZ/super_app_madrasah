import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { formatPoin, nilaiPoin } from '@/components/tatib/RingkasanPoin';
import { formatTanggalPoin } from '@/components/tatib/RiwayatPoin';

function Baris({ label, children }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-2 py-1.5 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-900 break-words">{children || '-'}</dd>
    </div>
  );
}

// Rincian satu catatan poin tata tertib: kategori, nilai, kondisi, tanggal,
// pencatat, dan tindak lanjut penanganannya (untuk pelanggaran).
// `tampilkanSiswa` menambah baris identitas siswa (untuk tampilan guru/wali);
// `onLihatSiswa` menampilkan tombol membuka seluruh poin siswa tersebut.
export default function RincianPoinDialog({ catatan, onClose, tampilkanSiswa = false, onLihatSiswa }) {
  const poin = nilaiPoin(catatan);
  const plus = poin > 0;
  const Ikon = plus ? ThumbsUp : ThumbsDown;
  const tindakLanjut = catatan?.tindak_lanjut || [];

  return (
    <Dialog open={!!catatan} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto" data-testid="poin-rincian">
        {catatan && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Badge className={plus ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-red-100 text-red-800 border-red-200'}>
                  <Ikon className="h-3 w-3 mr-1" /> {plus ? 'Poin Kebaikan' : 'Poin Pelanggaran'}
                </Badge>
                {catatan.tatib_kode && <span className="text-xs text-slate-500">{catatan.tatib_kode}</span>}
              </div>
              <DialogTitle className="text-left">{catatan.tatib_nama}</DialogTitle>
              <DialogDescription className="text-left">{formatTanggalPoin(catatan.tanggal)}</DialogDescription>
            </DialogHeader>

            <div className={`rounded-lg p-4 text-center ${plus ? 'bg-emerald-50' : 'bg-red-50'}`}>
              <p className={`text-4xl font-bold tabular-nums ${plus ? 'text-emerald-700' : 'text-red-700'}`}>{formatPoin(poin)}</p>
              <p className="text-xs text-slate-500 mt-1">poin</p>
            </div>

            <dl className="divide-y">
              {tampilkanSiswa && (
                <Baris label="Siswa">
                  {catatan.siswa_nama}{catatan.siswa_kelas ? ` (${catatan.siswa_kelas})` : ''}
                </Baris>
              )}
              <Baris label="Kategori">{catatan.kategori_nama}</Baris>
              <Baris label="Jenis">{catatan.jenis_nama}</Baris>
              <Baris label="Kondisi">{catatan.kondisi}</Baris>
              <Baris label="Dicatat oleh">{catatan.petugas_nama}</Baris>
              <Baris label="Keterangan">{catatan.catatan}</Baris>
            </dl>

            {!plus && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-900">Tindak Lanjut</h3>
                {tindakLanjut.length === 0 ? (
                  <p className="text-sm text-slate-500">Belum ada tindak lanjut yang dicatat.</p>
                ) : (
                  <ol className="space-y-2 border-l-2 border-slate-200 pl-4">
                    {tindakLanjut.map((t, i) => (
                      <li key={i} className="text-sm">
                        <p className="text-slate-900">{t.uraian}</p>
                        <p className="text-xs text-slate-500">{formatTanggalPoin(t.tanggal)}{t.petugas_nama ? ` · ${t.petugas_nama}` : ''}</p>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}

            {onLihatSiswa && (
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => onLihatSiswa(catatan)} data-testid="rincian-lihat-siswa">
                  Lihat semua poin siswa
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
