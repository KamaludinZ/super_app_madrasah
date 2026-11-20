import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, DoorClosed, FileCheck2, Loader2, RotateCcw, Send } from 'lucide-react';
import KerangkaPublik, { Langkah, PesanPublik, teksSesi } from '@/components/ujian/publik/KerangkaPublik';
import KolomTandaTangan from '@/components/ujian/publik/KolomTandaTangan';
import BlokirSyaratDaftarHadir, { DaftarRekapBa } from '@/components/ujian/publik/BlokirSyaratDaftarHadir';
import RiwayatBeritaAcara from '@/components/ujian/publik/RiwayatBeritaAcara';
import { FormulirTertutup, TautanTidakValid } from '@/components/ujian/publik/StatusTertutup';
import { formatWIB } from '@/lib/datetime';
import {
  CATATAN_BA_MAKS, galatBeritaAcara, kirimBeritaAcara, muatInfoPublik, muatPengawasPublik, muatRekapBa, pesanGalatPublik,
} from '@/lib/ujianPublik';

const JUDUL = 'Berita Acara Pengawas Ujian';

/**
 * Berita acara pengawas lewat tautan publik /publik/ujian/:token/berita-acara (tanpa login).
 * Alur: pilih ruangan -> pilih nama pengawas (master guru pengawas) -> lihat jumlah hadir & tidak hadir yang terisi
 * otomatis dari daftar hadir -> catatan -> tanda tangan -> kirim. Hanya bisa diisi bila daftar hadir ruang itu lengkap.
 */
