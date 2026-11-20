import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { confirmDialog } from '@/components/ui/confirm-dialog';
import { ArrowRightLeft, FileSpreadsheet, FileUp, Hash, Loader2, UserMinus, UserPlus } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import DaftarRuang, { BadgeJenjang } from '@/components/ujian/DaftarRuang';
import PilihSiswaDialog from '@/components/ujian/PilihSiswaDialog';
import PindahRuangDialog from '@/components/ujian/PindahRuangDialog';
import NomorPesertaDialog from '@/components/ujian/NomorPesertaDialog';
import TemplatePesertaDialog from '@/components/ujian/TemplatePesertaDialog';
import ImporPesertaDialog from '@/components/ujian/ImporPesertaDialog';
import { pesanGalat } from '@/lib/ujian';
import { hapusPeserta, muatPesertaRuang } from '@/lib/ujianPeserta';

/**
 * Peserta per Ruang: pilih ruang, lihat daftar pesertanya (nomor peserta, nama, kelas), lalu tambah siswa dari data
 * siswa atau keluarkan peserta. `ruangList` dari GET /ujian/{id}/ruang; `onBerubah()` memuat ulang ringkasan ruang.
 */
export default function PesertaRuangPanel({ ujian, ruangList = [], bolehUbah, onBerubah }) {
  const ujianId = ujian?.id;
  const [ruangId, setRuangId] = useState(ruangList[0]?.id || null);
  const [data, setData] = useState(null);
  const [memuat, setMemuat] = useState(false);
  const [tambah, setTambah] = useState(null);
  const [pindah, setPindah] = useState(null);
  const [aturNomor, setAturNomor] = useState(null);
  const [template, setTemplate] = useState(null);
  const [impor, setImpor] = useState(null);

  useEffect(() => {
    if (!ruangList.some((r) => r.id === ruangId)) setRuangId(ruangList[0]?.id || null);
  }, [ruangList, ruangId]);

  const muat = useCallback(async () => {
    if (!ruangId) { setData(null); return; }
    setMemuat(true);
    try {
      setData(await muatPesertaRuang(ujianId, ruangId));
    } catch (e) {
      toast.error(pesanGalat(e, 'Gagal memuat peserta ruang.'));
    } finally {
      setMemuat(false);
    }
  }, [ujianId, ruangId]);

  useEffect(() => { muat(); }, [muat]);

  const ruang = data?.ruang || ruangList.find((r) => r.id === ruangId);
  const items = data?.items || [];
  const sisa = ruang ? Math.max(0, ruang.kapasitas - items.length) : 0;

  const keluarkan = async (p) => {
    if (!(await confirmDialog(`Keluarkan ${p.nama} dari Ruang ${ruang.nama_ruang}? Nomor pesertanya ikut dilepas.`, { confirmText: 'Keluarkan' }))) return;
    try {
      await hapusPeserta(ujianId, ruangId, p.id);
      toast.success(`${p.nama} dikeluarkan dari Ruang ${ruang.nama_ruang}`);
      muat();
      onBerubah?.();
    } catch (e) {
      toast.error(pesanGalat(e, 'Gagal mengeluarkan peserta.'));
    }
  };

  if (!ruangList.length) {
    return <EmptyState illustration="mosque" size="sm" title="Belum ada ruang" description="Tambahkan ruang ujian terlebih dahulu di tab Daftar Ruang." />;
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pilih ruang</p>
        <div className="lg:max-h-[36rem] lg:overflow-y-auto lg:pr-1">
          <DaftarRuang items={ruangList} onPilih={(r) => setRuangId(r.id)} dipilihId={ruangId} saring={false} />
        </div>
      </div>
      <Card>
        <CardHeader className="flex flex-col gap-2 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">Peserta Ruang {ruang?.nama_ruang}</CardTitle>
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
              {ruang?.jenjang.map((j) => <BadgeJenjang key={j} jenjang={j} jumlah={items.filter((p) => p.jenjang === j).length} />)}
              <span>{items.length}/{ruang?.kapasitas} kursi terisi</span>
            </p>
          </div>
          {bolehUbah && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setTemplate({ ujian, ruang, peserta: items })} disabled={!items.length} className="gap-1" data-testid="btn-template-peserta">
                <FileSpreadsheet className="h-4 w-4" /> Template
              </Button>
              <Button size="sm" variant="outline" onClick={() => setImpor({ ujianId, ruang })} className="gap-1" data-testid="btn-impor-peserta-buka">
                <FileUp className="h-4 w-4" /> Impor
              </Button>
              <Button size="sm" variant="outline" onClick={() => setAturNomor({ ruang, peserta: items })} disabled={!items.length} className="gap-1" data-testid="btn-atur-nomor">
                <Hash className="h-4 w-4" /> Nomor Peserta
              </Button>
              <Button size="sm" onClick={() => setTambah(ruang)} disabled={sisa === 0} className="gap-1 bg-[#006837] hover:bg-[#00552d]" data-testid="btn-tambah-peserta">
                <UserPlus className="h-4 w-4" /> {sisa === 0 ? 'Ruang penuh' : 'Tambah Peserta'}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {memuat && !data ? (
            <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#006837]" /></div>
          ) : items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center" data-testid="peserta-ruang-kosong">
              <p className="text-sm font-medium text-slate-700">Ruang {ruang?.nama_ruang} belum berisi peserta</p>
              <p className="mt-1 text-xs text-slate-500">
                {bolehUbah ? 'Klik "Tambah Peserta" untuk memilih siswa per kelas, atau impor template .xlsx ruang ini.' : 'Admin belum menempatkan siswa di ruang ini.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="tabel-peserta-ruang">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-2 font-semibold">No</th>
                    <th className="py-2 pr-2 font-semibold">No. Peserta</th>
                    <th className="py-2 pr-2 font-semibold">Nama</th>
                    <th className="py-2 pr-2 font-semibold">Kelas</th>
                    {bolehUbah && <th className="py-2 font-semibold"><span className="sr-only">Aksi</span></th>}
                  </tr>
                </thead>
                <tbody>
                  {items.map((p, i) => (
                    <tr key={p.id} className="border-b border-slate-100 last:border-0" data-testid={`peserta-${p.id}`}>
                      <td className="py-2 pr-2 text-slate-500">{i + 1}</td>
                      <td className="py-2 pr-2 font-mono text-xs">{p.nomor_peserta || <span className="font-sans text-amber-700">Belum ada</span>}</td>
                      <td className="py-2 pr-2">
                        <div className="text-slate-900">{p.nama}</div>
                        {p.nis && <div className="text-xs text-slate-500">NIS {p.nis}</div>}
                      </td>
                      <td className="py-2 pr-2">{p.kelas}</td>
                      {bolehUbah && (
                        <td className="whitespace-nowrap py-2 text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPindah({ peserta: p, ruangAsal: ruang })} aria-label={`Pindahkan ${p.nama} ke ruang lain`} data-testid={`btn-pindah-${p.id}`}>
                            <ArrowRightLeft className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600 hover:bg-rose-50" onClick={() => keluarkan(p)} aria-label={`Keluarkan ${p.nama}`}>
                            <UserMinus className="h-4 w-4" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      <TemplatePesertaDialog sasaran={template} onTutup={() => setTemplate(null)} />
      <ImporPesertaDialog sasaran={impor} onTutup={() => setImpor(null)} onSelesai={() => { muat(); onBerubah?.(); }} />
      <NomorPesertaDialog ujianId={ujianId} sasaran={aturNomor} nomorLain={data?.nomor_lain || {}} onTutup={() => setAturNomor(null)}
        onTersimpan={({ tutup }) => { if (tutup) setAturNomor(null); muat(); }} />
      <PindahRuangDialog ujianId={ujianId} sasaran={pindah} ruangList={ruangList} onTutup={() => setPindah(null)}
        onTersimpan={() => { setPindah(null); muat(); onBerubah?.(); }} />
      <PilihSiswaDialog ujianId={ujianId} ruang={tambah} sisaKapasitas={sisa} onTutup={() => setTambah(null)}
        onTersimpan={() => { setTambah(null); muat(); onBerubah?.(); }} />
    </div>
  );
}
