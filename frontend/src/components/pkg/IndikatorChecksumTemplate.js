import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, ShieldAlert, Check, X } from 'lucide-react';
import { ambilInfoTemplate } from '@/lib/pkgTemplate';

const ringkas = (c) => (c ? `${c.slice(0, 12)}…${c.slice(-8)}` : '—');

// Ringkasan kecocokan seluruh berkas template: { cocok, jumlah, bermasalah }.
export function ringkasKecocokan(berkas = []) {
  const bermasalah = berkas.filter((b) => b.status !== 'cocok');
  return { cocok: bermasalah.length === 0, jumlah: berkas.length, bermasalah: bermasalah.length };
}

// Lencana ringkas di kepala modul PKG: hijau bila semua checksum cocok, merah bila ada berkas berubah/hilang.
// Memuat GET /pkg/template/info sendiri; tidak tampil apa-apa bila gagal dimuat.
export function LencanaTemplate() {
  const [ringkasan, setRingkasan] = useState(null);
  useEffect(() => {
    let hidup = true;
    ambilInfoTemplate().then((info) => { if (hidup) setRingkasan({ ...ringkasKecocokan(info.berkas), versi: info.versi_template }); }).catch(() => {});
    return () => { hidup = false; };
  }, []);
  if (!ringkasan) return null;
  const { cocok, bermasalah, versi } = ringkasan;
  return (
    <Link
      to="/pkg/template"
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${cocok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}
      title={cocok ? 'Semua checksum berkas template cocok' : `${bermasalah} berkas template bermasalah`}
      data-testid="pkg-lencana-template"
    >
      {cocok ? <ShieldCheck className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
      Template {versi}{cocok ? '' : ` · ${bermasalah} bermasalah`}
    </Link>
  );
}

// Perbandingan checksum satu berkas: checksum di server vs checksum resmi, dengan tanda cocok/tidak.
export default function IndikatorChecksumTemplate({ berkas }) {
  const cocok = berkas.status === 'cocok';
  const Ikon = cocok ? Check : X;
  return (
    <div
      className={`rounded-lg border p-2.5 text-xs ${cocok ? 'border-emerald-200 bg-emerald-50/60' : 'border-rose-200 bg-rose-50/60'}`}
      role="status"
      aria-label={cocok ? 'Checksum cocok dengan checksum resmi' : 'Checksum tidak cocok dengan checksum resmi'}
      data-testid={`pkg-checksum-${berkas.jenis}`}
    >
      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <span className="text-slate-500">Berkas server</span>
        <span className="font-mono text-slate-800 break-all" title={berkas.checksum || ''}>{berkas.status === 'hilang' ? 'tidak ditemukan' : ringkas(berkas.checksum)}</span>
        <span className="text-slate-500">Resmi</span>
        <span className="font-mono text-slate-800 break-all" title={berkas.checksum_resmi || ''}>{ringkas(berkas.checksum_resmi)}</span>
      </div>
      <div className={`mt-1.5 flex items-center gap-1 font-semibold ${cocok ? 'text-emerald-700' : 'text-rose-700'}`}>
        <Ikon className="h-3.5 w-3.5" /> {cocok ? 'Cocok — berkas utuh' : berkas.status === 'hilang' ? 'Berkas hilang' : 'Tidak cocok — berkas berubah'}
      </div>
    </div>
  );
}
