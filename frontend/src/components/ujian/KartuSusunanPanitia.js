import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalendarRange, History, Pencil, UserRound, UserX } from 'lucide-react';
import { formatWIBPanjang } from '@/lib/datetime';
import BadgeStatusFormulir from '@/components/ujian/BadgeStatusFormulir';
import { rentangTanggal } from '@/components/ujian/DaftarUjian';
import { JABATAN_PANITIA, JENIS_UJIAN, LABEL_JABATAN } from '@/lib/ujian';

export const jumlahTerisi = (panitia) => JABATAN_PANITIA.filter((j) => panitia?.[j]).length;

function Pejabat({ jabatan, pejabat }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-slate-100 p-3" data-testid={`pejabat-${jabatan}`}>
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${pejabat ? 'bg-emerald-50 text-[#006837]' : 'bg-slate-50 text-slate-400'}`}>
        {pejabat ? <UserRound className="h-4 w-4" /> : <UserX className="h-4 w-4" />}
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{LABEL_JABATAN[jabatan]}</div>
        {pejabat ? (
          <>
            <div className="truncate text-sm font-medium text-slate-900">{pejabat.nama}</div>
            <div className="text-xs text-slate-500">{pejabat.nip && pejabat.nip !== '-' ? `NIP ${pejabat.nip}` : 'NIP -'}</div>
          </>
        ) : <div className="text-sm text-slate-400">Belum ditetapkan</div>}
      </div>
    </div>
  );
}

/**
 * Susunan panitia tersimpan satu ujian: penanggung jawab, ketua, sekretaris, bendahara, beserta perubahan terakhir.
 * `onUbah` membuka penyunting; `sorot` menandai kartu yang baru saja disimpan.
 */
export default function KartuSusunanPanitia({ ujian, panitia, diubah, onUbah, sorot = false }) {
  const jenis = JENIS_UJIAN[ujian.jenis] || JENIS_UJIAN.UTS;
  const terisi = jumlahTerisi(panitia);
  return (
    <Card className={`transition-shadow ${sorot ? 'ring-2 ring-[#006837]/40' : ''}`} data-testid={`susunan-panitia-${ujian.id}`}>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base flex flex-wrap items-center gap-2">
              <Badge className={jenis.kelas} title={jenis.nama}>{jenis.label}</Badge> {ujian.nama}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1"><CalendarRange className="h-3.5 w-3.5" /> {rentangTanggal(ujian.mulai, ujian.selesai)}</span>
              <span className={terisi === JABATAN_PANITIA.length ? 'text-emerald-700' : 'text-amber-700'}>
                {terisi}/{JABATAN_PANITIA.length} jabatan terisi
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <BadgeStatusFormulir formulir={ujian.formulir} ringkas />
            {onUbah && (
              <Button variant="outline" size="sm" onClick={() => onUbah(ujian, panitia, diubah)} className="gap-1" data-testid={`btn-ubah-panitia-${ujian.id}`}>
                <Pencil className="h-3.5 w-3.5" /> Susun Panitia
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {terisi === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500" data-testid={`panitia-kosong-${ujian.id}`}>
            Panitia ujian ini belum disusun.{onUbah && ' Klik "Susun Panitia" untuk memilih pejabat dari akun GTK.'}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {JABATAN_PANITIA.map((j) => <Pejabat key={j} jabatan={j} pejabat={panitia?.[j]} />)}
          </div>
        )}
        {diubah?.pada && (
          <p className="inline-flex items-center gap-1 text-xs text-slate-500" data-testid={`panitia-diubah-${ujian.id}`}>
            <History className="h-3.5 w-3.5" /> Diperbarui {formatWIBPanjang(diubah.pada)}{diubah.oleh_nama ? ` oleh ${diubah.oleh_nama}` : ''}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
