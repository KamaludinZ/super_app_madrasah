import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Gavel, Loader2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { Navigate } from 'react-router-dom';
import { bolehBukaInputTatib, bolehInputTatib, halamanPoinTatib, pesanGalatTatib, tolakUbahTatib } from '@/lib/aksesTatib';
import UbahTindakanDialog from '@/components/tatib/UbahTindakanDialog';
import RiwayatTindakanPanel from '@/components/tatib/RiwayatTindakanPanel';
import { formatPoin } from '@/components/tatib/RingkasanPoin';
import BannerModeLihat from '@/components/tatib/BannerModeLihat';
import { TINGKAT_SP, ambangBerikutnya, ambilTindakan, simpanStatusTindakan, usulanLebihTinggi } from '@/lib/tindakanTatib';

export const WARNA_SP = {
  SP1: 'bg-amber-100 text-amber-800 border-amber-200',
  SP2: 'bg-orange-100 text-orange-800 border-orange-200',
  SP3: 'bg-red-100 text-red-800 border-red-200',
};

const WARNA_STATUS = {
  'Tidak diperlukan': 'text-slate-500',
  'Tidak perlu': 'text-slate-500',
  Diajukan: 'border-amber-200 bg-amber-50 text-amber-800',
  Terlaksana: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  Diserahkan: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  Disusun: 'border-emerald-200 bg-emerald-50 text-emerald-800',
};

export const BadgeStatus = ({ nilai }) => (
  <Badge variant="outline" className={`whitespace-nowrap font-normal ${WARNA_STATUS[nilai] || ''}`}>{nilai || '-'}</Badge>
);

// Label kategori: nama · total poin (jumlah catatan); warna mengikuti jalur poin.
const LabelKategori = ({ items, negatif }) => {
  if (!items?.length) return <span className="text-slate-300">-</span>;
  const warna = negatif ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800';
  return (
    <div className="flex max-w-[16rem] flex-wrap gap-1">
      {items.map((k) => (
        <span key={k.nama} className={`inline-flex items-center gap-1 whitespace-nowrap rounded border px-1.5 py-0.5 text-[11px] ${warna}`}
          title={`${k.jumlah} catatan`}>
          {k.nama}
          <span className="font-semibold tabular-nums">{formatPoin(k.poin)}</span>
          <span className="opacity-60">({k.jumlah}×)</span>
        </span>
      ))}
    </div>
  );
};

// Usulan SP otomatis (dari ambang) + jarak ke tingkat berikutnya.
const UsulanSP = ({ siswa, ambang }) => {
  const lanjut = ambang ? ambangBerikutnya(siswa.poin_negatif, ambang) : null;
  return (
    <div className="space-y-1">
      {siswa.usulan_sp ? (
        <Badge variant="outline" className={WARNA_SP[siswa.usulan_sp]} title={`Akumulasi pelanggaran mencapai ambang ${siswa.usulan_sp}`}>{siswa.usulan_sp}</Badge>
      ) : <span className="text-xs text-slate-400">Belum ada</span>}
      {lanjut && siswa.poin_negatif < 0 && (
        <div className="whitespace-nowrap text-[11px] text-slate-500">{lanjut.sisa} poin lagi ke {lanjut.sp}</div>
      )}
    </div>
  );
};

