import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Copy, ExternalLink, Pencil, Trash2 } from 'lucide-react';
import { confirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from 'sonner';
import { ambilDetailAkun, hapusAkun } from '@/lib/simpanAkun';
import { domainDari } from '@/components/simpan-akun/KartuAkun';
import NilaiRahasia, { TombolMata, useTampilRahasia } from '@/components/simpan-akun/NilaiRahasia';

// Salin ke papan klip; WebView aplikasi Android/HTTP sering menolak navigator.clipboard,
// jadi ada cadangan lewat textarea tersembunyi + execCommand('copy').
function salinCadangan(teks) {
  const el = document.createElement('textarea');
  el.value = teks;
  el.setAttribute('readonly', '');
  el.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
  document.body.appendChild(el);
  el.select();
  el.setSelectionRange(0, teks.length);
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  el.remove();
  return ok;
}

async function salin(teks, label) {
  let ok = false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(teks || '');
      ok = true;
    }
  } catch {
    ok = false;
  }
  if (!ok) ok = salinCadangan(teks || '');
  if (ok) toast.success(`${label} disalin`);
  else toast.error(`Gagal menyalin ${label.toLowerCase()}`);
}

function Baris({ label, children, aksi }) {
  return (
    <div className="py-2.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 flex items-center gap-2">
        <div className="min-w-0 flex-1 break-all text-sm text-slate-900">{children}</div>
        {aksi}
      </dd>
    </div>
  );
}

// Rincian satu akun tersimpan: link web, nama aplikasi, username, password (tersembunyi bawaan).
// Password hanya dimuat saat rincian dibuka, bukan bersama daftar.
// `onUbah(akun)` (opsional) menampilkan tombol Ubah; `onTerhapus(id)` (opsional) menampilkan tombol Hapus
// dengan konfirmasi.
export default function DetailAkunDialog({ akunId, onClose, onUbah, onTerhapus }) {
  const [akun, setAkun] = useState(null);
  const [memuat, setMemuat] = useState(false);
  // Password tersembunyi bawaan; tertutup lagi otomatis (30 detik) atau saat akun berganti/dialog ditutup.
  const [tampil, setTampil] = useTampilRahasia(akunId);
  const [menghapus, setMenghapus] = useState(false);

  const hapus = async () => {
    const yakin = await confirmDialog(
      `Akun "${akun.nama_akun}" (${akun.nama_aplikasi}) akan dihapus permanen dari Simpan Akun dan tidak dapat dikembalikan.`,
      { title: 'Hapus akun ini?', confirmText: 'Ya, hapus akun' },
    );
    if (!yakin) return;
    setMenghapus(true);
    try {
      await hapusAkun(akun.id);
      toast.success('Akun dihapus');
      onTerhapus(akun.id);
    } catch (e) {
      toast.error(e?.message || 'Gagal menghapus akun');
    } finally {
      setMenghapus(false);
    }
  };

  useEffect(() => {
    setAkun(null);
    if (!akunId) return undefined;
    let batal = false;
    setMemuat(true);
    ambilDetailAkun(akunId)
      .then((d) => { if (!batal) setAkun(d); })
      .catch((e) => { if (!batal && !e.sesiBerakhir) toast.error(e.message || 'Gagal memuat rincian akun'); })
      .finally(() => { if (!batal) setMemuat(false); });
    return () => { batal = true; };
  }, [akunId]);

  const link = akun?.link_web ? (/^https?:\/\//i.test(akun.link_web) ? akun.link_web : `https://${akun.link_web}`) : '';

  return (
    <Dialog open={!!akunId} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md" data-testid="simpan-akun-detail">
        {memuat || !akun ? (
          <div className="py-10 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#006837]" />
            <DialogTitle className="sr-only">Memuat rincian akun</DialogTitle>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-left">{akun.nama_akun}</DialogTitle>
              <DialogDescription className="text-left">{akun.nama_aplikasi}</DialogDescription>
            </DialogHeader>
            <dl className="divide-y">
              <Baris
                label="Link web"
                aksi={link && (
                  <Button asChild size="icon" variant="ghost" aria-label="Buka link di tab baru">
                    <a href={link} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
                  </Button>
                )}
              >
                {link ? <a href={link} target="_blank" rel="noopener noreferrer" className="text-[#006837] hover:underline">{domainDari(link)}</a> : <span className="text-slate-400">Bukan aplikasi web</span>}
              </Baris>
              <Baris label="Nama aplikasi">{akun.nama_aplikasi}</Baris>
              <Baris
                label="Username"
                aksi={(
                  <Button size="icon" variant="ghost" onClick={() => salin(akun.username, 'Username')} aria-label="Salin username">
                    <Copy className="h-4 w-4" />
                  </Button>
                )}
              >
                {akun.username}
              </Baris>
              <Baris
                label="Password"
                aksi={(
                  <>
                    <TombolMata tampil={tampil} onToggle={() => setTampil((v) => !v)} testid="simpan-akun-toggle-password" />
                    <Button size="icon" variant="ghost" onClick={() => salin(akun.password, 'Password')} aria-label="Salin password">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </>
                )}
              >
                <NilaiRahasia nilai={akun.password} tampil={tampil} testid="simpan-akun-password" />
              </Baris>
            </dl>
            {(onUbah || onTerhapus) && (
              <div className="flex justify-between gap-2">
                {onTerhapus ? (
                  <Button variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={hapus} disabled={menghapus} data-testid="simpan-akun-hapus">
                    {menghapus ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />} Hapus
                  </Button>
                ) : <span />}
                {onUbah && (
                <Button
                  variant="outline"
                  onClick={() => {
                    const { password, ...tanpaPassword } = akun;
                    onUbah(tanpaPassword);
                  }}
                  data-testid="simpan-akun-ubah"
                >
                  <Pencil className="mr-2 h-4 w-4" /> Ubah
                </Button>
                )}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
