import React, { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download, Globe2, ShieldCheck } from 'lucide-react';
import PilihUjian from '@/components/ujian/PilihUjian';
import PanelJejakAuditTautan from '@/components/ujian/tautan/PanelJejakAuditTautan';
import PanelRiwayatUnduhan from '@/components/ujian/berkas/PanelRiwayatUnduhan';
import { HALAMAN_BERANDA_UJIAN } from '@/lib/ujian';

const TAB = [
  { kode: 'akses', label: 'Akses tautan', Ikon: Globe2, keterangan: 'Pembukaan halaman info & monitoring publik, berhasil maupun ditolak.' },
  { kode: 'unduhan', label: 'Unduhan berkas', Ikon: Download, keterangan: 'Unduhan kisi-kisi publik, panduan CBT, serta unduhan & ZIP admin.' },
];

/**
 * Jejak Audit Publik (/ujian/audit-publik?ujian=<id>): riwayat akses tautan publik (info & monitoring) dan riwayat
 * unduhan berkas ujian dalam satu halaman — siapa/sumber (IP, perangkat), kapan, apa, dan hasilnya — mengikuti pola
 * jejak audit modul PKG. Admin & pemantau (pimpinan, ketua & sekretaris panitia) melihat; tidak ada yang dapat diubah.
 */
export default function UjianAuditPublikPage() {
  const [ujian, setUjian] = useState(null);
  const [tab, setTab] = useState('akses');
  const gantiUjian = useCallback((u) => setUjian(u), []);
  const aktif = TAB.find((t) => t.kode === tab);

  return (
    <div className="space-y-6" data-testid="ujian-audit-publik">
      <div>
        <Link to={HALAMAN_BERANDA_UJIAN} className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-[#006837] hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> Beranda Ujian
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 sm:text-3xl"><ShieldCheck className="h-7 w-7 text-[#006837]" /> Jejak Audit Publik</h1>
        <p className="mt-1 text-sm text-slate-600">Riwayat akses tautan publik dan unduhan berkas ujian. Gunakan untuk menelusuri akses mencurigakan.</p>
      </div>

      <PilihUjian onUbah={gantiUjian} />

      {ujian && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1" role="tablist" aria-label="Jenis jejak audit">
              {TAB.map((t) => (
                <button key={t.kode} type="button" role="tab" aria-selected={tab === t.kode} onClick={() => setTab(t.kode)} data-testid={`audit-tab-${t.kode}`}
                  className={`flex items-center justify-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium ${tab === t.kode ? 'bg-white text-[#006837] shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
                  <t.Ikon className="h-4 w-4" /> {t.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500">{aktif.keterangan}</p>
          </div>
          {tab === 'akses' ? <PanelJejakAuditTautan ujianId={ujian.id} /> : <PanelRiwayatUnduhan ujianId={ujian.id} />}
        </>
      )}
    </div>
  );
}
