import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Loader2, RotateCcw, Send } from 'lucide-react';
import KolomTandaTangan from '@/components/ujian/publik/KolomTandaTangan';
import KerangkaPublik, { Langkah, PesanPublik, teksSesi } from '@/components/ujian/publik/KerangkaPublik';
import PemilihPesertaBertingkat from '@/components/ujian/publik/PemilihPesertaBertingkat';
import { FormulirTertutup, TautanTidakValid } from '@/components/ujian/publik/StatusTertutup';
import PenolakanGanda from '@/components/ujian/publik/PenolakanGanda';
import { formatWIB } from '@/lib/datetime';
import {
  galatDaftarHadir, jenisGalatKirim, kirimDaftarHadir, muatInfoPublik, muatPesertaPublik, pesanGalatPublik, rincianKirimanGanda,
} from '@/lib/ujianPublik';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const JUDUL = 'Daftar Hadir Peserta Ujian';

/**
 * Daftar hadir peserta ujian lewat tautan publik /publik/ujian/:token/daftar-hadir (tanpa login).
 * Alur: pilih ruangan -> kelas -> nama (dari daftar peserta ruang itu) -> tanda tangan PNG -> kirim. Satu nama hanya
 * sekali per sesi; formulir hanya terbuka pada masa ujian di jendela jam yang diatur panitia.
 */
