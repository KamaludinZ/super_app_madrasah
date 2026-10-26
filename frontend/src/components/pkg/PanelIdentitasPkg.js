import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, UserPen } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { jenisGtk } from '@/lib/jenisGtk';
import { ambilIdentitasPkg, simpanIdentitasPkg, FIELD_ISIAN_PKG, GOLONGAN_PNS, GOLONGAN_PPPK } from '@/lib/pkgIdentitas';

const KOSONG = '__kosong__';
const LAINNYA = '__lainnya__';

// Isian PKG dalam formulir: golongan = pilihan umum PNS/PPPK + "Lainnya" (teks bebas), TMT golongan = tanggal.
function FormIsian({ nilai, onUbah, disabled }) {
  const dikenal = [...GOLONGAN_PNS, ...GOLONGAN_PPPK].includes(nilai.golongan);
  const [lainnya, setLainnya] = useState(!!nilai.golongan && !dikenal);
  const pilihan = lainnya ? LAINNYA : (nilai.golongan || KOSONG);
  const ubahPilihan = (v) => {
    if (v === LAINNYA) { setLainnya(true); onUbah('golongan', dikenal ? '' : nilai.golongan); return; }
    setLainnya(false);
    onUbah('golongan', v === KOSONG ? '' : v);
  };
  const teks = (kunci, label, ph) => (
    <div className="min-w-0 space-y-1">
      <Label htmlFor={`pkg-identitas-${kunci}`}>{label}</Label>
      <Input id={`pkg-identitas-${kunci}`} value={nilai[kunci] || ''} maxLength={150} disabled={disabled} placeholder={ph}
        onChange={(e) => onUbah(kunci, e.target.value)} data-testid={`pkg-identitas-input-${kunci}`} />
    </div>
  );
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" data-testid="pkg-identitas-form">
      {teks('pangkat', 'Pangkat', 'Contoh: Penata Muda')}
      <div className="min-w-0 space-y-1">
        <Label htmlFor="pkg-identitas-golongan">Golongan / ruang</Label>
        <Select value={pilihan} onValueChange={ubahPilihan} disabled={disabled}>
          <SelectTrigger id="pkg-identitas-golongan" data-testid="pkg-identitas-select-golongan"><SelectValue placeholder="Pilih golongan" /></SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value={KOSONG}>Belum diisi</SelectItem>
            {GOLONGAN_PNS.map((g) => <SelectItem key={g} value={g}>PNS {g}</SelectItem>)}
            {GOLONGAN_PPPK.map((g) => <SelectItem key={`p${g}`} value={g}>PPPK {g}</SelectItem>)}
            <SelectItem value={LAINNYA}>Lainnya (ketik sendiri)</SelectItem>
          </SelectContent>
        </Select>
        {lainnya && (
          <Input value={nilai.golongan || ''} maxLength={20} disabled={disabled} placeholder="Contoh: III/a"
            onChange={(e) => onUbah('golongan', e.target.value)} aria-label="Golongan (teks bebas)" data-testid="pkg-identitas-input-golongan" />
        )}
      </div>
      <div className="min-w-0 space-y-1">
        <Label htmlFor="pkg-identitas-tmt_golongan">TMT golongan</Label>
        <Input id="pkg-identitas-tmt_golongan" type="date" value={nilai.tmt_golongan || ''} disabled={disabled}
          max={new Date().toISOString().slice(0, 10)} onChange={(e) => onUbah('tmt_golongan', e.target.value)}
          data-testid="pkg-identitas-input-tmt_golongan" />
      </div>
      {teks('jabatan_fungsional', 'Jabatan fungsional', 'Contoh: Guru Ahli Muda')}
      {teks('pendidikan_terakhir', 'Pendidikan terakhir', 'Contoh: S1 Pendidikan Agama Islam')}
      {teks('spesialisasi', 'Spesialisasi', 'Bidang keahlian, bila ada')}
    </div>
  );
}

