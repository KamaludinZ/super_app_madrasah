import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  IdCard, FileBadge, CalendarRange, UserCheck, ClipboardCheck, ShieldCheck, ShieldAlert, CheckCircle2, Lock, RotateCw,
} from 'lucide-react';
import { formatWIBPanjang } from '@/lib/datetime';
import { labelPeranPkg } from '@/lib/pkg';

// Penjelasan alasan sub-menu tidak dapat dibuka (kode sama dengan detail 403 backend).
const ALASAN_MENU = {
  bukan_kepala: 'Dikelola kepala madrasah',
  bukan_penilai: 'Khusus anggota tim penilai',
  belum_disupervisi: 'Menunggu supervisi kepala madrasah',
  bukan_anggota_sk: 'Tidak terdaftar di SK aktif',
};

function Baris({ icon: Icon, label, children, testid }) {
  return (
    <div className="flex items-start gap-3 py-2.5" data-testid={testid}>
      <Icon className="h-4 w-4 mt-0.5 shrink-0 text-[#006837]" />
      <div className="min-w-0 flex-1 sm:flex sm:items-baseline sm:justify-between sm:gap-4">
        <div className="text-sm text-slate-500">{label}</div>
        <div className="text-sm font-medium text-slate-900 sm:text-right">{children}</div>
      </div>
    </div>
  );
}

function YaTidak({ ya, teksYa = 'Ya', teksTidak = 'Tidak' }) {
  return ya
    ? <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">{teksYa}</Badge>
    : <Badge variant="outline" className="text-slate-500">{teksTidak}</Badge>;
}

// Status keanggotaan SK pengguna di dalam PkgLayout: data SK & periode, peran (penilai/dinilai/merangkap),
// status supervisi, dan hak akses tiap sub-menu PKG beserta alasannya. Data dari konteks layout
// (GET /pkg/sk/my-membership + GET /pkg/beranda/menu).
export default function PkgKeanggotaanPage() {
  const { keanggotaan: k, menu = [], muatUlang } = useOutletContext() || {};
  if (!k) return null;
  const kepala = k.peran === 'kepala';
  const periode = k.periode;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" data-testid="pkg-keanggotaan">
      <Card>
        <CardHeader className="pb-1 flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <IdCard className="h-4 w-4 text-[#006837]" /> Status Keanggotaan SK
          </CardTitle>
          {muatUlang && (
            <Button variant="ghost" size="sm" onClick={muatUlang} className="h-8 gap-1 text-xs" data-testid="pkg-keanggotaan-muat-ulang">
              <RotateCw className="h-3.5 w-3.5" /> Perbarui
            </Button>
          )}
        </CardHeader>
        <CardContent className="divide-y divide-slate-100">
          <Baris icon={FileBadge} label="Nomor SK" testid="pkg-keanggotaan-sk">
            {k.nomor_sk || <span className="text-slate-400">Belum ada SK aktif</span>}
          </Baris>
          <Baris icon={CalendarRange} label="Periode" testid="pkg-keanggotaan-periode">
            {periode ? (
              <>
                {periode.nama_periode}
                {periode.tanggal_buka && periode.tanggal_tutup && (
                  <div className="text-xs font-normal text-slate-500">
                    {formatWIBPanjang(periode.tanggal_buka, false)} – {formatWIBPanjang(periode.tanggal_tutup, false)}
                  </div>
                )}
              </>
            ) : <span className="text-slate-400">Belum ada periode berjalan</span>}
          </Baris>
          <Baris icon={UserCheck} label="Peran Anda" testid="pkg-keanggotaan-peran">{labelPeranPkg(k) || '-'}</Baris>
          <Baris icon={ClipboardCheck} label="Sebagai penilai" testid="pkg-keanggotaan-penilai"><YaTidak ya={k.sebagai_penilai} /></Baris>
          <Baris icon={UserCheck} label="Sebagai guru yang dinilai" testid="pkg-keanggotaan-dinilai">
            {kepala ? <span className="text-xs font-normal text-slate-500">Kepala madrasah tidak dinilai</span> : <YaTidak ya={k.sebagai_dinilai} />}
          </Baris>
          {k.sebagai_penilai && (
            <Baris icon={k.supervisi_selesai ? ShieldCheck : ShieldAlert} label="Supervisi penilai" testid="pkg-keanggotaan-supervisi">
              {kepala
                ? <span className="text-xs font-normal text-slate-500">Tidak diperlukan</span>
                : <YaTidak ya={k.supervisi_selesai} teksYa="Sudah disupervisi" teksTidak="Belum disupervisi" />}
            </Baris>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#006837]" /> Hak Akses Menu PKG
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-slate-100">
          {menu.length === 0 && <p className="py-4 text-sm text-slate-500">Daftar menu belum tersedia.</p>}
          {menu.map((m) => (
            <div key={m.key} className="flex items-center gap-3 py-2.5" data-testid={`pkg-akses-${m.key}`}>
              {m.akses
                ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-label="Boleh dibuka" />
                : <Lock className="h-4 w-4 shrink-0 text-slate-400" aria-label="Tidak dapat dibuka" />}
              <div className="min-w-0 flex-1">
                <div className={`text-sm ${m.akses ? 'text-slate-900' : 'text-slate-500'}`}>{m.label}</div>
                {!m.akses && <div className="text-xs text-slate-400">{ALASAN_MENU[m.alasan] || 'Tidak tersedia'}</div>}
              </div>
            </div>
          ))}
          {k.sebagai_penilai && !k.supervisi_selesai && (
            <p className="pt-3 text-xs text-amber-700">
              Lembar penilaian terbuka setelah kepala madrasah mencatat supervisi Anda pada periode ini.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