export default function PublikDaftarHadirPage() {
  const { token } = useParams();
  const [info, setInfo] = useState(null);
  const [galat, setGalat] = useState('');
  const [ruang, setRuang] = useState(null);
  const [peserta, setPeserta] = useState(null);
  const [segarkan, setSegarkan] = useState(0);
  const [ttd, setTtd] = useState(null);
  const [mengirim, setMengirim] = useState(false);
  const [selesai, setSelesai] = useState(null);
  const padRef = useRef(null);

  const [memuatInfo, setMemuatInfo] = useState(false);
  const muatInfo = useCallback(() => {
    setMemuatInfo(true);
    return muatInfoPublik(token).then(setInfo)
      .catch((e) => setGalat(pesanGalatPublik(e, 'Tautan daftar hadir tidak ditemukan atau sudah tidak berlaku.')))
      .finally(() => setMemuatInfo(false));
  }, [token]);
  useEffect(() => { muatInfo(); }, [muatInfo]);

  const muatPeserta = useCallback(async (r) => {
    try {
      return await muatPesertaPublik(token, r.id, info?.sesi?.id);
    } catch (e) {
      toast.error(pesanGalatPublik(e, 'Gagal memuat daftar peserta ruang.'));
      return { kelas: [], peserta: [] };
    }
  }, [token, info]);

  const [konfirmasi, setKonfirmasi] = useState(false);
  const [ganda, setGanda] = useState(null);
  const isian = { sesi_id: info?.sesi?.id || '', ruang_id: ruang?.id || '', peserta_id: peserta?.id || '', ttd_png: ttd || '' };
  const galatIsian = galatDaftarHadir(isian);

  const kirim = async () => {
    const pesan = galatDaftarHadir(isian);
    if (pesan) { toast.error(pesan); return; }
    if (mengirim) return; // cegah kirim ganda
    setMengirim(true);
    try {
      setSelesai(await kirimDaftarHadir(token, isian));
    } catch (e) {
      const jenis = jenisGalatKirim(e);
      if (jenis === 'sudah') {
        setGanda(rincianKirimanGanda(e));
        setPeserta(null); setTtd(null); setSegarkan((n) => n + 1);
        return;
      }
      toast.error(pesanGalatPublik(e, jenis === 'koneksi'
        ? 'Tidak ada koneksi ke server. Data belum terkirim — periksa sinyal lalu tekan Kirim lagi.'
        : 'Gagal mengirim daftar hadir. Coba lagi.'));
      if (jenis === 'tertutup') muatInfo();
    } finally {
      setMengirim(false);
      setKonfirmasi(false);
    }
  };

  const ulang = () => { setSelesai(null); setPeserta(null); setRuang(null); setTtd(null); setSegarkan((n) => n + 1); };

  if (galat) {
    return <KerangkaPublik judul={JUDUL}><TautanTidakValid pesan={galat} /></KerangkaPublik>;
  }
  if (!info) {
    return <KerangkaPublik judul={JUDUL}><div className="py-16 text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin text-[#006837]" /></div></KerangkaPublik>;
  }
  if (selesai) {
    return (
      <KerangkaPublik info={info} judul={JUDUL}>
        <PesanPublik Ikon={CheckCircle2} warna="text-[#006837]" judul="Kehadiran tercatat">
          <p><strong>{selesai.nama}</strong> ({selesai.kelas}) · No. Peserta <strong>{selesai.nomor_peserta || '-'}</strong> · Ruang {selesai.ruang}</p>
          <p className="mt-1 text-xs text-slate-500">{teksSesi(selesai.sesi)} · terkirim {formatWIB(selesai.waktu_kirim, 'Time', { hour: '2-digit', minute: '2-digit' })} WIB</p>
        </PesanPublik>
        <Button variant="outline" onClick={ulang} className="w-full gap-2" data-testid="dh-isi-lagi"><RotateCcw className="h-4 w-4" /> Isi untuk peserta lain</Button>
      </KerangkaPublik>
    );
  }

  const tertutup = !info.formulir?.terbuka || !info.sesi;

  return (
    <KerangkaPublik info={info} judul={JUDUL}>
      {info.tiruan && <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" data-testid="info-tiruan-dh">Server belum siap — menampilkan data contoh.</p>}
      {tertutup ? (
        <FormulirTertutup formulir={info.formulir} ujian={info.ujian} tanpaSesi={!info.sesi} onMuatUlang={muatInfo} memuat={memuatInfo} />
      ) : (
        <>
          <PenolakanGanda rincian={ganda} onPilihLain={() => { setGanda(null); window.scrollTo({ top: 0 }); }} />
          <PemilihPesertaBertingkat ruangList={info.ruang} muatPeserta={muatPeserta} segarkan={segarkan}
            onPilih={(p, pilihan) => { setPeserta(p); setRuang(pilihan.ruang || null); setTtd(null); if (p) setGanda(null); }} />

          {peserta && (
            <Langkah nomor={4} judul="Tanda tangan" keterangan={`${peserta.nama} · No. Peserta ${peserta.nomor_peserta || '-'} · Ruang ${ruang.nama_ruang}`}>
              <KolomTandaTangan ref={padRef} onUbah={setTtd} nomor={peserta.nomor_peserta} nama={peserta.nama} />
              <Button onClick={() => setKonfirmasi(true)} disabled={!!galatIsian || mengirim} className="mt-3 h-12 w-full gap-2 bg-[#006837] text-base hover:bg-[#005830]" data-testid="dh-kirim">
                {mengirim ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />} Kirim Daftar Hadir
              </Button>
              <p className="mt-2 text-center text-xs text-slate-500" aria-live="polite">
                {galatIsian && ttd === null ? 'Goreskan tanda tangan untuk mengaktifkan tombol kirim.' : 'Setiap nama hanya dapat mengirim sekali pada sesi ini.'}
              </p>
              <AlertDialog open={konfirmasi} onOpenChange={(o) => { if (!mengirim) setKonfirmasi(o); }}>
                <AlertDialogContent data-testid="dh-konfirmasi">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Kirim daftar hadir?</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="space-y-1 text-sm text-slate-600">
                        <p>Pastikan nama Anda benar. Setelah terkirim, nama ini tidak dapat mengisi lagi pada sesi ini.</p>
                        <p className="rounded-lg bg-slate-50 p-2 text-slate-800"><strong>{peserta.nama}</strong> · {peserta.kelas} · No. Peserta {peserta.nomor_peserta || '-'} · Ruang {ruang?.nama_ruang}</p>
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={mengirim}>Periksa lagi</AlertDialogCancel>
                    <AlertDialogAction onClick={(e) => { e.preventDefault(); kirim(); }} disabled={mengirim} className="gap-2 bg-[#006837] hover:bg-[#005830]" data-testid="dh-konfirmasi-kirim">
                      {mengirim ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Ya, kirim
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </Langkah>
          )}
        </>
      )}
    </KerangkaPublik>
  );
}
