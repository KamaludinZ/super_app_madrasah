import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, FileText, Loader2, Printer } from 'lucide-react';
import { formatWIB } from '@/lib/datetime';
import { pesanGalat } from '@/lib/ujian';
import { simpanBerkas } from '@/lib/ujianPeserta';
import { FORMAT_CETAK, JENIS_DOKUMEN, cetakDokumen, muatKesiapanCetak, pratinjauDokumen } from '@/lib/ujianCetak';
import PratinjauDokumenDialog from '@/components/ujian/PratinjauDokumenDialog';
import PemilihRuangJenjang from '@/components/ujian/PemilihRuangJenjang';

export const labelSesi = (s) => (s ? `${formatWIB(s.tanggal, 'Date', { weekday: 'short', day: 'numeric', month: 'short' })} · Sesi ${s.sesi_ke} · ${s.jam_mulai}–${s.jam_selesai}` : '');

function Pilih({ id, label, value, onChange, children, testid }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} data-testid={testid}
        className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006837]">
        {children}
      </select>
    </div>
  );
}

/**
 * Panel Cetak Dokumen: pilih ruang -> jenjang (hanya jenjang ruang itu) -> sesi -> format, lalu cetak Daftar Hadir atau
 * Berita Acara untuk satu jenjang pada satu ruang. Hasil cetak diunduh & tersimpan otomatis di arsip.
 */
export default function PanelCetakDokumen({ ujian, pilihan }) {
  const [ruangId, setRuangId] = useState('');
  const [jenjang, setJenjang] = useState('');
  const [sesiId, setSesiId] = useState('');
  const [format, setFormat] = useState('pdf');
  const [proses, setProses] = useState(null);

  const ruang = useMemo(() => pilihan.ruang.find((r) => r.id === ruangId) || pilihan.ruang[0], [pilihan, ruangId]);
  useEffect(() => { if (ruang && !ruang.jenjang.includes(Number(jenjang))) setJenjang(String(ruang.jenjang[0] ?? '')); }, [ruang, jenjang]);
  useEffect(() => { if (!pilihan.sesi.some((s) => s.id === sesiId)) setSesiId(pilihan.sesi[0]?.id || ''); }, [pilihan, sesiId]);
  const sesi = pilihan.sesi.find((s) => s.id === sesiId);
  const [kesiapan, setKesiapan] = useState({});
  useEffect(() => {
    if (!sesiId || !ujian) return undefined;
    let hidup = true;
    muatKesiapanCetak(ujian.id, sesiId)
      .then((h) => { if (hidup) setKesiapan(Object.fromEntries(h.items.map((i) => [`${i.ruang_id}:${i.jenjang}`, i]))); })
      .catch(() => { if (hidup) setKesiapan({}); });
    return () => { hidup = false; };
  }, [ujian, sesiId]);
  const siap = kesiapan[`${ruang?.id}:${jenjang}`];

  const [pratinjau, setPratinjau] = useState(null);
  const isiCetak = (jenis) => ({ jenis, ruang_id: ruang.id, nama_ruang: ruang.nama_ruang, jenjang: Number(jenjang), sesi_id: sesiId, sesi_label: labelSesi(sesi), format });

  const lihat = async (jenis) => {
    setProses(`lihat-${jenis}`);
    try {
      const h = await pratinjauDokumen(ujian.id, isiCetak(jenis));
      setPratinjau({ jenis, blob: h.blob, mesin: h.mesin, judul: `${JENIS_DOKUMEN[jenis].label} · Ruang ${ruang.nama_ruang} · Kelas ${jenjang}` });
    } catch (e) {
      toast.error(pesanGalat(e, 'Gagal membuat pratinjau.'));
    } finally {
      setProses(null);
    }
  };

  const cetak = async (jenis) => {
    setProses(jenis);
    try {
      const h = await cetakDokumen(ujian.id, isiCetak(jenis));
      setPratinjau(null);
      simpanBerkas(h.blob, h.nama);
      toast.success(`${JENIS_DOKUMEN[jenis].label} Ruang ${ruang.nama_ruang} kelas ${jenjang} diunduh${h.tiruan ? ' (contoh)' : ' dan tersimpan di arsip'}`);
    } catch (e) {
      toast.error(pesanGalat(e, 'Gagal mencetak dokumen.'));
    } finally {
      setProses(null);
    }
  };

  if (!pilihan.ruang.length || !pilihan.sesi.length) {
    return (
      <Card><CardContent className="p-6 text-center text-sm text-slate-500">
        {!pilihan.ruang.length ? 'Belum ada ruang ujian.' : 'Belum ada jadwal sesi. Atur jadwal di Pengaturan Formulir.'}
      </CardContent></Card>
    );
  }

  return (
    <Card data-testid="panel-cetak">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4 text-[#006837]" /> Cetak per Jenjang per Ruang</CardTitle>
        <p className="text-xs text-slate-500">
          Mesin cetak: {pilihan.mesin?.identik ? 'LibreOffice — hasil identik dengan template madrasah' : 'ReportLab (cadangan) — tata letak meniru template'}.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Pilih id="cetak-sesi" label="Sesi" value={sesiId} onChange={setSesiId} testid="cetak-pilih-sesi">
            {pilihan.sesi.map((s) => <option key={s.id} value={s.id}>{labelSesi(s)}</option>)}
          </Pilih>
          <Pilih id="cetak-format" label="Format" value={format} onChange={setFormat} testid="cetak-pilih-format">
            {Object.entries(FORMAT_CETAK).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Pilih>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ruang & jenjang</p>
          <PemilihRuangJenjang ruangList={pilihan.ruang} kesiapan={kesiapan} nilai={`${ruang?.id}:${jenjang}`}
            onPilih={(r, j) => { setRuangId(r.id); setJenjang(String(j)); }} />
        </div>
        {sesi?.mapel?.[jenjang] && <p className="text-xs text-slate-500">Mata pelajaran kelas {jenjang} pada sesi ini: <strong>{sesi.mapel[jenjang]}</strong></p>}
        {siap && !siap.dh_lengkap && (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Daftar hadir belum lengkap ({siap.belum} peserta) — dokumen tetap dapat dicetak; baris yang belum terisi dicetak kosong.
          </p>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Object.entries(JENIS_DOKUMEN).map(([jenis, j]) => (
            <div key={jenis} className="flex gap-2 rounded-xl border border-slate-200 p-2">
              <Button variant="outline" onClick={() => lihat(jenis)} disabled={!!proses || !jenjang} className="h-11 flex-1 gap-2" data-testid={`btn-pratinjau-${jenis}`}>
                {proses === `lihat-${jenis}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />} Pratinjau
              </Button>
              <Button onClick={() => cetak(jenis)} disabled={!!proses || !jenjang} className="h-11 flex-[2] gap-2 bg-[#006837] hover:bg-[#00552d]" data-testid={`btn-cetak-${jenis}`}>
                {proses === jenis ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />} Cetak {j.singkat}
              </Button>
            </div>
          ))}
        </div>
        <PratinjauDokumenDialog pratinjau={pratinjau} onTutup={() => setPratinjau(null)} mencetak={proses === pratinjau?.jenis}
          onCetak={() => cetak(pratinjau.jenis)} />
      </CardContent>
    </Card>
  );
}
