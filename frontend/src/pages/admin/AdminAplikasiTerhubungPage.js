import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  AppWindow, Copy, KeyRound, Loader2, Pencil, Plus, Search, ShieldCheck, Trash2, UserMinus, UserPlus, X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { confirmDialog } from '@/components/ui/confirm-dialog';
import { ROLE_LABELS } from '@/lib/api';
import {
  KELOMPOK_PERAN, alamatApiSso, cariPengguna, daftarAplikasiAdmin, hapusAplikasi, kunciBaru, penggunaById,
  tambahAplikasi, ubahAplikasi,
} from '@/lib/sso';

const POLA_KODE = /^[a-z0-9][a-z0-9-]{1,39}$/;

const formKosong = () => ({
  baru: true, id: '', nama: '', deskripsi: '', url_masuk: '', url_ikon: '', aktif: true, urutan: 0,
  peran: [], izin_pengguna: [], blokir_pengguna: [],
});

async function salin(teks) {
  try {
    await navigator.clipboard.writeText(teks);
    toast.success('Disalin.');
  } catch {
    toast.error('Gagal menyalin; salin manual.');
  }
}

// Pilih pengguna khusus (izin / blokir) dengan pencarian nama, username, NIP, NISN, atau Peg ID.
function PemilihPengguna({ judul, keterangan, ids, onUbah, ikon: Ikon, testId }) {
  const [cari, setCari] = useState('');
  const [hasil, setHasil] = useState([]);
  const [mencari, setMencari] = useState(false);
  const [nama, setNama] = useState({});

  useEffect(() => {
    const belum = ids.filter((i) => !nama[i]);
    if (!belum.length) return;
    penggunaById(belum).then((d) => setNama((n) => ({ ...n, ...Object.fromEntries(d.map((u) => [u.id, u])) }))).catch(() => {});
  }, [ids, nama]);

  useEffect(() => {
    const kata = cari.trim();
    if (kata.length < 2) { setHasil([]); return undefined; }
    const t = setTimeout(async () => {
      setMencari(true);
      try { setHasil(await cariPengguna(kata)); } catch (e) { toast.error(e.message); } finally { setMencari(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [cari]);

  const tambah = (u) => {
    setNama((n) => ({ ...n, [u.id]: u }));
    if (!ids.includes(u.id)) onUbah([...ids, u.id]);
  };

  return (
    <div className="space-y-2" data-testid={testId}>
      <div>
        <Label className="flex items-center gap-1.5"><Ikon className="h-3.5 w-3.5" /> {judul}</Label>
        <p className="text-[11px] text-slate-500">{keterangan}</p>
      </div>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input value={cari} onChange={(e) => setCari(e.target.value)} className="h-9 pl-8"
          placeholder="Cari nama, username, NIP, NISN, atau Peg ID" />
        {mencari && <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />}
      </div>
      {hasil.length > 0 && (
        <div className="max-h-40 overflow-y-auto rounded-md border border-slate-200">
          {hasil.map((u) => (
            <button key={u.id} type="button" onClick={() => tambah(u)} disabled={ids.includes(u.id)}
              className="flex w-full items-center justify-between gap-2 border-b border-slate-100 px-3 py-1.5 text-left text-sm last:border-0 hover:bg-slate-50 disabled:opacity-50">
              <span className="min-w-0">
                <span className="block truncate font-medium">{u.nama || u.username}</span>
                <span className="block truncate text-[11px] text-slate-500">
                  {u.username}{u.nomor ? ` · ${u.nomor}` : ''} · {(u.peran || []).map((r) => ROLE_LABELS[r] || r).join(', ')}
                </span>
              </span>
              <Plus className="h-4 w-4 shrink-0 text-slate-400" />
            </button>
          ))}
        </div>
      )}
      {ids.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {ids.map((id) => (
            <Badge key={id} variant="outline" className="gap-1 pr-1">
              {nama[id]?.nama || nama[id]?.username || id}
              <button type="button" onClick={() => onUbah(ids.filter((x) => x !== id))} aria-label="Hapus" className="rounded p-0.5 hover:bg-slate-100">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

// Kunci rahasia hanya tampil sekali (setelah tambah / buat ulang kunci): ditampilkan beserta isian .env aplikasi tujuan.
function DialogKunci({ data, onTutup }) {
  const env = data ? `SUPERAPP_SSO_URL=${alamatApiSso()}\nSUPERAPP_SSO_KUNCI=${data.kunci}` : '';
  return (
    <Dialog open={!!data} onOpenChange={(v) => !v && onTutup()}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-lg" data-testid="sso-dialog-kunci">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-amber-600" /> Kunci rahasia {data?.nama}</DialogTitle>
          <DialogDescription>
            Salin sekarang dan pasang di file <code>.env</code> aplikasi tujuan. Kunci ini <b>hanya ditampilkan sekali</b>;
            bila hilang, buat kunci baru (kunci lama langsung tidak berlaku). Jangan bagikan kunci ini.
          </DialogDescription>
        </DialogHeader>
        <pre className="whitespace-pre-wrap break-all rounded-md border border-slate-200 bg-slate-50 p-3 text-xs" data-testid="sso-isian-env">{env}</pre>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => salin(env)}><Copy className="mr-1 h-4 w-4" /> Salin isian .env</Button>
          <Button onClick={onTutup} className="bg-[#006837] hover:bg-[#005830]">Sudah saya simpan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DialogAplikasi({ form, setForm, daftarPeran, onSimpan, onTutup, menyimpan }) {
  if (!form) return null;
  const ubah = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const punya = (r) => form.peran.includes(r);
  const togglePeran = (r) => ubah('peran')(punya(r) ? form.peran.filter((x) => x !== r) : [...form.peran, r]);
  const kelompok = (k) => {
    const peran = k.peran.filter((r) => daftarPeran.includes(r));
    const semua = peran.every(punya);
    ubah('peran')(semua ? form.peran.filter((r) => !peran.includes(r)) : [...new Set([...form.peran, ...peran])]);
  };
  const kodeSalah = form.baru && form.id && !POLA_KODE.test(form.id);

  return (
    <Dialog open onOpenChange={(v) => !v && !menyimpan && onTutup()}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-2xl overflow-y-auto" data-testid="sso-dialog-aplikasi">
        <DialogHeader>
          <DialogTitle>{form.baru ? 'Tambah aplikasi terhubung' : `Ubah ${form.nama}`}</DialogTitle>
          <DialogDescription>Aplikasi ini bisa dibuka dari dashboard Super App tanpa login ulang oleh pengguna yang berhak.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Kode aplikasi</Label>
            <Input value={form.id} disabled={!form.baru} onChange={(e) => ubah('id')(e.target.value.toLowerCase().trim())} placeholder="koperasi" data-testid="sso-input-kode" />
            <p className={`text-[11px] ${kodeSalah ? 'text-rose-600' : 'text-slate-500'}`}>Huruf kecil, angka, dan tanda minus; tidak bisa diubah.</p>
          </div>
          <div className="space-y-1">
            <Label>Nama</Label>
            <Input value={form.nama} onChange={(e) => ubah('nama')(e.target.value)} placeholder="Koperasi Sekolah" data-testid="sso-input-nama" />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Alamat penerima tiket</Label>
            <Input value={form.url_masuk} onChange={(e) => ubah('url_masuk')(e.target.value)} placeholder="https://koperasi.madrasah.sch.id/sso/masuk" data-testid="sso-input-url" />
            <p className="text-[11px] text-slate-500">Halaman di aplikasi tujuan yang menerima <code>?tiket=...</code>. Wajib https.</p>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Keterangan singkat</Label>
            <Textarea rows={2} value={form.deskripsi} onChange={(e) => ubah('deskripsi')(e.target.value)} placeholder="Simpan pinjam & belanja koperasi" />
          </div>
          <div className="space-y-1">
            <Label>Alamat ikon (opsional)</Label>
            <Input value={form.url_ikon} onChange={(e) => ubah('url_ikon')(e.target.value)} placeholder="https://.../logo.png" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Urutan</Label>
              <Input type="number" min={0} max={999} value={form.urutan} onChange={(e) => ubah('urutan')(Number(e.target.value) || 0)} />
            </div>
            <div className="space-y-1">
              <Label>Aktif</Label>
              <div className="flex h-9 items-center"><Switch checked={form.aktif} onCheckedChange={ubah('aktif')} /></div>
            </div>
          </div>
        </div>

        <div className="space-y-2 rounded-lg border border-slate-200 p-3">
          <Label className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Peran yang boleh membuka</Label>
          <div className="flex flex-wrap gap-2">
            {KELOMPOK_PERAN.map((k) => (
              <Button key={k.kunci} type="button" size="sm" variant="outline" className="h-7" onClick={() => kelompok(k)} data-testid={`sso-kelompok-${k.kunci}`}>
                {k.peran.filter((r) => daftarPeran.includes(r)).every(punya) ? 'Hapus' : 'Semua'} {k.label}
              </Button>
            ))}
          </div>
          <div className="grid max-h-56 grid-cols-1 gap-1 overflow-y-auto pr-1 sm:grid-cols-2">
            {daftarPeran.map((r) => (
              <label key={r} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-slate-50">
                <Checkbox checked={punya(r)} onCheckedChange={() => togglePeran(r)} />
                {ROLE_LABELS[r] || r}
              </label>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <PemilihPengguna judul="Izinkan pengguna khusus" ikon={UserPlus} testId="sso-izin"
            keterangan="Boleh membuka walau perannya tidak dicentang." ids={form.izin_pengguna} onUbah={ubah('izin_pengguna')} />
          <PemilihPengguna judul="Blokir pengguna" ikon={UserMinus} testId="sso-blokir"
            keterangan="Tidak boleh membuka walau perannya dicentang." ids={form.blokir_pengguna} onUbah={ubah('blokir_pengguna')} />
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onTutup} disabled={menyimpan}>Batal</Button>
          <Button onClick={onSimpan} disabled={menyimpan || !form.nama.trim() || !form.url_masuk.trim() || (form.baru && !POLA_KODE.test(form.id))}
            className="bg-[#006837] hover:bg-[#005830]" data-testid="sso-simpan">
            {menyimpan && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Admin: daftar aplikasi madrasah lain yang login lewat Super App (SSO tiket), hak akses per peran & pengguna,
// dan kunci rahasia untuk server aplikasi tujuan.
export default function AdminAplikasiTerhubungPage() {
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [menyimpan, setMenyimpan] = useState(false);
  const [kunci, setKunci] = useState(null);

  const muat = useCallback(async () => {
    try { setData(await daftarAplikasiAdmin()); } catch (e) { toast.error(e.message); setData({ aplikasi: [], peran: [] }); }
  }, []);
  useEffect(() => { muat(); }, [muat]);

  const daftarPeran = useMemo(() => data?.peran || [], [data]);

  const simpan = async () => {
    setMenyimpan(true);
    const { baru, id, ...isi } = form;
    try {
      if (baru) {
        const hasil = await tambahAplikasi({ id, ...isi });
        setKunci({ nama: hasil.aplikasi.nama, kunci: hasil.kunci_rahasia });
        toast.success('Aplikasi ditambahkan.');
      } else {
        await ubahAplikasi(id, isi);
        toast.success('Perubahan disimpan.');
      }
      setForm(null);
      muat();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setMenyimpan(false);
    }
  };

  const buatKunci = async (app) => {
    const ok = await confirmDialog(`Buat kunci rahasia baru untuk ${app.nama}? Kunci lama langsung tidak berlaku, jadi aplikasi tujuan harus segera memakai kunci baru.`,
      { title: 'Buat kunci baru', confirmText: 'Buat kunci baru' });
    if (!ok) return;
    try {
      const hasil = await kunciBaru(app.id);
      setKunci({ nama: app.nama, kunci: hasil.kunci_rahasia });
      muat();
    } catch (e) { toast.error(e.message); }
  };

  const hapus = async (app) => {
    const ok = await confirmDialog(`Hapus aplikasi ${app.nama}? Tombolnya hilang dari dashboard dan aplikasi tersebut tidak bisa lagi menukar tiket.`,
      { title: 'Hapus aplikasi', confirmText: 'Hapus', variant: 'destructive' });
    if (!ok) return;
    try { await hapusAplikasi(app.id); toast.success('Aplikasi dihapus.'); muat(); } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4" data-testid="admin-aplikasi-terhubung">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><AppWindow className="h-5 w-5 text-[#006837]" /> Aplikasi Terhubung (SSO)</h2>
          <p className="text-xs text-slate-500">Aplikasi madrasah lain yang dibuka dari dashboard Super App tanpa login ulang.</p>
        </div>
        <Button onClick={() => setForm(formKosong())} className="bg-[#006837] hover:bg-[#005830]" data-testid="sso-tambah">
          <Plus className="mr-1 h-4 w-4" /> Tambah aplikasi
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-1 p-3 text-xs text-slate-600">
          <p>
            Alamat API Super App untuk dipasang di aplikasi tujuan (<code>SUPERAPP_SSO_URL</code>):{' '}
            <button type="button" onClick={() => salin(alamatApiSso())} className="inline-flex items-center gap-1 break-all text-left font-mono text-[#006837] hover:underline">
              {alamatApiSso()} <Copy className="h-3 w-3" />
            </button>
          </p>
          <p>Tiket berlaku {data?.umur_tiket_detik || 60} detik dan hanya bisa dipakai sekali. Hak akses diperiksa ulang saat aplikasi tujuan menukar tiket.</p>
        </CardContent>
      </Card>

      {!data && <div className="py-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-[#006837]" /></div>}
      {data && !data.aplikasi.length && (
        <p className="py-10 text-center text-sm text-slate-500">Belum ada aplikasi. Tambahkan Absensi, PTSP, Koperasi, atau Perpustakaan.</p>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {(data?.aplikasi || []).map((app) => (
          <Card key={app.id} className="min-w-0" data-testid={`sso-app-${app.id}`}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <CardTitle className="truncate text-base">{app.nama}</CardTitle>
                  <p className="truncate font-mono text-[11px] text-slate-500">{app.id} · {app.url_masuk}</p>
                </div>
                <Badge variant="outline" className={app.aktif ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'text-slate-500'}>
                  {app.aktif ? 'Aktif' : 'Nonaktif'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {app.deskripsi && <p className="text-slate-600">{app.deskripsi}</p>}
              <div className="flex flex-wrap gap-1">
                {app.peran.length
                  ? app.peran.map((r) => <Badge key={r} variant="secondary" className="text-[10px]">{ROLE_LABELS[r] || r}</Badge>)
                  : <span className="text-amber-700">Belum ada peran yang diizinkan.</span>}
              </div>
              <p className="text-slate-500">
                {app.izin_pengguna.length} pengguna diizinkan khusus · {app.blokir_pengguna.length} diblokir · kunci {app.kunci_awal}…
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => setForm({ ...formKosong(), ...app, baru: false })} data-testid={`sso-ubah-${app.id}`}>
                  <Pencil className="mr-1 h-3.5 w-3.5" /> Ubah & hak akses
                </Button>
                <Button size="sm" variant="outline" onClick={() => buatKunci(app)} data-testid={`sso-kunci-${app.id}`}>
                  <KeyRound className="mr-1 h-3.5 w-3.5" /> Kunci baru
                </Button>
                <Button size="sm" variant="outline" className="text-rose-700 hover:bg-rose-50" onClick={() => hapus(app)}>
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Hapus
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <DialogAplikasi form={form} setForm={setForm} daftarPeran={daftarPeran} onSimpan={simpan} onTutup={() => setForm(null)} menyimpan={menyimpan} />
      <DialogKunci data={kunci} onTutup={() => setKunci(null)} />
    </div>
  );
}
