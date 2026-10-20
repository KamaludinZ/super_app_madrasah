import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { IdCard, School, Users } from 'lucide-react';

function Baris({ label, nilai }) {
  return (
    <div className="grid grid-cols-[minmax(0,10rem)_1fr] gap-2 border-b border-slate-100 py-1.5 text-sm last:border-0">
      <dt className="text-slate-500">{label}</dt>
      <dd className={nilai ? 'text-slate-900' : 'text-slate-400'}>{nilai || '-'}</dd>
    </div>
  );
}

function KartuIdentitas({ judul, ikon: Ikon, baris }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Ikon className="h-4 w-4 text-[#006837]" /> {judul}</CardTitle></CardHeader>
      <CardContent><dl>{baris.map(([label, nilai]) => <Baris key={label} label={label} nilai={nilai} />)}</dl></CardContent>
    </Card>
  );
}

const gabung = (...x) => x.filter(Boolean).join(' / ') || null;

// Lampiran identitas guru yang dinilai & tim penilai (isi sheet 00-DATA -> 02-IDNTY pada berkas hasil PKG).
// `data` dari lib/pkgRekap.ambilIdentitasGuru. Field yang belum ada di data GTK tampil '-' (juga '-' pada cetak).
export default function LampiranIdentitas({ data }) {
  const { guru = {}, penilai, kepala = {}, sekolah = {}, sk = {}, periode = {} } = data;
  return (
    <div className="space-y-4" data-testid="pkg-lampiran-identitas">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <KartuIdentitas judul="Identitas Guru yang Dinilai" ikon={IdCard} baris={[
          ['Nama', guru.nama], ['NIP / Peg ID', guru.nip], ['NUPTK / NRG', guru.nuptk], ['Tempat / tgl lahir', guru.tempat_tanggal_lahir],
          ['Pangkat / gol. / TMT', gabung(guru.pangkat, guru.golongan, guru.tmt_golongan)], ['Jabatan', guru.jabatan],
          ['Masa kerja', guru.masa_kerja], ['Jenis kelamin', guru.jenis_kelamin], ['Pendidikan terakhir', guru.pendidikan],
          ['Spesialisasi', guru.spesialisasi], ['Mapel', guru.mapel], ['Tugas tambahan', guru.tugas_tambahan],
        ]} />
        <div className="space-y-4">
          <KartuIdentitas judul="Penilai & SK Penugasan" ikon={IdCard} baris={[
            ['Penilai', penilai?.nama], ['NIP', penilai?.nip], ['SK penugasan', sk.tentang], ['Nomor', sk.nomor], ['Tanggal', sk.tanggal],
            ['Berlaku s.d.', sk.berlaku_sampai], ['Periode penilaian', [periode.mulai, periode.selesai].filter(Boolean).join(' s.d. ')],
            ['Tanggal penilaian', periode.tanggal_penilaian],
          ]} />
          <KartuIdentitas judul="Madrasah & Kepala" ikon={School} baris={[
            ['Nama madrasah', sekolah.nama], ['Telepon', sekolah.telepon], ['Alamat', sekolah.alamat], ['Kab./Kota', sekolah.kota],
            ['Kepala madrasah', kepala.nama], ['NIP kepala', kepala.nip],
          ]} />
        </div>
      </div>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4 text-[#006837]" /> Tim Penilai SK</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-1.5 pr-3 font-medium">Nama</th><th className="py-1.5 pr-3 font-medium">NIP / Peg ID</th>
                <th className="py-1.5 pr-3 font-medium">Unit/mapel</th><th className="py-1.5 font-medium">Peran dalam tim</th>
              </tr>
            </thead>
            <tbody>
              {(data.tim_penilai || []).map((t) => (
                <tr key={t.id} className="border-b border-slate-100">
                  <td className="py-1.5 pr-3 text-slate-900">{t.nama || '-'}</td>
                  <td className="py-1.5 pr-3">{t.nip || '-'}</td>
                  <td className="py-1.5 pr-3">{t.mapel || '-'}</td>
                  <td className="py-1.5">{t.peran}{t.penilai_lembar && <Badge variant="outline" className="ml-2">Penilai guru ini</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.tim_penilai?.length && <p className="py-4 text-center text-sm text-slate-500">SK periode belum memiliki tim penilai.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
