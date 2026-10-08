import React, { useContext, useEffect, useState } from 'react';
import { OTPInput, OTPInputContext } from 'input-otp';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TombolMata, useTampilRahasia } from '@/components/simpan-akun/NilaiRahasia';
import { Loader2, LockKeyhole, ShieldCheck, ShieldAlert, Clock, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { statusPin, buatPin, verifikasiPin, pinValid, alasanPinLemah, BATAS_PERCOBAAN_PIN } from '@/lib/simpanAkun';
import LupaPinDialog from '@/components/simpan-akun/LupaPinDialog';

// Slot PIN: tersamar (titik) kecuali pengguna memilih menampilkan angka.
function SlotPin({ index, lihat }) {
  const { slots } = useContext(OTPInputContext);
  const { char, isActive } = slots[index];
  return (
    <div className={`flex h-12 w-11 items-center justify-center rounded-lg border text-2xl transition-all ${isActive ? 'border-[#006837] ring-2 ring-[#006837]/30' : 'border-slate-300'}`}>
      {char ? (lihat ? char : '•') : ''}
    </div>
  );
}

function IsianPin({ value, onChange, onSelesai, disabled, autoFocus, label, testid }) {
  const [lihat, setLihat] = useTampilRahasia(label, 10000);
  return (
    <div className="flex items-center justify-center gap-1">
    <OTPInput
      maxLength={6}
      value={value}
      onChange={(v) => onChange(v.replace(/\D/g, ''))}
      onComplete={onSelesai}
      inputMode="numeric"
      pattern="^[0-9]*$"
      disabled={disabled}
      autoFocus={autoFocus}
      aria-label={label}
      data-testid={testid}
      containerClassName="flex justify-center gap-2"
    >
      {[0, 1, 2, 3, 4, 5].map((i) => <SlotPin key={i} index={i} lihat={lihat} />)}
    </OTPInput>
    <TombolMata tampil={lihat} onToggle={() => setLihat((v) => !v)} label="PIN" testid={`${testid}-toggle`} />
    </div>
  );
}

// Gerbang PIN Simpan Akun: pertama kali -> buat PIN 6 angka (+ konfirmasi); selanjutnya -> verifikasi PIN
// setiap kali menu dibuka. `onTerbuka` dipanggil setelah PIN benar (isi brankas boleh ditampilkan).
export default function GerbangPin({ onTerbuka }) {
  const [status, setStatus] = useState(null); // null = memuat, {sudah_dibuat}
  const [pin, setPin] = useState('');
  const [konfirmasi, setKonfirmasi] = useState('');
  const [langkah, setLangkah] = useState(1); // buat PIN: 1 = isi, 2 = ulangi
  const [galat, setGalat] = useState('');
  const [terkunci, setTerkunci] = useState(false);
  const [sisa, setSisa] = useState(BATAS_PERCOBAAN_PIN);
  const [resetDiminta, setResetDiminta] = useState(null);
  const [dialogLupa, setDialogLupa] = useState(false);
  const [proses, setProses] = useState(false);

  useEffect(() => {
    statusPin().then((st) => {
      setStatus(st);
      setTerkunci(!!st.terkunci);
      setResetDiminta(st.reset_diminta_pada || null);
      if (st.sisa_percobaan != null) setSisa(st.sisa_percobaan);
    }).catch(() => {
      setStatus({ sudah_dibuat: false });
      toast.error('Gagal memeriksa PIN');
    });
  }, []);

  const verifikasi = async (nilai = pin) => {
    if (!pinValid(nilai)) return;
    setProses(true);
    setGalat('');
    try {
      await verifikasiPin(nilai);
      onTerbuka();
    } catch (e) {
      setGalat(e.message || 'PIN salah');
      setTerkunci(!!e.terkunci);
      if (e.sisa != null) setSisa(e.sisa);
      setPin('');
    } finally {
      setProses(false);
    }
  };

  const lanjutBuat = (nilai = pin) => {
    if (!pinValid(nilai)) return;
    const lemah = alasanPinLemah(nilai);
    if (lemah) {
      setGalat(`${lemah}. Pilih PIN yang tidak mudah ditebak.`);
      setPin('');
      return;
    }
    setGalat('');
    setLangkah(2);
  };

  const simpanPinBaru = async (nilai = konfirmasi) => {
    if (!pinValid(nilai)) return;
    if (nilai !== pin) {
      setGalat('PIN konfirmasi tidak sama. Ulangi dari awal.');
      setPin('');
      setKonfirmasi('');
      setLangkah(1);
      return;
    }
    setProses(true);
    try {
      await buatPin(pin);
      toast.success(status.direset_pada ? 'PIN baru dibuat — Simpan Akun kembali dapat dibuka' : 'PIN Simpan Akun berhasil dibuat');
      onTerbuka();
    } catch (e) {
      setGalat(e.message || 'Gagal membuat PIN');
    } finally {
      setProses(false);
    }
  };

  if (!status) {
    return (
      <div className="p-12 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#006837]" />
      </div>
    );
  }

  const buat = !status.sudah_dibuat;

  const infoReset = resetDiminta ? (
    <p className="flex items-center justify-center gap-1.5 text-xs text-amber-700" data-testid="pin-reset-diminta">
      <Clock className="h-3.5 w-3.5" />
      Permintaan reset dikirim {new Date(resetDiminta).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} — menunggu admin.
    </p>
  ) : (
    <Button variant="link" size="sm" className="text-slate-600" onClick={() => setDialogLupa(true)} data-testid="pin-lupa">
      Lupa PIN?
    </Button>
  );
  const dialogLupaPin = (
    <LupaPinDialog open={dialogLupa} onClose={() => setDialogLupa(false)} onTerkirim={(h) => setResetDiminta(h.reset_diminta_pada)} />
  );

  if (!buat && terkunci) {
    return (
      <Card className="mx-auto max-w-md" data-testid="simpan-akun-terkunci">
        <CardContent className="space-y-4 p-6 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
            <ShieldAlert className="h-7 w-7" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Simpan Akun terkunci</h2>
            <p className="mt-1 text-sm text-slate-600">
              PIN salah {BATAS_PERCOBAAN_PIN} kali. Demi keamanan, brankas dikunci. Minta admin mereset PIN Anda —
              admin tidak dapat melihat isi simpanan Anda.
            </p>
          </div>
          {infoReset}
          {dialogLupaPin}
        </CardContent>
      </Card>
    );
  }
  const judul = buat
    ? (langkah === 1 ? (status.direset_pada ? 'Buat PIN Baru' : 'Buat PIN Simpan Akun') : 'Ulangi PIN Anda')
    : 'Masukkan PIN';
  const keterangan = buat
    ? (langkah === 1 ? 'Buat PIN 6 angka. PIN ini diminta setiap kali Anda membuka Simpan Akun.' : 'Masukkan PIN yang sama sekali lagi untuk konfirmasi.')
    : 'Masukkan PIN 6 angka untuk membuka akun-akun yang Anda simpan.';

  return (
    <Card className="mx-auto max-w-md" data-testid={buat ? 'simpan-akun-buat-pin' : 'simpan-akun-verifikasi-pin'}>
      <CardContent className="space-y-5 p-6 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#006837]/10 text-[#006837]">
          {buat ? <ShieldCheck className="h-7 w-7" /> : <LockKeyhole className="h-7 w-7" />}
        </span>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{judul}</h2>
          <p className="mt-1 text-sm text-slate-600">{keterangan}</p>
        </div>
        {buat && status.direset_pada && (
          <p className="flex items-start gap-2 rounded-md bg-sky-50 px-3 py-2 text-left text-xs text-sky-800" data-testid="pin-sudah-direset">
            <RotateCcw className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            PIN Anda telah direset admin pada {new Date(status.direset_pada).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}.
            Buat PIN baru — akun yang tersimpan tetap utuh.
          </p>
        )}

        {buat && langkah === 2 ? (
          <IsianPin key="konfirmasi" value={konfirmasi} onChange={setKonfirmasi} onSelesai={simpanPinBaru} disabled={proses} autoFocus label="Ulangi PIN" testid="pin-konfirmasi" />
        ) : (
          <IsianPin
            key="pin"
            value={pin}
            onChange={setPin}
            onSelesai={buat ? lanjutBuat : verifikasi}
            disabled={proses || terkunci}
            autoFocus
            label={buat ? 'PIN baru' : 'PIN'}
            testid="pin-isian"
          />
        )}

        <p className={`min-h-[1.25rem] text-sm ${galat ? 'text-red-600' : 'text-transparent'}`} role="alert">{galat || '.'}</p>
        {!buat && sisa < BATAS_PERCOBAAN_PIN && (
          <div className="-mt-3 flex justify-center gap-1" aria-label={`Sisa ${sisa} percobaan`} data-testid="pin-sisa-percobaan">
            {Array.from({ length: BATAS_PERCOBAAN_PIN }, (_, i) => (
              <span key={i} className={`h-1.5 w-6 rounded-full ${i < sisa ? 'bg-amber-400' : 'bg-slate-200'}`} />
            ))}
          </div>
        )}
        {buat && langkah === 1 && !galat && (
          <ul className="-mt-3 space-y-0.5 text-left text-xs text-slate-500" data-testid="pin-aturan">
            <li>• 6 angka, tidak sama semua (mis. 111111)</li>
            <li>• Bukan angka berurutan (mis. 123456) atau pola berulang (mis. 121212)</li>
            <li>• Jangan memakai tanggal lahir atau NIP Anda</li>
          </ul>
        )}

        <Button
          className="w-full bg-[#006837] hover:bg-[#005830]"
          disabled={proses || terkunci || !pinValid(buat && langkah === 2 ? konfirmasi : pin)}
          onClick={() => (buat ? (langkah === 1 ? lanjutBuat() : simpanPinBaru()) : verifikasi())}
          data-testid="pin-kirim"
        >
          {proses && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {buat ? (langkah === 1 ? 'Lanjut' : 'Simpan PIN') : 'Buka'}
        </Button>
        {buat && langkah === 2 && (
          <Button variant="ghost" size="sm" onClick={() => { setLangkah(1); setPin(''); setKonfirmasi(''); setGalat(''); }}>
            Ganti PIN
          </Button>
        )}
        {!buat && infoReset}
        {!buat && dialogLupaPin}
      </CardContent>
    </Card>
  );
}
