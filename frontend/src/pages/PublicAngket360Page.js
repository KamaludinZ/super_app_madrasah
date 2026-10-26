import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import {
  AlertTriangle, Check, CheckCircle2, ChevronsUpDown, ClipboardList, GraduationCap, HeartHandshake, Loader2, Lock, Send,
  UsersRound,
} from 'lucide-react';
import { toast } from 'sonner';
import PadTandaTangan from '@/components/pkg/PadTandaTangan';
import { SKOR_ANGKET, ambilAngketPublik, kirimAngketPublik } from '@/lib/pkgAngket';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

const INFO_JENIS = {
  sejawat: { Ikon: UsersRound, keterangan: 'Untuk rekan guru' },
  siswa: { Ikon: GraduationCap, keterangan: 'Untuk siswa yang diajar' },
  ortu: { Ikon: HeartHandshake, keterangan: 'Untuk orang tua/wali siswa' },
};

function Langkah({ nomor, judul, keterangan, children, id }) {
  return (
    <section id={id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#006837] text-sm font-bold text-white">{nomor}</span>
        <div className="min-w-0">
          <h2 className="text-base font-bold text-slate-900">{judul}</h2>
          {keterangan && <p className="text-sm text-slate-500">{keterangan}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

// Dropdown guru yang dinilai dengan pencarian; angka di kanan = responden jenis terpilih yang sudah mengisi.
function PilihGuru({ guru, jenis, maks, value, onPilih, disabled }) {
  const [buka, setBuka] = useState(false);
  const terpilih = guru.find((g) => g.id === value);
  const jumlah = (g) => g.jumlah?.[jenis] || 0;
  return (
    <Popover open={buka} onOpenChange={setBuka}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={buka} disabled={disabled}
          className="h-12 w-full min-w-0 justify-between text-left font-normal" data-testid="angket-pilih-guru">
          {terpilih ? (
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <span className="truncate text-slate-900">{terpilih.nama}</span>
              <span className="shrink-0 rounded bg-emerald-50 px-1.5 text-xs font-semibold tabular-nums text-emerald-700">{jumlah(terpilih)}/{maks}</span>
            </span>
          ) : (
            <span className="truncate text-slate-500">{disabled ? 'Pilih jenis angket terlebih dahulu' : 'Cari & pilih nama guru…'}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[18rem] p-0" align="start">
        <Command filter={(val, cari) => (val.toLowerCase().includes(cari.toLowerCase().trim()) ? 1 : 0)}>
          <CommandInput placeholder="Ketik nama guru…" />
          <CommandList className="max-h-72">
            <CommandEmpty>Nama guru tidak ditemukan.</CommandEmpty>
            <CommandGroup heading={`Jumlah responden yang sudah mengisi (maks. ${maks})`}>
              {guru.map((g) => {
                const penuh = jumlah(g) >= maks;
                return (
                  <CommandItem key={g.id} value={`${g.nama} ${g.mapel || ''} ${g.id}`} disabled={penuh}
                    onSelect={() => { if (!penuh) { onPilih(g.id); setBuka(false); } }} data-testid={`angket-guru-${g.id}`}>
                    <Check className={`mr-2 h-4 w-4 shrink-0 ${value === g.id ? 'opacity-100' : 'opacity-0'}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{g.nama}</span>
                      {g.mapel && <span className="block truncate text-xs text-slate-500">{g.mapel}</span>}
                    </span>
                    <span className={`ml-2 shrink-0 rounded px-1.5 text-xs font-semibold tabular-nums ${
                      penuh ? 'bg-slate-100 text-slate-500' : jumlah(g) ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}
                      title={`${jumlah(g)} responden sudah mengisi`}>
                      {penuh ? 'Penuh' : `${jumlah(g)}/${maks}`}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function ButirAngket({ butir, jawaban, onJawab, tandai }) {
  let komponen = null;
  return (
    <div className="space-y-2">
      {butir.map((b, i) => {
        const judul = b.komponen !== komponen ? (komponen = b.komponen) : null;
        const kosong = tandai && jawaban[i] == null;
        return (
          <React.Fragment key={b.no}>
            {judul && <h3 className="pt-3 text-xs font-bold uppercase tracking-wide text-[#006837]">{judul}</h3>}
            <div id={`butir-${b.no}`} className={`rounded-xl border p-3 transition-colors ${kosong ? 'border-rose-300 bg-rose-50/40' : 'border-slate-200'}`}>
              <p className="text-sm leading-relaxed text-slate-800"><span className="mr-1.5 font-semibold tabular-nums text-slate-400">{b.no}.</span>{b.pernyataan}</p>
              <div className="mt-2.5 grid grid-cols-3 gap-1.5" role="radiogroup" aria-label={`Skor butir ${b.no}`}>
                {SKOR_ANGKET.map((s) => {
                  const pilih = jawaban[i] === s.nilai;
                  return (
                    <button key={s.nilai} type="button" role="radio" aria-checked={pilih} onClick={() => onJawab(i, s.nilai)}
                      title={s.keterangan} data-testid={`angket-butir-${b.no}-${s.nilai}`}
                      className={`flex min-h-[44px] flex-col items-center justify-center rounded-lg border px-1 py-1.5 text-center transition ${
                        pilih ? 'border-[#006837] bg-[#006837] text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-[#006837]/50'}`}>
                      <span className="text-sm font-bold tabular-nums">{s.nilai}</span>
                      <span className={`text-[11px] leading-tight ${pilih ? 'text-white/90' : 'text-slate-500'}`}>{s.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

function Kerangka({ settings, periode, children }) {
  return (
    <div className="min-h-screen bg-[#FBF7EE]">
      <header className="border-b border-emerald-900/10 bg-[#006837] text-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          {settings?.logo_url && <img src={settings.logo_url} alt="" className="h-10 w-10 shrink-0 rounded bg-white/95 object-contain p-0.5" />}
          <div className="min-w-0">
            <div className="truncate text-xs font-medium text-emerald-100">{settings?.school_name || 'Madrasah'}</div>
            <h1 className="text-base font-bold leading-tight sm:text-lg">Angket Penilaian Kinerja Guru 360°</h1>
            {periode && (
              <div className="truncate text-xs text-emerald-100">
                {[periode.nama_periode, periode.tahun_pelajaran && `TP ${periode.tahun_pelajaran}`, periode.semester && `Semester ${periode.semester}`].filter(Boolean).join(' · ')}
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-5 pb-16">{children}</main>
    </div>
  );
}

function Pesan({ Ikon, warna, judul, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <Ikon className={`mx-auto mb-3 h-10 w-10 ${warna}`} />
      <h2 className="text-lg font-bold text-slate-900">{judul}</h2>
      <div className="mt-1 text-sm text-slate-600">{children}</div>
    </div>
  );
}

// Halaman publik angket 360° (tanpa login) dari tautan /public/angket-360/:token yang disalin di menu Komponen 360°.
// Langkah: jenis angket -> nama responden -> guru yang dinilai (dengan jumlah responden) -> butir angket -> tanda tangan.
export default function PublicAngket360Page() {
  const { token } = useParams();
  const [settings, setSettings] = useState(null);
  const [data, setData] = useState(null);
  const [galat, setGalat] = useState(null);
  const [jenis, setJenis] = useState(null);
  const [nama, setNama] = useState('');
  const [guruId, setGuruId] = useState(null);
  const [jawaban, setJawaban] = useState({}); // { jenis: [skor|null] }
  const [ttd, setTtd] = useState(null);
  const [tandai, setTandai] = useState(false);
  const [mengirim, setMengirim] = useState(false);
  const [selesai, setSelesai] = useState(null);

  const muat = () => ambilAngketPublik(token).then((d) => { setData(d); return d; });

  useEffect(() => {
    axios.get(`${BACKEND_URL}/api/public/settings`).then((r) => setSettings(r.data)).catch(() => {});
    muat().catch((e) => setGalat(e.message));
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { document.title = 'Angket Penilaian Kinerja Guru 360°'; }, []);

  const info = useMemo(() => data?.jenis.find((j) => j.jenis === jenis), [data, jenis]);
  const isian = (info && jawaban[jenis]) || (info ? info.butir.map(() => null) : []);
  const terisi = isian.filter((n) => n != null).length;
  const guru = data?.guru.find((g) => g.id === guruId);

  if (galat) {
    return (
      <Kerangka settings={settings}>
        <Pesan Ikon={AlertTriangle} warna="text-amber-600" judul="Tautan angket tidak dapat dibuka">{galat}</Pesan>
      </Kerangka>
    );
  }
  if (!data) {
    return <Kerangka settings={settings}><div className="py-16 text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin text-[#006837]" /></div></Kerangka>;
  }
  if (!data.terbuka) {
    return (
      <Kerangka settings={settings} periode={data.periode}>
        <Pesan Ikon={Lock} warna="text-slate-500" judul="Pengisian angket ditutup">{data.pesan}</Pesan>
      </Kerangka>
    );
  }

  const pilihJenis = (j) => {
    setJenis(j);
    setTandai(false);
    const g = data.guru.find((x) => x.id === guruId);
    if (g && (g.jumlah?.[j] || 0) >= data.maks_responden) setGuruId(null);
  };
  const jawab = (i, n) => setJawaban((s) => ({ ...s, [jenis]: isian.map((x, k) => (k === i ? n : x)) }));

  const kurang = [
    !jenis && 'jenis angket',
    nama.trim().length < 2 && 'nama responden',
    !guruId && 'guru yang dinilai',
    info && terisi < info.butir.length && `${info.butir.length - terisi} butir angket`,
    !ttd && 'tanda tangan',
  ].filter(Boolean);

  const kirim = async () => {
    setTandai(true);
    if (kurang.length) {
      toast.error(`Lengkapi dulu: ${kurang.join(', ')}.`);
      const sasaran = !jenis ? 'langkah-jenis' : nama.trim().length < 2 ? 'langkah-nama' : !guruId ? 'langkah-guru'
        : terisi < info.butir.length ? `butir-${info.butir[isian.findIndex((n) => n == null)].no}` : 'langkah-ttd';
      document.getElementById(sasaran)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setMengirim(true);
    try {
      const hasil = await kirimAngketPublik(token, { jenis, guruId, nama: nama.trim(), jawaban: isian, tandaTangan: ttd });
      setSelesai(hasil);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      muat().catch(() => {});
    } catch (e) {
      toast.error(e.message);
      muat().catch(() => {});
    } finally {
      setMengirim(false);
    }
  };

  // Isi lagi untuk guru lain: jenis & nama responden tetap, guru/jawaban/tanda tangan dikosongkan.
  const isiLagi = () => {
    setSelesai(null);
    setGuruId(null);
    setJawaban((s) => ({ ...s, [jenis]: undefined }));
    setTtd(null);
    setTandai(false);
    window.scrollTo({ top: 0 });
  };

  if (selesai) {
    return (
      <Kerangka settings={settings} periode={data.periode}>
        <Pesan Ikon={CheckCircle2} warna="text-[#006837]" judul="Terima kasih, angket terkirim">
          <p>Angket {selesai.label} untuk <strong>{selesai.guru_nama}</strong> sudah tersimpan.</p>
          <p className="mt-1 text-xs text-slate-500">Responden terisi: {selesai.jumlah_responden}/{selesai.maks_responden}</p>
          <Button onClick={isiLagi} className="mt-5 gap-1 bg-[#006837] hover:bg-[#005830]" data-testid="angket-isi-lagi">
            <ClipboardList className="h-4 w-4" /> Isi angket untuk guru lain
          </Button>
        </Pesan>
      </Kerangka>
    );
  }

  return (
    <Kerangka settings={settings} periode={data.periode}>
      <p className="rounded-xl border border-emerald-100 bg-white/70 p-3 text-sm text-slate-700">
        Berikan skor sesuai yang Anda amati: <strong>0</strong> = tidak ada bukti (tidak terpenuhi), <strong>1</strong> = terpenuhi sebagian,
        {' '}<strong>2</strong> = seluruhnya terpenuhi. Jawaban hanya dibaca kepala madrasah dan tim penilai kinerja guru.
      </p>

      <Langkah id="langkah-jenis" nomor={1} judul="Pilih jenis angket" keterangan="Sesuaikan dengan peran Anda terhadap guru yang dinilai.">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Jenis angket">
          {data.jenis.map((j) => {
            const { Ikon, keterangan } = INFO_JENIS[j.jenis] || { Ikon: ClipboardList };
            const pilih = jenis === j.jenis;
            return (
              <button key={j.jenis} type="button" role="radio" aria-checked={pilih} onClick={() => pilihJenis(j.jenis)}
                data-testid={`angket-jenis-${j.jenis}`}
                className={`flex items-center gap-3 rounded-xl border-2 p-3 text-left transition sm:flex-col sm:items-start ${
                  pilih ? 'border-[#006837] bg-emerald-50' : tandai && !jenis ? 'border-rose-300' : 'border-slate-200 hover:border-[#006837]/40'}`}>
                <Ikon className={`h-6 w-6 shrink-0 ${pilih ? 'text-[#006837]' : 'text-slate-400'}`} />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-900">{j.label}</span>
                  <span className="block text-xs text-slate-500">{keterangan} · {j.jumlah_butir} butir</span>
                </span>
              </button>
            );
          })}
        </div>
      </Langkah>

      <Langkah id="langkah-nama" nomor={2} judul="Nama responden">
        <Input value={nama} onChange={(e) => setNama(e.target.value)} maxLength={120} autoComplete="name"
          placeholder={jenis === 'siswa' ? 'Nama lengkap & kelas, mis. Ahmad Fauzi (8B)' : 'Nama lengkap Anda'}
          aria-invalid={tandai && nama.trim().length < 2} className={`h-12 text-base ${tandai && nama.trim().length < 2 ? 'border-rose-300' : ''}`}
          data-testid="angket-nama" />
      </Langkah>

      <Langkah id="langkah-guru" nomor={3} judul="Guru yang dinilai"
        keterangan={`Angka di samping nama = jumlah responden ${info ? info.label.toLowerCase() : ''} yang sudah mengisi.`}>
        <div className={tandai && !guruId ? 'rounded-md ring-1 ring-rose-300' : ''}>
          <PilihGuru guru={data.guru} jenis={jenis} maks={data.maks_responden} value={guruId} onPilih={setGuruId} disabled={!jenis} />
        </div>
        {data.guru.length === 0 && <p className="mt-2 text-sm text-amber-700">Belum ada guru yang dinilai pada periode ini.</p>}
      </Langkah>

      {info && (
        <Langkah nomor={4} judul={`Angket ${info.label}`} keterangan={guru ? `Menilai ${guru.nama}` : 'Pilih guru yang dinilai di langkah 3.'}>
          <ButirAngket butir={info.butir} jawaban={isian} onJawab={jawab} tandai={tandai} />
        </Langkah>
      )}

      <Langkah id="langkah-ttd" nomor={info ? 5 : 4} judul="Tanda tangan responden" keterangan="Goreskan tanda tangan dengan jari, stylus, atau mouse.">
        <PadTandaTangan onUbah={setTtd} invalid={tandai && !ttd} />
      </Langkah>

      <div className="sticky bottom-0 -mx-4 border-t border-slate-200 bg-[#FBF7EE]/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <span className="text-xs text-slate-500 sm:mr-auto">
            {info ? `${terisi}/${info.butir.length} butir terisi` : 'Pilih jenis angket untuk mulai'}
            {kurang.length > 0 && tandai && <span className="text-rose-600"> · belum: {kurang.join(', ')}</span>}
          </span>
          <Button onClick={kirim} disabled={mengirim} className="h-12 gap-2 bg-[#006837] text-base hover:bg-[#005830] sm:h-11" data-testid="angket-kirim">
            {mengirim ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />} Kirim angket
          </Button>
        </div>
      </div>
    </Kerangka>
  );
}