// Panel "identitas untuk laporan PKG": daftar identitas seperti yang tercetak (penanda kosong), isian EMIS hanya-baca
// (+ tombol Profil Saya bila milik sendiri), dan formulir isian PKG. `guruId` kosong = identitas diri sendiri.
// Dipakai kartu "Status Saya" dan dialog "Lengkapi identitas" (penilai/kepala). `onTersimpan(data)` dipanggil setelah simpan.
export default function PanelIdentitasPkg({ guruId, tampilDaftar = true, onTersimpan, onMuat }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [galat, setGalat] = useState(null);
  const [isian, setIsian] = useState({});
  const [menyimpan, setMenyimpan] = useState(false);

  const terapkan = useCallback((d) => {
    setData(d);
    setIsian(Object.fromEntries(FIELD_ISIAN_PKG.map((k) => [k, d.isian_pkg?.[k] || ''])));
    if (onMuat) onMuat(d);
  }, [onMuat]);

  useEffect(() => {
    let batal = false;
    setData(null);
    setGalat(null);
    ambilIdentitasPkg(guruId).then((d) => { if (!batal) terapkan(d); }).catch((e) => { if (!batal) setGalat(e); });
    return () => { batal = true; };
  }, [guruId, terapkan]);

  const berubah = data ? FIELD_ISIAN_PKG.some((k) => (isian[k] || '') !== (data.isian_pkg?.[k] || '')) : false;

  const simpan = async () => {
    setMenyimpan(true);
    try {
      const hasil = await simpanIdentitasPkg(guruId, isian);
      terapkan(hasil);
      toast.success(hasil.berubah?.length ? 'Identitas untuk laporan PKG disimpan.' : 'Tidak ada perubahan untuk disimpan.');
      if (onTersimpan) onTersimpan(hasil);
    } catch (e) {
      toast.error(e.message || 'Gagal menyimpan identitas.');
    } finally {
      setMenyimpan(false);
    }
  };

  if (galat) return <p className="py-6 text-center text-sm text-slate-700" role="alert" data-testid="pkg-identitas-galat">{galat.message}</p>;
  if (!data) return <div className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-[#006837]" /></div>;

  const emis = data.butir.filter((b) => b.sumber === 'emis');
  const milikSendiri = data.diubah_sebagai === 'diri';
  const profil = jenisGtk(user?.roles) === 'tendik' ? '/profile/tendik' : '/profile/guru';
  const emisKosong = emis.filter((b) => b.kosong);

  return (
    <div className="space-y-4" data-testid="pkg-identitas-panel">
      {tampilDaftar && (
        <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2" data-testid="pkg-identitas-daftar">
          {data.butir.map((b) => (
            <div key={b.kunci} className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)] gap-2 border-b border-slate-100 py-1.5 text-sm" data-testid={`pkg-identitas-butir-${b.kunci}`}>
              <dt className="text-slate-500">{b.label}</dt>
              <dd className="min-w-0 break-words">
                {b.kosong
                  ? <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">Belum diisi</Badge>
                  : <span className="text-slate-900">{b.nilai}</span>}
                {b.sumber === 'emis' && <span className="ml-1.5 text-[10px] uppercase tracking-wide text-slate-400">EMIS</span>}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <div className="space-y-3 rounded-lg border border-slate-200 p-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">Isian khusus laporan PKG</h4>
          <p className="text-xs text-slate-500">Dapat diubah langsung di sini tanpa verifikasi. Nilai ini tercetak pada lampiran identitas periode berjalan.</p>
        </div>
        <FormIsian nilai={isian} onUbah={(k, v) => setIsian((s) => ({ ...s, [k]: v }))} disabled={menyimpan} />
        <div className="flex justify-end">
          <Button onClick={simpan} disabled={menyimpan || !berubah} className="bg-[#006837] hover:bg-[#005830]" data-testid="pkg-identitas-simpan">
            {menyimpan ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />} Simpan
          </Button>
        </div>
      </div>

      {emisKosong.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 sm:flex-row sm:items-center sm:justify-between" data-testid="pkg-identitas-emis-kosong">
          <span className="min-w-0">
            Data dari EMIS/Profil yang masih kosong: {emisKosong.map((b) => b.label).join(', ')}.
            {milikSendiri ? ' Lengkapi lewat Profil Saya (melalui verifikasi data).' : ' Guru yang bersangkutan melengkapinya lewat Profil Saya.'}
          </span>
          {milikSendiri && (
            <Button asChild size="sm" variant="outline" className="shrink-0 border-amber-300 bg-white">
              <Link to={profil} data-testid="pkg-identitas-ubah-profil"><UserPen className="mr-1.5 h-3.5 w-3.5" /> Ubah di Profil Saya</Link>
            </Button>
          )}
        </div>
      )}
      {emisKosong.length === 0 && milikSendiri && (
        <div className="text-right">
          <Button asChild size="sm" variant="ghost" className="text-xs">
            <Link to={profil} data-testid="pkg-identitas-ubah-profil"><UserPen className="mr-1.5 h-3.5 w-3.5" /> Ubah data EMIS di Profil Saya</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
