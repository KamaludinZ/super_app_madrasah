import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { ChevronRight, DoorClosed, Loader2, Search } from 'lucide-react';
import { Langkah } from '@/components/ujian/publik/KerangkaPublik';

const STATUS_KUNCI = { hadir: 'Sudah hadir', izin: 'Izin', sakit: 'Sakit' };

/** Status penanda nama peserta: sudah hadir / izin / sakit pada sesi ini (tidak dapat dipilih). */
export const statusKunci = (p) => (p.sudah_hadir ? 'hadir' : (p.status === 'izin' || p.status === 'sakit' ? p.status : null));

function gulirKe(ref) {
  // Langkah berikutnya digulir ke layar (ponsel) tanpa mengganggu pengguna yang memilih pengurangan gerak.
  const halus = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  setTimeout(() => ref.current?.scrollIntoView({ behavior: halus ? 'smooth' : 'auto', block: 'start' }), 50);
}

/**
 * Pemilih bertingkat Ruangan -> Kelas -> Nama untuk formulir publik. Kelas & nama hanya dari peserta yang terdaftar di
 * ruang itu (bukan seluruh siswa). Ruang/kelas tunggal dipilih otomatis; nama dapat dicari; nama yang sudah hadir,
 * izin, atau sakit pada sesi ini ditandai dan tidak dapat dipilih. Ringkasan pilihan tampil sebagai jejak (breadcrumb).
 *
 * Props: ruangList [{ id, nama_ruang, jenjang }], muatPeserta(ruang) -> Promise<{ kelas, peserta }>,
 *        onPilih(peserta | null, { ruang, kelas }), nomorAwal (nomor langkah pertama).
 */