// Tindakan Tatib: siswa yang tercatat poin (plus & minus), usulan SP otomatis dari ambang poin,
// dan status pembinaan (panggilan wali, SP, RTLPD) yang ditetapkan manual oleh peran input tatib.
export default function TatibTindakanPage() {
  const { activeRole } = useAuth();
  // Ubah: admin, guru tata tertib, waka kesiswaan. Lihat: peran pimpinan/BK. Lainnya dialihkan.
  const bolehUbah = bolehInputTatib(activeRole);
  const bolehLihat = bolehBukaInputTatib(activeRole);
  const [data, setData] = useState({ ambang: null, items: [] });
  const [loading, setLoading] = useState(true);
  const [diubah, setDiubah] = useState(null); // siswa yang dialog ubah tindakannya terbuka
  const [riwayatSiswa, setRiwayatSiswa] = useState(null); // siswa yang panel riwayatnya terbuka
  const [versiRiwayat, setVersiRiwayat] = useState(0);

  const bukaUbah = (s) => {
    if (tolakUbahTatib(activeRole)) return;
    setDiubah(s);
  };

  // Simpan lalu perbarui baris itu saja di state (tanpa memuat ulang seluruh daftar).
  const simpanTindakan = async (isian) => {
    if (!bolehUbah) throw new Error('Peran Anda hanya dapat melihat tindakan tatib');
    const hasil = await simpanStatusTindakan(diubah.siswa_id, isian);
    setData((d) => ({ ...d, items: d.items.map((x) => (x.siswa_id === hasil.siswa_id ? { ...x, ...hasil } : x)) }));
    setVersiRiwayat((v) => v + 1);
    return hasil;
  };

  useEffect(() => {
    if (!bolehLihat) return;
    ambilTindakan()
      .then(setData)
      .catch((e) => toast.error(pesanGalatTatib(e, 'Gagal memuat data tindakan tatib')))
      .finally(() => setLoading(false));
  }, [bolehLihat]);

  const jumlahUsulan = useMemo(() => {
    const n = { SP1: 0, SP2: 0, SP3: 0 };
    data.items.forEach((s) => { if (s.usulan_sp) n[s.usulan_sp] += 1; });
    return n;
  }, [data.items]);

  if (!bolehLihat) return <Navigate to={halamanPoinTatib(activeRole)} replace />;

  return (
    <div className="p-6 space-y-6" data-testid="tatib-tindakan-page">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Gavel className="h-6 w-6" /> Tindakan Tatib</h1>
        <p className="text-sm text-slate-600">
          Siswa yang tercatat poin tata tertib. SP diusulkan otomatis dari ambang poin; status pembinaan ditetapkan manual.
        </p>
      </div>

      {!bolehUbah && (
        <BannerModeLihat>Mode lihat saja — status pembinaan hanya dapat diubah oleh admin, guru tata tertib, dan waka kesiswaan.</BannerModeLihat>
      )}

      {data.ambang && (
        <div className="flex flex-wrap gap-2 text-sm" data-testid="tindakan-ringkasan">
          {TINGKAT_SP.map((sp) => (
            <span key={sp} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 ${WARNA_SP[sp]}`}>
              <span className="font-semibold">{sp}</span>
              <span className="text-xs opacity-80">≥ {data.ambang[sp.toLowerCase()]} poin</span>
              <span className="font-bold tabular-nums">{jumlahUsulan[sp]}</span>
            </span>
          ))}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center p-8 text-slate-500"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Memuat data...</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead rowSpan={2} className="align-bottom">NISN</TableHead>
                    <TableHead rowSpan={2} className="align-bottom">Nama Siswa</TableHead>
                    <TableHead rowSpan={2} className="align-bottom">Kelas</TableHead>
                    <TableHead colSpan={2} className="h-8 border-b border-emerald-200 bg-emerald-50 text-center text-emerald-800">Poin Positif</TableHead>
                    <TableHead colSpan={2} className="h-8 border-b border-red-200 bg-red-50 text-center text-red-800">Poin Negatif</TableHead>
                    <TableHead rowSpan={2} className="align-bottom">Usulan SP</TableHead>
                    <TableHead rowSpan={2} className="align-bottom">Keterangan SP</TableHead>
                    <TableHead colSpan={3} className="h-8 border-b text-center">Status Pembinaan</TableHead>
                    {bolehUbah && <TableHead rowSpan={2} className="align-bottom text-right">Aksi</TableHead>}
                  </TableRow>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="bg-emerald-50/60 text-right">Jumlah</TableHead>
                    <TableHead className="bg-emerald-50/60">Kategori</TableHead>
                    <TableHead className="bg-red-50/60 text-right">Jumlah</TableHead>
                    <TableHead className="bg-red-50/60">Kategori</TableHead>
                    <TableHead>Panggilan Wali</TableHead>
                    <TableHead>Status SP</TableHead>
                    <TableHead>RTLPD</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((s) => (
                    <TableRow key={s.siswa_id} data-testid={`tindakan-${s.siswa_id}`}>
                      <TableCell className="font-mono text-xs">{s.nisn || '-'}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <button
                          type="button"
                          className="text-left font-medium text-[#006837] hover:underline"
                          onClick={() => setRiwayatSiswa(s)}
                          title="Lihat riwayat tindakan"
                          data-testid={`tindakan-riwayat-${s.siswa_id}`}
                        >
                          {s.nama}
                        </button>
                        {s.diubah_pada && (
                          <div className="text-[11px] text-slate-400">diubah {String(s.diubah_pada).slice(0, 10)} · {s.diubah_oleh_nama || '-'}</div>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{s.kelas || '-'}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-emerald-700" data-testid={`tindakan-plus-${s.siswa_id}`}>
                        {s.poin_positif ? formatPoin(s.poin_positif) : <span className="text-slate-300">0</span>}
                      </TableCell>
                      <TableCell><LabelKategori items={s.kategori_positif} /></TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-red-700" data-testid={`tindakan-minus-${s.siswa_id}`}>
                        {s.poin_negatif ? formatPoin(s.poin_negatif) : <span className="text-slate-300">0</span>}
                      </TableCell>
                      <TableCell><LabelKategori items={s.kategori_negatif} negatif /></TableCell>
                      <TableCell data-testid={`tindakan-usulan-${s.siswa_id}`}>
                        <UsulanSP siswa={s} ambang={data.ambang} />
                      </TableCell>
                      <TableCell data-testid={`tindakan-sp-${s.siswa_id}`}>
                        {s.keterangan_sp ? (
                          <Badge variant="outline" className={WARNA_SP[s.keterangan_sp]}>{s.keterangan_sp}</Badge>
                        ) : <span className="text-slate-300">-</span>}
                        {usulanLebihTinggi(s.usulan_sp, s.keterangan_sp) && (
                          <div className="mt-1 flex items-center gap-1 whitespace-nowrap text-[11px] text-amber-700" data-testid={`tindakan-tinjau-${s.siswa_id}`}>
                            <AlertTriangle className="h-3 w-3" /> perlu ditinjau
                          </div>
                        )}
                      </TableCell>
                      <TableCell><BadgeStatus nilai={s.status_panggilan_wali} /></TableCell>
                      <TableCell><BadgeStatus nilai={s.status_sp} /></TableCell>
                      <TableCell><BadgeStatus nilai={s.status_rtlpd} /></TableCell>
                      {bolehUbah && (
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" className="whitespace-nowrap" onClick={() => bukaUbah(s)} data-testid={`tindakan-ubah-${s.siswa_id}`}>
                            <Pencil className="h-3.5 w-3.5 mr-1" /> Ubah
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {data.items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={bolehUbah ? 13 : 12} className="py-8 text-center text-slate-500">Belum ada siswa yang tercatat poin.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <UbahTindakanDialog siswa={diubah} onClose={() => setDiubah(null)} onSimpan={simpanTindakan} />
      <RiwayatTindakanPanel siswa={riwayatSiswa} onClose={() => setRiwayatSiswa(null)} versi={versiRiwayat} />
    </div>
  );
}
