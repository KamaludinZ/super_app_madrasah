import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, FileUp, Info, Loader2, Lock, RefreshCw, UserRound } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import AksesDitolak from '@/components/security/AksesDitolak';
import SlotBerkas from '@/components/ujian/berkas/SlotBerkas';
import { aksesDitolak, pesanGalat } from '@/lib/ujian';
import { JENIS_BERKAS_UNGGAH, muatBerkasSaya } from '@/lib/ujianBerkas';
import { JENJANG_UJIAN, MAPEL_UJIAN_BAKU, labelJenjang } from '@/lib/mapelUjian';

const urutanMapel = Object.fromEntries(MAPEL_UJIAN_BAKU.map((m, i) => [m.kode, i]));
const jumlahTerkirim = (t) => JENIS_BERKAS_UNGGAH.filter((j) => t[j]).length;

function LencanaLengkap({ tugas }) {
  const n = jumlahTerkirim(tugas);
  const lengkap = n === JENIS_BERKAS_UNGGAH.length;
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${lengkap ? 'bg-emerald-50 text-[#006837]' : n ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-500'}`}
      data-testid={`tugas-${tugas.jenjang}-${tugas.mapel}-lengkap`}>
      {lengkap ? 'Lengkap' : `${n} dari ${JENIS_BERKAS_UNGGAH.length}`}
    </span>
  );
}

/** PJ bawaan satu mapel: PJ berkas yang sudah terkirim, lalu pengguna sendiri bila namanya ada di daftar guru. */
const pjBawaan = (t, guru, saya) => t.kisi_kisi?.guru_pj_id || t.kartu_soal?.guru_pj_id || (guru.some((g) => g.id === saya) ? saya : '');