export default function PemilihPesertaBertingkat({ ruangList = [], muatPeserta, onPilih, nomorAwal = 1, segarkan = 0 }) {
  const [ruang, setRuang] = useState(null);
  const [daftar, setDaftar] = useState(null);
  const [memuat, setMemuat] = useState(false);
  const [kelas, setKelas] = useState(null);
  const [peserta, setPeserta] = useState(null);
  const [cari, setCari] = useState('');
  const refKelas = useRef(null);
  const refNama = useRef(null);

  // Muat peserta ruang (juga saat `segarkan` berubah, mis. setelah kiriman ditolak karena sudah hadir).
  useEffect(() => {
    if (!ruang) return undefined;
    let hidup = true;
    setMemuat(true);
    muatPeserta(ruang)
      .then((d) => { if (hidup) setDaftar(d); })
      .finally(() => { if (hidup) setMemuat(false); });
    return () => { hidup = false; };
  }, [ruang, muatPeserta, segarkan]);

  // Daftar disegarkan (mis. kiriman ditolak karena sudah hadir): pilihan nama dilepas agar status terbaru terlihat.
  useEffect(() => { if (segarkan) setPeserta(null); }, [segarkan]);

  // Satu-satunya ruang/kelas dipilih otomatis.
  useEffect(() => { if (!ruang && ruangList.length === 1) setRuang(ruangList[0]); }, [ruangList, ruang]);
  useEffect(() => { if (daftar && !kelas && daftar.kelas.length === 1) setKelas(daftar.kelas[0].kelas); }, [daftar, kelas]);

  const pilihRuang = (r) => {
    if (r.id === ruang?.id) return;
    setRuang(r); setDaftar(null); setKelas(null); setPeserta(null); setCari('');
    onPilih?.(null, { ruang: r, kelas: null });
    gulirKe(refKelas);
  };
  const pilihKelas = (k) => {
    setKelas(k); setPeserta(null); setCari('');
    onPilih?.(null, { ruang, kelas: k });
    gulirKe(refNama);
  };
  const pilihNama = (p) => { setPeserta(p); onPilih?.(p, { ruang, kelas }); };

  const pesertaKelas = useMemo(() => {
    const q = cari.toLowerCase().trim();
    return (daftar?.peserta || []).filter((p) => p.kelas === kelas && (!q || `${p.nama} ${p.nomor_peserta || ''}`.toLowerCase().includes(q)));
  }, [daftar, kelas, cari]);

  return (
    <>
      {(ruang || kelas || peserta) && (
        <nav aria-label="Pilihan Anda" className="flex flex-wrap items-center gap-1 text-xs text-slate-600" data-testid="jejak-pilihan">
          {ruang && <button type="button" className="rounded-full bg-white px-2.5 py-1 ring-1 ring-slate-200 hover:ring-[#006837]" onClick={() => { setRuang(null); setDaftar(null); setKelas(null); setPeserta(null); onPilih?.(null, {}); }}>Ruang {ruang.nama_ruang}</button>}
          {kelas && <><ChevronRight className="h-3 w-3" /><button type="button" className="rounded-full bg-white px-2.5 py-1 ring-1 ring-slate-200 hover:ring-[#006837]" onClick={() => { setKelas(null); setPeserta(null); onPilih?.(null, { ruang }); }}>Kelas {kelas}</button></>}
          {peserta && <><ChevronRight className="h-3 w-3" /><span className="rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-[#006837] ring-1 ring-emerald-200">{peserta.nama}</span></>}
        </nav>
      )}

      <Langkah nomor={nomorAwal} judul="Pilih ruangan" selesai={!!ruang}>
        {ruangList.length === 0 ? <p className="text-sm text-slate-500">Belum ada ruang ujian.</p> : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" role="group" aria-label="Ruangan">
            {ruangList.map((r) => (
              <button key={r.id} type="button" onClick={() => pilihRuang(r)} aria-pressed={ruang?.id === r.id}
                className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006837] ${
                  ruang?.id === r.id ? 'border-[#006837] bg-emerald-50 font-semibold text-[#006837]' : 'border-slate-200 hover:border-[#006837]/40'}`}
                data-testid={`dh-ruang-${r.id}`}>
                <DoorClosed className="h-5 w-5" /> Ruang {r.nama_ruang}
                <span className="text-[11px] font-normal text-slate-500">Kelas {r.jenjang.join(' + ')}</span>
              </button>
            ))}
          </div>
        )}
      </Langkah>

      {ruang && (
        <div ref={refKelas} className="scroll-mt-4">
          <Langkah nomor={nomorAwal + 1} judul="Pilih kelas" selesai={!!kelas}>
            {memuat && !daftar ? <Loader2 className="h-5 w-5 animate-spin text-[#006837]" /> : daftar?.kelas.length === 0 ? (
              <p className="text-sm text-slate-500">Ruang ini belum berisi peserta. Hubungi panitia.</p>
            ) : (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Kelas">
                {(daftar?.kelas || []).map((k) => (
                  <button key={k.kelas} type="button" onClick={() => pilihKelas(k.kelas)} aria-pressed={kelas === k.kelas}
                    className={`rounded-full border px-4 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006837] ${
                      kelas === k.kelas ? 'border-[#006837] bg-[#006837] text-white' : 'border-slate-200 hover:bg-emerald-50'}`}
                    data-testid={`dh-kelas-${k.kelas}`}>
                    {k.kelas} <span className="opacity-70">({k.jumlah})</span>
                  </button>
                ))}
              </div>
            )}
          </Langkah>
        </div>
      )}

      {kelas && (
        <div ref={refNama} className="scroll-mt-4">
          <Langkah nomor={nomorAwal + 2} judul="Pilih nama Anda" keterangan="Hanya peserta yang terdaftar di ruang ini." selesai={!!peserta}>
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari nama atau nomor peserta…" className="h-11 pl-9" aria-label="Cari nama" />
            </div>
            {pesertaKelas.length === 0 ? <p className="py-4 text-center text-sm text-slate-500">Nama tidak ditemukan.</p> : (
              <ul className="max-h-[26rem] divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200" role="listbox" aria-label="Nama peserta">
                {pesertaKelas.map((p) => {
                  const kunci = statusKunci(p);
                  return (
                    <li key={p.id}>
                      <button type="button" role="option" aria-selected={peserta?.id === p.id} aria-disabled={!!kunci} disabled={!!kunci}
                        onClick={() => pilihNama(p)}
                        className={`flex w-full items-center gap-3 px-3 py-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#006837] ${
                          peserta?.id === p.id ? 'bg-emerald-50' : kunci ? 'cursor-not-allowed opacity-60' : 'hover:bg-slate-50'}`}
                        data-testid={`dh-peserta-${p.id}`}>
                        <span className="w-20 shrink-0 font-mono text-xs text-slate-500">{p.nomor_peserta || '—'}</span>
                        <span className="min-w-0 flex-1 truncate text-slate-900">{p.nama}</span>
                        {kunci && (
                          <span className={`shrink-0 rounded px-2 py-0.5 text-[11px] font-semibold ${kunci === 'hadir' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                            {STATUS_KUNCI[kunci]}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Langkah>
        </div>
      )}
    </>
  );
}