export default function PublikBeritaAcaraPage() {
  const { token } = useParams();
  const [info, setInfo] = useState(null);
  const [galat, setGalat] = useState('');
  const [memuatInfo, setMemuatInfo] = useState(false);
  const [pengawasList, setPengawasList] = useState([]);
  const [ruang, setRuang] = useState(null);
  const [rekap, setRekap] = useState(null);
  const [pengawasId, setPengawasId] = useState('');
  const [catatan, setCatatan] = useState('');
  const [ttd, setTtd] = useState(null);
  const [mengirim, setMengirim] = useState(false);
  const [selesai, setSelesai] = useState(null);
  const ttdRef = useRef(null);
  const [segarkan, setSegarkan] = useState(0);

  const muatInfo = useCallback(() => {
    setMemuatInfo(true);
    return muatInfoPublik(token).then(setInfo)
      .catch((e) => setGalat(pesanGalatPublik(e, 'Tautan berita acara tidak ditemukan atau sudah tidak berlaku.')))
      .finally(() => setMemuatInfo(false));
  }, [token]);
  useEffect(() => { muatInfo(); }, [muatInfo]);
  useEffect(() => { muatPengawasPublik(token).then((h) => setPengawasList(h.items)).catch(() => {}); }, [token]);

  const [memuatRekap, setMemuatRekap] = useState(false);
  const pilihRuang = async (r) => {
    if (r.id !== ruang?.id) { setRekap(null); setTtd(null); }
    setRuang(r);
    setMemuatRekap(true);
    try {
      setRekap(await muatRekapBa(token, r.id, info?.sesi?.id));
    } catch (e) {
      toast.error(pesanGalatPublik(e, 'Gagal memuat rekap daftar hadir ruang.'));
    } finally {
      setMemuatRekap(false);
    }
  };

  const [tampilGalat, setTampilGalat] = useState(false);
  const isian = { sesi_id: info?.sesi?.id || '', ruang_id: ruang?.id || '', pengawas_id: pengawasId, catatan: catatan.trim(), ttd_png: ttd || '' };
  const galatIsian = galatBeritaAcara(isian);

  const kirim = async () => {
    if (Object.keys(galatIsian).length) { setTampilGalat(true); toast.error(Object.values(galatIsian)[0]); return; }
    if (mengirim) return;
    setMengirim(true);
    try {
      setSelesai(await kirimBeritaAcara(token, isian));
    } catch (e) {
      toast.error(pesanGalatPublik(e, 'Gagal mengirim berita acara. Periksa koneksi lalu coba lagi.'));
      if (e?.response?.status === 409 || e?.response?.status === 403) pilihRuang(ruang);
    } finally {
      setMengirim(false);
    }
  };

  if (galat) return <KerangkaPublik judul={JUDUL}><TautanTidakValid pesan={galat} /></KerangkaPublik>;
  if (!info) return <KerangkaPublik judul={JUDUL}><div className="py-16 text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin text-[#006837]" /></div></KerangkaPublik>;
  if (selesai) {
    const ulang = () => { setSelesai(null); setRuang(null); setRekap(null); setPengawasId(''); setCatatan(''); setTtd(null); setSegarkan((n) => n + 1); };
    return (
      <KerangkaPublik info={info} judul={JUDUL}>
        <PesanPublik Ikon={CheckCircle2} warna="text-[#006837]" judul="Berita acara tersimpan">
          <p>Ruang <strong>{selesai.ruang}</strong> · {selesai.pengawas_nama}</p>
          <p className="mt-1 text-xs text-slate-500">{teksSesi(selesai.sesi)} · terkirim {formatWIB(selesai.waktu_kirim, 'Time', { hour: '2-digit', minute: '2-digit' })} WIB</p>
        </PesanPublik>
        {selesai.rekap?.length > 0 && (
          <section className="space-y-2" data-testid="ba-ringkasan-kiriman">
            <h2 className="text-sm font-bold text-slate-900">Rekap yang tercatat</h2>
            <DaftarRekapBa rekap={selesai.rekap} />
          </section>
        )}
        <RiwayatBeritaAcara token={token} ruangList={info.ruang} sesi={info.sesi} segarkan={segarkan} />
        <Button variant="outline" onClick={ulang} className="w-full gap-2" data-testid="ba-isi-lagi"><RotateCcw className="h-4 w-4" /> Isi berita acara ruang lain</Button>
      </KerangkaPublik>
    );
  }

  const tertutup = !info.formulir?.terbuka || !info.sesi;
  const pengawas = pengawasList.find((p) => p.id === pengawasId);

  return (
    <KerangkaPublik info={info} judul={JUDUL}>
      {info.tiruan && <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" data-testid="info-tiruan-ba">Server belum siap — menampilkan data contoh.</p>}
      {tertutup ? (
        <FormulirTertutup formulir={info.formulir} ujian={info.ujian} tanpaSesi={!info.sesi} onMuatUlang={muatInfo} memuat={memuatInfo} />
      ) : (
        <>
          <Langkah nomor={1} judul="Pilih ruangan" selesai={!!ruang}>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" role="group" aria-label="Ruangan">
              {info.ruang.map((r) => (
                <button key={r.id} type="button" onClick={() => pilihRuang(r)} aria-pressed={ruang?.id === r.id}
                  className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006837] ${
                    ruang?.id === r.id ? 'border-[#006837] bg-emerald-50 font-semibold text-[#006837]' : 'border-slate-200 hover:border-[#006837]/40'}`}
                  data-testid={`ba-ruang-${r.id}`}>
                  <DoorClosed className="h-5 w-5" /> Ruang {r.nama_ruang}
                  <span className="text-[11px] font-normal text-slate-500">Kelas {r.jenjang.join(' + ')}</span>
                </button>
              ))}
            </div>
          </Langkah>

          {ruang && !rekap && <div className="py-6 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-[#006837]" /></div>}
          {rekap?.sudah_diisi && (
            <PesanPublik Ikon={FileCheck2} warna="text-[#006837]" judul={`Berita acara Ruang ${ruang?.nama_ruang} sudah diisi`}>
              <p>{rekap.sudah_diisi.pengawas_nama} · {formatWIB(rekap.sudah_diisi.waktu_kirim, 'Time', { hour: '2-digit', minute: '2-digit' })} WIB</p>
              <p className="mt-1 text-xs text-slate-500">Satu berita acara per ruang per sesi. Hubungi panitia bila perlu diperbaiki.</p>
            </PesanPublik>
          )}
          {rekap && !rekap.sudah_diisi && !rekap.kelengkapan?.lengkap && (
            <BlokirSyaratDaftarHadir ruang={ruang} kelengkapan={rekap.kelengkapan} rekap={rekap.rekap}
              onPeriksaLagi={() => pilihRuang(ruang)} memuat={memuatRekap} />
          )}
          {rekap && !rekap.sudah_diisi && rekap.kelengkapan?.lengkap && (
            <>
              <Langkah nomor={2} judul="Pilih nama pengawas" selesai={!!pengawasId}>
                <label htmlFor="pilih-pengawas" className="sr-only">Nama pengawas</label>
                <select id="pilih-pengawas" value={pengawasId} onChange={(e) => setPengawasId(e.target.value)} aria-invalid={tampilGalat && !!galatIsian.pengawas_id}
                  className={`h-12 w-full rounded-md border bg-white px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006837] ${tampilGalat && galatIsian.pengawas_id ? 'border-red-500' : 'border-slate-200'}`} data-testid="ba-pilih-pengawas">
                  <option value="">Pilih nama Anda…</option>
                  {pengawasList.map((p) => <option key={p.id} value={p.id}>{p.nama}</option>)}
                </select>
                {tampilGalat && galatIsian.pengawas_id && <p className="mt-1 text-xs text-red-600" role="alert">{galatIsian.pengawas_id}</p>}
                {pengawasList.length === 0 && <p className="mt-1 text-xs text-amber-700">Belum ada guru pengawas terdaftar. Hubungi panitia.</p>}
              </Langkah>
              <Langkah nomor={3} judul="Rekap kehadiran" keterangan="Terisi otomatis dari daftar hadir peserta sesi ini — tidak diisi manual.">
                <DaftarRekapBa rekap={rekap.rekap} />
              </Langkah>
              <Langkah nomor={4} judul="Catatan selama pelaksanaan">
                <Label htmlFor="ba-catatan" className="sr-only">Catatan</Label>
                <Textarea id="ba-catatan" rows={4} maxLength={CATATAN_BA_MAKS} value={catatan} onChange={(e) => setCatatan(e.target.value)}
                  placeholder="Mis. Ujian berjalan tertib; satu peserta terlambat 10 menit." data-testid="ba-catatan" />
                <p className={`mt-1 text-xs ${galatIsian.catatan ? 'text-red-600' : 'text-slate-500'}`}>{galatIsian.catatan || `${catatan.length}/${CATATAN_BA_MAKS} karakter · boleh dikosongkan bila tidak ada catatan.`}</p>
              </Langkah>
              <Langkah nomor={5} judul="Tanda tangan pengawas">
                <KolomTandaTangan ref={ttdRef} onUbah={setTtd} nama={pengawas?.nama || 'Nama Pengawas'} jenis="berita_acara" />
                {tampilGalat && galatIsian.ttd_png && <p className="mt-1 text-xs text-red-600" role="alert">{galatIsian.ttd_png}</p>}
                <Button onClick={kirim} disabled={mengirim} className="mt-3 h-12 w-full gap-2 bg-[#006837] text-base hover:bg-[#005830]" data-testid="ba-kirim">
                  {mengirim ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />} Kirim Berita Acara
                </Button>
              </Langkah>
            </>
          )}
          <RiwayatBeritaAcara token={token} ruangList={info.ruang} sesi={info.sesi} segarkan={segarkan} />
        </>
      )}
    </KerangkaPublik>
  );
}
