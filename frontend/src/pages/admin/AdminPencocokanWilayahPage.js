import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Check, ChevronLeft, ChevronRight, Loader2, MapPinned, Pencil, RefreshCw, Search, Wand2, X } from 'lucide-react';
import PerbaikiWilayahDialog from './PerbaikiWilayahDialog';
import { toast } from 'sonner';
import { FILTER_STATUS, LABEL_TINGKAT_TEKS, STATUS_PENCOCOKAN, UKURAN_HALAMAN, barisDiperbaiki, gantiBaris, muatPencocokan, saranYakin, teksRantai, terapkanPerbaikan } from '@/lib/pencocokanWilayah';

/** Alamat asli per tingkat: hijau = cocok master, merah = tidak cocok, abu = belum diperiksa/kosong. */
function AlamatPerTingkat({ teks = {}, cocok = {} }) {
  const ada = LABEL_TINGKAT_TEKS.filter(([k]) => teks[k]);
  if (!ada.length) return <span className="italic text-slate-400">-</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {ada.map(([k, l]) => {
        const c = cocok?.[k];
        const kelas = c === true ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : c === false ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-slate-200 bg-slate-50 text-slate-600';
        return (
          <span key={k} className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs ${kelas}`} title={c === true ? 'Cocok dengan master' : c === false ? 'Tidak ditemukan di master' : 'Belum diperiksa'}>
            {c === true && <Check className="h-3 w-3" />}{c === false && <X className="h-3 w-3" />}
            <span className="text-[10px] opacity-70">{l}</span> {teks[k]}
          </span>
        );
      })}
    </div>
  );
}

const KARTU = [
  { key: 'total', label: 'Total alamat', kelas: 'text-slate-900', filter: 'semua' },
  { key: 'cocok', label: 'Berhasil cocok', kelas: 'text-emerald-700', filter: 'cocok' },
  { key: 'sebagian', label: 'Cocok sebagian', kelas: 'text-amber-700', filter: 'sebagian' },
  { key: 'tidak_cocok', label: 'Gagal cocok', kelas: 'text-rose-700', filter: 'tidak_cocok' },
  { key: 'tanpa_alamat', label: 'Tanpa alamat', kelas: 'text-slate-500', filter: 'tanpa_alamat' },
];

/** Bilah proporsi cocok / sebagian / tidak cocok / tanpa alamat. */
function BilahRingkasan({ r }) {
  if (!r?.total) return null;
  const pct = (n) => `${((n || 0) / r.total) * 100}%`;
  const persenCocok = Math.round(((r.cocok || 0) / r.total) * 100);
  return (
    <div className="space-y-1" data-testid="bilah-ringkasan-pencocokan">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div className="bg-emerald-500" style={{ width: pct(r.cocok) }} />
        <div className="bg-amber-400" style={{ width: pct(r.sebagian) }} />
        <div className="bg-rose-500" style={{ width: pct(r.tidak_cocok) }} />
        <div className="bg-slate-300" style={{ width: pct(r.tanpa_alamat) }} />
      </div>
      <div className="text-xs text-slate-600">
        {persenCocok}% alamat sudah cocok dengan master wilayah; {((r.sebagian || 0) + (r.tidak_cocok || 0)).toLocaleString('id-ID')} baris perlu diperbaiki.
      </div>
    </div>
  );
}

/**
 * Laporan pencocokan wilayah: alamat siswa/GTK hasil impor (ketikan bebas) dibandingkan dengan master
 * wilayah, menampilkan baris yang tidak/sebagian cocok beserta saran wilayah terdekat.
 */
export default function AdminPencocokanWilayahPage() {
  const [filter, setFilter] = useState({ jenis: 'semua', status: 'perlu', q: '' });
  const [cari, setCari] = useState('');
  const [data, setData] = useState({ ringkasan: null, items: [], tiruan: false });
  const [memuat, setMemuat] = useState(true);
  const [halaman, setHalaman] = useState(1);
  const [diperbaiki, setDiperbaiki] = useState(null); // baris yang sedang diperbaiki

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      setData(await muatPencocokan(filter));
      setHalaman(1);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal memuat laporan pencocokan wilayah');
    } finally {
      setMemuat(false);
    }
  }, [filter]);

  useEffect(() => { muat(); }, [muat]);
  useEffect(() => {
    const t = setTimeout(() => setFilter((f) => (f.q === cari ? f : { ...f, q: cari })), 350);
    return () => clearTimeout(t);
  }, [cari]);

  const { ringkasan, items, tiruan } = data;

  const [proses, setProses] = useState(null); // kunci baris yang sedang disimpan, atau 'massal'
  const kunci = (b) => `${b.id}|${b.blok}`;

  /** Simpan perbaikan [{ baris, kode_wilayah, kode_pos, rantai }] lalu ubah status barisnya di tabel. */
  const terapkan = async (daftar) => {
    const r = await terapkanPerbaikan(daftar);
    const pasangan = [];
    let gagal = 0;
    daftar.forEach(({ baris, ...pilihan }) => {
      const h = r.hasil.find((x) => x.id === baris.id && x.blok === baris.blok);
      if (h?.status === 'berhasil') pasangan.push([baris, h.baris || barisDiperbaiki(baris, pilihan)]);
      else gagal += 1;
    });
    if (pasangan.length) setData((d) => gantiBaris(d, pasangan));
    return { berhasil: pasangan.length, gagal, tiruan: r.tiruan, pesan: r.hasil.find((x) => x.status !== 'berhasil')?.pesan };
  };

  const simpanPerbaikan = async (baris, pilihan) => {
    setProses(kunci(baris));
    try {
      const h = await terapkan([{ baris, ...pilihan }]);
      if (!h.berhasil) { toast.error(h.pesan || 'Perbaikan wilayah gagal disimpan'); return; }
      toast.success(`Wilayah ${baris.nama} disimpan${h.tiruan ? ' (contoh, belum tersimpan di server)' : ''}`);
      setDiperbaiki(null);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Perbaikan wilayah gagal disimpan');
    } finally {
      setProses(null);
    }
  };

  const pakaiSaran = (baris, s) => simpanPerbaikan(baris, { kode_wilayah: s.kode, kode_pos: s.kode_pos || '', rantai: s.rantai });

  const daftarYakin = items.filter((it) => !it._diperbaiki && saranYakin(it));
  const terapkanSemuaSaran = async () => {
    setProses('massal');
    try {
      const h = await terapkan(daftarYakin.map((b) => { const s = saranYakin(b); return { baris: b, kode_wilayah: s.kode, kode_pos: s.kode_pos || '', rantai: s.rantai }; }));
      if (h.gagal) toast.warning(`${h.berhasil} baris diperbaiki, ${h.gagal} gagal${h.pesan ? `: ${h.pesan}` : ''}`);
      else toast.success(`${h.berhasil} baris diperbaiki dengan saran teratas${h.tiruan ? ' (contoh)' : ''}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menerapkan saran');
    } finally {
      setProses(null);
    }
  };
  const jumlahHalaman = Math.max(1, Math.ceil(items.length / UKURAN_HALAMAN));
  const awal = (Math.min(halaman, jumlahHalaman) - 1) * UKURAN_HALAMAN;
  const tampil = items.slice(awal, awal + UKURAN_HALAMAN);

  return (
    <div className="space-y-6" data-testid="admin-pencocokan-wilayah-page">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <MapPinned className="h-3 w-3 mr-1" /> Pencocokan Wilayah
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Laporan Pencocokan Wilayah Impor</h1>
          <p className="text-sm text-slate-600 mt-1">
            Alamat siswa & GTK hasil impor dicocokkan dengan <Link to="/admin/master-wilayah" className="text-[#006837] underline">master wilayah</Link>.
            Baris yang tidak cocok perlu diperbaiki agar kode wilayah tersimpan.
          </p>
        </div>
        <Button variant="outline" onClick={muat} disabled={memuat} className="gap-2" data-testid="btn-muat-ulang-pencocokan">
          {memuat ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Muat Ulang
        </Button>
      </div>

      {tiruan && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Server belum menyediakan pencocokan wilayah — menampilkan data contoh untuk mencoba alur.
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2" data-testid="ringkasan-pencocokan">
        {KARTU.map((k) => (
          <Card key={k.key} role="button" tabIndex={0} onClick={() => setFilter((f) => ({ ...f, status: k.filter }))}
            onKeyDown={(e) => { if (e.key === 'Enter') setFilter((f) => ({ ...f, status: k.filter })); }}
            className={`cursor-pointer transition hover:border-[#006837]/40 ${filter.status === k.filter ? 'ring-2 ring-[#006837]/40' : ''}`}
            data-testid={`kartu-pencocokan-${k.key}`}>
            <CardContent className="px-3 py-2">
              <div className="text-xs text-slate-500">{k.label}</div>
              <div className={`text-xl font-bold tabular-nums ${k.kelas}`}>{ringkasan ? (ringkasan[k.key] ?? 0).toLocaleString('id-ID') : '-'}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <BilahRingkasan r={ringkasan} />

      {daftarYakin.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900" data-testid="saran-massal">
          <span>{daftarYakin.length.toLocaleString('id-ID')} baris punya saran dengan kemiripan tinggi (≥ 85%).</span>
          <Button size="sm" onClick={terapkanSemuaSaran} disabled={!!proses} className="h-7 gap-1 bg-[#006837] hover:bg-[#005830]" data-testid="btn-terapkan-semua-saran">
            {proses === 'massal' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />} Terapkan semua saran
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Select value={filter.jenis} onValueChange={(v) => setFilter((f) => ({ ...f, jenis: v }))}>
          <SelectTrigger className="w-36" data-testid="filter-jenis-pencocokan"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="semua">Siswa & GTK</SelectItem>
            <SelectItem value="siswa">Siswa</SelectItem>
            <SelectItem value="gtk">GTK</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filter.status} onValueChange={(v) => setFilter((f) => ({ ...f, status: v }))}>
          <SelectTrigger className="w-72" data-testid="filter-status-pencocokan"><SelectValue /></SelectTrigger>
          <SelectContent>
            {FILTER_STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[12rem]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari nama atau alamat..." className="pl-9" data-testid="cari-pencocokan" />
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table data-testid="tabel-pencocokan">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">No</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Alamat Asli (impor)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Saran Master Wilayah</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {memuat && items.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-slate-500"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></TableCell></TableRow>
              ) : items.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-slate-500">Tidak ada baris untuk filter ini</TableCell></TableRow>
              ) : tampil.map((it, j) => {
                const i = awal + j;
                const st = STATUS_PENCOCOKAN[it.status] || STATUS_PENCOCOKAN.tidak_cocok;
                return (
                  <TableRow key={`${it.id}-${it.blok}`} data-testid={`baris-pencocokan-${i}`}>
                    <TableCell className="text-slate-500">{i + 1}</TableCell>
                    <TableCell>
                      <div className="font-medium text-slate-900">{it.nama}</div>
                      <div className="text-xs text-slate-500">{it.jenis === 'gtk' ? 'GTK' : 'Siswa'}{it.keterangan ? ` · ${it.keterangan}` : ''} · {it.label_blok}</div>
                    </TableCell>
                    <TableCell className="max-w-sm text-sm text-slate-700"><AlamatPerTingkat teks={it.teks} cocok={it.tingkat_cocok} /></TableCell>
                    <TableCell>
                      <Badge variant="outline" className={st.kelas}>{st.label}</Badge>
                      {it._diperbaiki && <Badge variant="outline" className="ml-1 border-sky-200 bg-sky-50 text-sky-700">Baru diperbaiki</Badge>}
                      {it.alasan && it.status !== 'cocok' && <div className="mt-1 max-w-[14rem] text-xs text-slate-500">{it.alasan}</div>}
                    </TableCell>
                    <TableCell className="max-w-xs text-sm">
                      {it.saran?.length ? (
                        <div>
                          <div className="text-slate-800">{teksRantai(it.saran[0].rantai)}</div>
                          <div className="text-xs text-slate-500">
                            {it.saran[0].kode_pos && <span className="font-mono">{it.saran[0].kode_pos} · </span>}
                            kemiripan {Math.round((it.saran[0].skor || 0) * 100)}%{it.saran.length > 1 ? ` · +${it.saran.length - 1} saran lain` : ''}
                          </div>
                        </div>
                      ) : <span className="text-xs text-slate-400">{it.status === 'cocok' ? 'Sudah sesuai master' : 'Tidak ada saran'}</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-stretch gap-1">
                        {saranYakin(it) && (
                          <Button size="sm" className="h-7 gap-1 bg-[#006837] hover:bg-[#005830]" disabled={!!proses} onClick={() => pakaiSaran(it, saranYakin(it))} data-testid={`btn-pakai-saran-${i}`}>
                            {proses === kunci(it) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />} Pakai saran
                          </Button>
                        )}
                        <Button size="sm" variant={it.status === 'cocok' ? 'ghost' : 'outline'} className="h-7 gap-1" disabled={!!proses} onClick={() => setDiperbaiki(it)} data-testid={`btn-perbaiki-${i}`}>
                          <Pencil className="h-3.5 w-3.5" /> {it.status === 'cocok' ? 'Ubah' : 'Perbaiki'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <PerbaikiWilayahDialog baris={diperbaiki} onTutup={() => setDiperbaiki(null)} onSimpan={simpanPerbaikan} />

      {items.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500" data-testid="halaman-pencocokan">
          <span>Baris {(awal + 1).toLocaleString('id-ID')}–{(awal + tampil.length).toLocaleString('id-ID')} dari {items.length.toLocaleString('id-ID')}</span>
          {jumlahHalaman > 1 && (
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" disabled={halaman <= 1} onClick={() => setHalaman((h) => h - 1)}><ChevronLeft className="h-4 w-4" /></Button>
              <span className="px-2">Hal. {Math.min(halaman, jumlahHalaman)} / {jumlahHalaman}</span>
              <Button size="sm" variant="outline" disabled={halaman >= jumlahHalaman} onClick={() => setHalaman((h) => h + 1)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