function KartuTugas({ tugas, guru, saya, onTerunggah }) {
  const [pj, setPj] = useState(() => pjBawaan(tugas, guru, saya));
  const id = `pj-${tugas.jenjang}-${tugas.mapel}`;
  return (
    <Card data-testid={`tugas-${tugas.jenjang}-${tugas.mapel}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-base">{tugas.nama_mapel} · {labelJenjang(tugas.jenjang)}</CardTitle>
        <LencanaLengkap tugas={tugas} />
      </CardHeader>
      <CardContent className="space-y-3">
        <label htmlFor={id} className="flex flex-col gap-1 text-xs font-medium text-slate-700 sm:flex-row sm:items-center sm:gap-2">
          <span className="flex shrink-0 items-center gap-1"><UserRound className="h-3.5 w-3.5 text-slate-400" /> Guru PJ</span>
          <select id={id} value={pj} onChange={(e) => setPj(e.target.value)} data-testid={id}
            className={`h-9 min-w-0 flex-1 rounded-md border bg-white px-2 text-sm font-normal text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006837] ${pj ? 'border-slate-200' : 'border-amber-300'}`}>
            <option value="">— Pilih nama guru PJ —</option>
            {guru.map((g) => <option key={g.id} value={g.id}>{g.nama}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {JENIS_BERKAS_UNGGAH.map((jenis) => (
            <SlotBerkas key={jenis} ujianId={tugas.ujian_id} tugas={tugas} jenis={jenis} guruPjId={pj} guru={guru} onTerunggah={onTerunggah} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Formulir Unggah Berkas Ujian (/ujian/unggah-berkas, wajib login — semua GTK): kisi-kisi (PDF) dan kartu soal (PDF/DOCX,
 * maks. 10 MB) per mapel baku per jenjang pada ujian semester aktif. Tidak ada penugasan PJ: pengisi memilih nama guru PJ
 * dari daftar guru pada tiap mapel. Unggah ulang menimpa berkas lama; status monitoring publik langsung berubah.
 * Kartu soal rahasia — hanya admin yang dapat membukanya.
 */
export default function UjianUnggahBerkasPage() {
  const [data, setData] = useState(null);
  const [ujianId, setUjianId] = useState('');
  const [jenjang, setJenjang] = useState(JENJANG_UJIAN[0]);
  const [hanyaBelum, setHanyaBelum] = useState(false);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState('');
  const [ditolak, setDitolak] = useState('');

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      const d = await muatBerkasSaya();
      setData(d);
      setUjianId((u) => (d.ujian?.some((x) => x.id === u) ? u : d.ujian?.[0]?.id || ''));
      setGalat(''); setDitolak('');
    } catch (e) {
      if (aksesDitolak(e)) setDitolak(pesanGalat(e, 'Akses ditolak.'));
      else setGalat(pesanGalat(e, 'Gagal memuat formulir unggah.'));
    } finally {
      setMemuat(false);
    }
  }, []);
  useEffect(() => { muat(); }, [muat]);

  const tugasUjian = useMemo(() => (data?.tugas || []).filter((t) => t.ujian_id === ujianId), [data, ujianId]);
  const tampil = tugasUjian.filter((t) => t.jenjang === jenjang && (!hanyaBelum || jumlahTerkirim(t) < JENIS_BERKAS_UNGGAH.length))
    .sort((a, b) => (urutanMapel[a.mapel] ?? 99) - (urutanMapel[b.mapel] ?? 99));
  const jumlahSlot = tugasUjian.length * JENIS_BERKAS_UNGGAH.length;
  const terkirim = tugasUjian.reduce((n, t) => n + jumlahTerkirim(t), 0);
  const lengkapJenjang = (j) => tugasUjian.filter((t) => t.jenjang === j && jumlahTerkirim(t) === JENIS_BERKAS_UNGGAH.length).length;
  const totalJenjang = (j) => tugasUjian.filter((t) => t.jenjang === j).length;

  const terunggah = (tugas, jenis, berkas, tiruan) => setData((d) => ({
    ...d, tiruan: d.tiruan || tiruan,
    tugas: d.tugas.map((t) => (t.ujian_id === tugas.ujian_id && t.jenjang === tugas.jenjang && t.mapel === tugas.mapel ? { ...t, [jenis]: berkas } : t)),
  }));

  return (
    <div className="space-y-6" data-testid="ujian-unggah-berkas">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 sm:text-3xl">
            <FileUp className="h-7 w-7 text-[#006837]" /> Unggah Berkas Soal
          </h1>
          <p className="mt-1 text-sm text-slate-600">Kisi-kisi dan kartu soal tiap mata pelajaran. Pilih nama guru PJ, lalu unggah berkasnya.</p>
        </div>
        <Button variant="outline" onClick={muat} disabled={memuat} className="gap-2 self-start sm:self-auto" data-testid="btn-muat-ulang-berkas">
          {memuat ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Muat Ulang
        </Button>
      </div>

      <div className="grid gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900 sm:grid-cols-3" data-testid="aturan-unggah">
        <p className="flex gap-1.5"><Info className="h-4 w-4 shrink-0" /> Kisi-kisi wajib <strong>PDF</strong>; kartu soal <strong>PDF atau DOCX</strong>; maksimal <strong>10 MB</strong>.</p>
        <p className="flex gap-1.5"><RefreshCw className="h-4 w-4 shrink-0" /> Mengunggah ulang <strong>menggantikan</strong> berkas lama — tidak ada arsip ganda.</p>
        <p className="flex gap-1.5"><Lock className="h-4 w-4 shrink-0" /> Kartu soal <strong>rahasia</strong>: hanya admin yang dapat membukanya; publik hanya melihat statusnya.</p>
      </div>

      {ditolak && <AksesDitolak halaman="Unggah Berkas Soal" untuk="guru dan GTK yang login" pesan={ditolak} />}
      {data?.tiruan && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" data-testid="info-tiruan-berkas">
          Server belum menyediakan unggah berkas — menampilkan data contoh. Berkas tidak benar-benar tersimpan.
        </p>
      )}
      {galat && (
        <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800" role="alert">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {galat}
        </div>
      )}
      {!data && memuat && <div className="p-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-[#006837]" /></div>}

      {data && !ditolak && (!tugasUjian.length ? (
        <Card><CardContent className="py-10 text-center text-sm text-slate-500" data-testid="berkas-tanpa-tugas">
          Belum ada ujian pada semester aktif. Berkas soal dapat diunggah setelah admin membuat ujiannya.
        </CardContent></Card>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            {data.ujian?.length > 1 && (
              <label className="flex items-center gap-2 text-sm text-slate-700">
                Ujian
                <select value={ujianId} onChange={(e) => setUjianId(e.target.value)} data-testid="pilih-ujian-berkas"
                  className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm">
                  {data.ujian.map((u) => <option key={u.id} value={u.id}>{u.nama}</option>)}
                </select>
              </label>
            )}
            <div className="min-w-[12rem] flex-1 space-y-1.5">
              <p className="text-sm text-slate-600" data-testid="berkas-ringkas"><strong className="text-slate-900">{terkirim}</strong> dari {jumlahSlot} berkas sudah terkirim.</p>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={terkirim} aria-valuemin={0} aria-valuemax={jumlahSlot}
                aria-label="Berkas terkirim">
                <div className="h-full rounded-full bg-[#006837] transition-all" style={{ width: `${jumlahSlot ? Math.round((terkirim / jumlahSlot) * 100) : 0}%` }} />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1" role="tablist" aria-label="Jenjang">
              {JENJANG_UJIAN.map((j) => (
                <button key={j} type="button" role="tab" aria-selected={jenjang === j} onClick={() => setJenjang(j)} data-testid={`berkas-tab-${j}`}
                  className={`flex flex-col items-center rounded-md px-4 py-1.5 text-sm font-medium sm:flex-row sm:gap-1.5 ${jenjang === j ? 'bg-white text-[#006837] shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
                  {labelJenjang(j)}<span className="text-[10px] font-normal tabular-nums text-slate-500 sm:text-[11px]">{lengkapJenjang(j)}/{totalJenjang(j)} lengkap</span>
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" checked={hanyaBelum} onChange={(e) => setHanyaBelum(e.target.checked)} data-testid="berkas-hanya-belum" />
              Tampilkan yang belum lengkap saja
            </label>
          </div>

          {tampil.length ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" data-testid={`berkas-jenjang-${jenjang}`}>
              {tampil.map((t) => (
                <KartuTugas key={`${t.ujian_id}-${t.jenjang}-${t.mapel}`} tugas={t} guru={data.guru || []} saya={data.saya} onTerunggah={terunggah} />
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-8 text-center text-sm text-slate-500" data-testid="berkas-semua-lengkap">
              Semua mapel {labelJenjang(jenjang)} sudah lengkap.
            </p>
          )}
        </>
      ))}
    </div>
  );
}
