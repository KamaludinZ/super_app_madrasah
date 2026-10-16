import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ListChecks, Loader2, Pencil, Plus, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { bolehInputTatib, pesanGalatTatib, tolakUbahTatib } from '@/lib/aksesTatib';
import { formatPoin } from '@/components/tatib/RingkasanPoin';
import BannerModeLihat from '@/components/tatib/BannerModeLihat';
import FormJenisAturan from '@/components/tatib/FormJenisAturan';
import PilihKategoriTatib from '@/components/tatib/PilihKategoriTatib';
import { ambilKategoriMaster, ambilMasterJenis, simpanKategoriMaster, simpanMasterJenis } from '@/lib/masterJenisTatib';

// Master Jenis Pelanggaran: daftar jenis aturan (pelanggaran & kebaikan) beserta kode, kategori,
// jalur, dan besar poin yang dipakai otomatis saat mencatat di Input Tata Tertib.
export default function TatibMasterJenisPage() {
  const { activeRole } = useAuth();
  const bolehUbah = bolehInputTatib(activeRole);
  const [jenisList, setJenisList] = useState([]);
  const [kategoriList, setKategoriList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ open: false, jenis: null });
  const [cari, setCari] = useState('');
  const [filterKategori, setFilterKategori] = useState('');

  // Pencarian tanpa beda huruf pada kode aturan dan nama jenis (semua kata harus cocok).
  const tersaring = useMemo(() => {
    const kata = cari.toLowerCase().split(/\s+/).filter(Boolean);
    return jenisList.filter((j) => {
      if (filterKategori && j.kategori_id !== filterKategori) return false;
      const teks = `${j.kode_aturan} ${j.nama}`.toLowerCase();
      return kata.every((k) => teks.includes(k));
    });
  }, [jenisList, cari, filterKategori]);

  const jumlahPerKategori = useMemo(() => {
    const n = {};
    jenisList.forEach((j) => { n[j.kategori_id] = (n[j.kategori_id] || 0) + 1; });
    return n;
  }, [jenisList]);

  const tambahKategori = async (isian) => {
    const baru = await simpanKategoriMaster(isian);
    setKategoriList(await ambilKategoriMaster());
    return baru;
  };

  useEffect(() => {
    Promise.all([ambilMasterJenis(), ambilKategoriMaster()])
      .then(([jenis, kategori]) => {
        setJenisList(jenis);
        setKategoriList(kategori);
      })
      .catch((e) => toast.error(pesanGalatTatib(e, 'Gagal memuat master jenis pelanggaran')))
      .finally(() => setLoading(false));
  }, []);

  const bukaForm = (jenis = null) => {
    if (tolakUbahTatib(activeRole)) return;
    setForm({ open: true, jenis });
  };

  const simpan = async (isian) => {
    const hasil = await simpanMasterJenis(isian);
    setJenisList(await ambilMasterJenis());
    return hasil;
  };

  return (
    <div className="p-6 space-y-6" data-testid="tatib-master-jenis-page">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ListChecks className="h-6 w-6" /> Master Jenis Pelanggaran
          </h1>
          <p className="text-sm text-slate-600">
            Daftar jenis aturan beserta kode, kategori, jalur, dan besar poin. Poin di sini dipakai otomatis saat mencatat tata tertib.
          </p>
        </div>
        {bolehUbah && (
          <Button onClick={() => bukaForm()} data-testid="master-jenis-tambah">
            <Plus className="h-4 w-4 mr-2" /> Tambah Jenis
          </Button>
        )}
      </div>

      {!bolehUbah && <BannerModeLihat />}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder="Cari kode atau nama jenis…"
            className="pl-9 pr-9"
            aria-label="Cari kode atau nama jenis"
            data-testid="master-jenis-cari"
          />
          {cari && (
            <button type="button" onClick={() => setCari('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700" aria-label="Kosongkan pencarian">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {!loading && (
          <span className="text-sm text-slate-500" data-testid="master-jenis-jumlah">
            {cari || filterKategori ? `${tersaring.length} dari ${jenisList.length} jenis` : `${jenisList.length} jenis`}
          </span>
        )}
      </div>

      {kategoriList.length > 0 && (
        <PilihKategoriTatib
          kategoriList={kategoriList}
          value={filterKategori}
          onPilih={setFilterKategori}
          jumlahJenis={jumlahPerKategori}
          testid="master-jenis-kategori"
        />
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center p-8 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Memuat data...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kode</TableHead>
                    <TableHead>Nama Jenis</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Jalur</TableHead>
                    <TableHead className="text-right">Besar Poin</TableHead>
                    <TableHead>Status</TableHead>
                    {bolehUbah && <TableHead className="w-16 text-right">Aksi</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tersaring.map((j) => (
                    <TableRow key={j.id} className={j.aktif ? '' : 'text-slate-400'} data-testid={`master-jenis-${j.id}`}>
                      <TableCell className="font-mono text-xs font-semibold">{j.kode_aturan}</TableCell>
                      <TableCell>
                        <div className="font-medium">{j.nama}</div>
                        {j.deskripsi && <div className="text-xs text-slate-500 line-clamp-1">{j.deskripsi}</div>}
                      </TableCell>
                      <TableCell>{j.kategori_nama}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={j.jalur_poin === 'minus' ? 'border-red-200 text-red-700' : 'border-emerald-200 text-emerald-700'}>
                          {j.jalur_poin === 'minus' ? 'Minus (pelanggaran)' : 'Plus (kebaikan)'}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-right font-semibold tabular-nums ${j.poin < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                        {formatPoin(j.poin)}
                      </TableCell>
                      <TableCell>
                        {j.aktif ? <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Aktif</Badge> : <Badge variant="secondary">Nonaktif</Badge>}
                      </TableCell>
                      {bolehUbah && (
                        <TableCell className="text-right">
                          <Button size="icon" variant="ghost" onClick={() => bukaForm(j)} aria-label={`Ubah ${j.kode_aturan}`} data-testid={`master-jenis-ubah-${j.id}`}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {tersaring.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={bolehUbah ? 7 : 6} className="py-8 text-center text-slate-500">
                        {jenisList.length === 0 ? 'Belum ada jenis aturan.' : 'Tidak ada jenis yang cocok dengan pencarian/kategori.'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <FormJenisAturan
        open={form.open}
        onOpenChange={(open) => setForm((f) => ({ ...f, open }))}
        jenis={form.jenis}
        kategoriList={kategoriList}
        onSimpan={simpan}
        onTambahKategori={tambahKategori}
      />
    </div>
  );
}
