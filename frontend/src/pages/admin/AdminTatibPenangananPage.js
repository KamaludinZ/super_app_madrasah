import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Edit2, Trash2, Plus, Search, Loader2, ThumbsUp, ThumbsDown, ClipboardCheck } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { confirmDialog } from '@/components/ui/confirm-dialog';
import { formatPoin, nilaiPoin } from '@/components/tatib/RingkasanPoin';
import PanelPoinSiswa from '@/components/tatib/PanelPoinSiswa';
import TindakLanjutDialog from '@/components/tatib/TindakLanjutDialog';
import BannerModeLihat from '@/components/tatib/BannerModeLihat';
import FormPoinTatib from '@/components/tatib/FormPoinTatib';
import { useAuth } from '@/lib/AuthContext';
import { bolehInputTatib, bolehHapusTatib, tolakUbahTatib, pesanGalatTatib } from '@/lib/aksesTatib';
import { hariIniWIB } from '@/lib/tanggal';

// Dua jalur pencatatan poin yang dipisah tegas: kebaikan (PLUS) dan pelanggaran (MINUS).
// Poin kebaikan tidak terhubung ke data prestasi siswa.
const JALUR = {
  kebaikan: {
    label: 'Poin Kebaikan',
    tombol: 'Catat Poin Kebaikan',
    ikon: ThumbsUp,
    cocokAturan: (a) => (a.poin || 0) >= 0,
    kosong: 'Belum ada poin kebaikan yang dicatat',
  },
  pelanggaran: {
    label: 'Poin Pelanggaran',
    tombol: 'Catat Pelanggaran',
    ikon: ThumbsDown,
    cocokAturan: (a) => (a.poin || 0) < 0,
    kosong: 'Belum ada pelanggaran yang dicatat',
  },
};

// Catatan lama (sebelum migrasi) belum punya jenis_poin — turunkan dari nilainya.
const jenisCatatan = (p) => p.jenis_poin || (nilaiPoin(p) < 0 ? 'pelanggaran' : 'kebaikan');

const hariIni = () => hariIniWIB();
const formKosong = () => ({ siswa_id: '', tatib_id: '', tanggal: hariIni(), catatan: '' });

const AdminTatibPenangananPage = () => {
  const { activeRole } = useAuth();
  const bolehInput = bolehInputTatib(activeRole);
  const bolehHapus = bolehHapusTatib(activeRole);
  const [jalur, setJalur] = useState('pelanggaran');
  const [showFormPoin, setShowFormPoin] = useState(false);
  const [siswaPanel, setSiswaPanel] = useState(null);
  const [tindakLanjut, setTindakLanjut] = useState(null);
  const [penangananList, setPenangananList] = useState([]);
  const [studentsList, setStudentsList] = useState([]);
  const [aturanList, setAturanList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingPenanganan, setEditingPenanganan] = useState(null);

  // Filters
  const [filterKategori, setFilterKategori] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [penangananForm, setPenangananForm] = useState(formKosong);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [penangananRes, studentsRes, aturanRes] = await Promise.all([
        api.get('/tatib/penanganan'),
        api.get('/students'),
        api.get('/tatib/aturan'),
      ]);
      setPenangananList(penangananRes.data || []);
      setStudentsList(studentsRes.data || []);
      setAturanList(aturanRes.data || []);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (penanganan = null) => {
    if (tolakUbahTatib(activeRole)) return;
    // Catatan baru lewat formulir jalur (kebaikan/pelanggaran); modal lama hanya untuk mengubah.
    if (!penanganan) {
      setShowFormPoin(true);
      return;
    }
    if (penanganan) {
      setEditingPenanganan(penanganan);
      setPenangananForm({
        siswa_id: penanganan.siswa_id,
        tatib_id: penanganan.tatib_id,
        tanggal: (penanganan.tanggal || '').slice(0, 10),
        catatan: penanganan.catatan || '',
      });
    } else {
      setEditingPenanganan(null);
      setPenangananForm(formKosong());
    }
    setShowModal(true);
  };

  const handleSavePenanganan = async () => {
    if (tolakUbahTatib(activeRole)) return;
    if (!penangananForm.siswa_id || !penangananForm.tatib_id || !penangananForm.tanggal) {
      toast.error('Siswa, aturan, dan tanggal wajib diisi');
      return;
    }

    setSaving(true);
    try {
      if (editingPenanganan) {
        await api.put(`/tatib/penanganan/${editingPenanganan.id}`, penangananForm);
        toast.success('Catatan poin berhasil diperbarui');
      } else {
        await api.post('/tatib/penanganan', penangananForm);
        toast.success(`${JALUR[jalur].label} berhasil dicatat`);
      }
      setShowModal(false);
      loadData();
    } catch (e) {
      toast.error(pesanGalatTatib(e, 'Gagal menyimpan catatan poin'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePenanganan = async (id) => {
    if (tolakUbahTatib(activeRole, { hapus: true })) return;
    if (!(await confirmDialog('Yakin ingin menghapus catatan poin ini?'))) return;
    try {
      await api.delete(`/tatib/penanganan/${id}`);
      toast.success('Catatan poin berhasil dihapus');
      loadData();
    } catch (e) {
      toast.error(pesanGalatTatib(e, 'Gagal menghapus catatan poin'));
    }
  };

  const jumlahPerJalur = useMemo(() => {
    const n = { kebaikan: 0, pelanggaran: 0 };
    penangananList.forEach((p) => { n[jenisCatatan(p)] += 1; });
    return n;
  }, [penangananList]);

  const catatanJalur = useMemo(() => penangananList.filter((p) => jenisCatatan(p) === jalur), [penangananList, jalur]);

  const kategoriJalur = useMemo(
    () => [...new Set(catatanJalur.map((p) => p.kategori_nama).filter(Boolean))].sort(),
    [catatanJalur],
  );

  const filteredPenanganan = catatanJalur.filter((p) => {
    if (filterKategori && p.kategori_nama !== filterKategori) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const teks = [p.siswa_nama, p.siswa_nis, p.siswa_nisn, p.tatib_nama, p.tatib_kode].filter(Boolean).join(' ').toLowerCase();
      if (!teks.includes(q)) return false;
    }
    return true;
  });

  const aturanForm = aturanList.filter(JALUR[jalur].cocokAturan);

  const gantiJalur = (v) => {
    setJalur(v);
    setFilterKategori('');
  };

  const Ikon = JALUR[jalur].ikon;

  return (
    <div className="p-6 space-y-6" data-testid="tatib-input-poin-page">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold">{bolehInput ? 'Catat Poin Tata Tertib' : 'Poin Tata Tertib'}</h1>
          <p className="text-sm text-slate-600">Poin kebaikan bernilai plus, pelanggaran bernilai minus — dicatat lewat jalur masing-masing.</p>
        </div>
        {bolehInput && (
          <Button onClick={() => handleOpenModal()} data-testid="tatib-catat-poin">
            <Plus className="h-4 w-4 mr-2" />
            {JALUR[jalur].tombol}
          </Button>
        )}
      </div>

      {!bolehInput && (
        <BannerModeLihat>Mode lihat saja — pencatatan poin hanya oleh admin, guru tata tertib, dan waka kesiswaan.</BannerModeLihat>
      )}

      <Tabs value={jalur} onValueChange={gantiJalur}>
        <TabsList>
          {Object.entries(JALUR).map(([key, j]) => {
            const I = j.ikon;
            return (
              <TabsTrigger key={key} value={key} data-testid={`tatib-tab-${key}`}>
                <I className={`h-4 w-4 mr-1.5 ${key === 'kebaikan' ? 'text-emerald-600' : 'text-red-600'}`} />
                {j.label}
                <span className="ml-1.5 rounded-full bg-slate-200 px-1.5 text-[11px] tabular-nums">{jumlahPerJalur[key]}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Kategori</Label>
            <Select value={filterKategori || 'all'} onValueChange={(v) => setFilterKategori(v === 'all' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Semua Kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kategori</SelectItem>
                {kategoriJalur.map((k) => (
                  <SelectItem key={k} value={k}>{k}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Cari (Nama/NIS/Aturan)</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Cari siswa atau aturan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center items-center p-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">Memuat data...</span>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>NIS</TableHead>
                  <TableHead>Nama Siswa</TableHead>
                  <TableHead>Kelas</TableHead>
                  <TableHead>Kode</TableHead>
                  <TableHead>Aturan</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead className="text-right">Poin</TableHead>
                  <TableHead>Dicatat Oleh</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPenanganan.map((p) => {
                  const poin = nilaiPoin(p);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="whitespace-nowrap">{(p.tanggal || '').slice(0, 10)}</TableCell>
                      <TableCell>{p.siswa_nis || '-'}</TableCell>
                      <TableCell>
                        <button
                          type="button"
                          className="text-left font-medium text-[#006837] hover:underline"
                          onClick={() => setSiswaPanel({ id: p.siswa_id, nama: p.siswa_nama || '-', nis: p.siswa_nis, kelas: p.siswa_kelas })}
                          data-testid={`tatib-lihat-siswa-${p.id}`}
                        >
                          {p.siswa_nama || '-'}
                        </button>
                      </TableCell>
                      <TableCell>{p.siswa_kelas || '-'}</TableCell>
                      <TableCell className="font-bold">{p.tatib_kode || '-'}</TableCell>
                      <TableCell>{p.tatib_nama || '-'}</TableCell>
                      <TableCell>{p.kategori_nama || '-'}</TableCell>
                      <TableCell className="text-right">
                        <Badge
                          className={poin >= 0 ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-red-100 text-red-800 border-red-200'}
                          variant="outline"
                        >
                          {formatPoin(poin)}
                        </Badge>
                      </TableCell>
                      <TableCell>{p.petugas_nama || '-'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {jalur === 'pelanggaran' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="whitespace-nowrap"
                              onClick={() => setTindakLanjut(p)}
                              data-testid={`tatib-tindak-lanjut-${p.id}`}
                            >
                              <ClipboardCheck className="h-4 w-4 mr-1" />
                              Tindak lanjut
                              <span className="ml-1 tabular-nums text-slate-500">({(p.tindak_lanjut || []).length})</span>
                            </Button>
                          )}
                          {bolehInput && (
                            <Button size="sm" variant="ghost" onClick={() => handleOpenModal(p)} aria-label="Ubah catatan">
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          )}
                          {bolehHapus && (
                            <Button size="sm" variant="ghost" onClick={() => handleDeletePenanganan(p.id)} aria-label="Hapus catatan">
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredPenanganan.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-gray-500">
                      {JALUR[jalur].kosong}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <FormPoinTatib
        jenis={jalur}
        open={showFormPoin}
        onOpenChange={setShowFormPoin}
        studentsList={studentsList}
        riwayat={penangananList}
        onTersimpan={(catatan) => setPenangananList((list) => [catatan, ...list])}
      />

      <PanelPoinSiswa siswa={siswaPanel} records={penangananList} onClose={() => setSiswaPanel(null)} />

      <TindakLanjutDialog
        catatan={tindakLanjut}
        onClose={() => setTindakLanjut(null)}
        bolehUbah={bolehInput}
        onTersimpan={(baru) => {
          setTindakLanjut(baru);
          setPenangananList((list) => list.map((x) => (x.id === baru.id ? baru : x)));
        }}
      />

      {/* Add/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ikon className={`h-5 w-5 ${jalur === 'kebaikan' ? 'text-emerald-600' : 'text-red-600'}`} />
              Ubah {JALUR[jalur].label}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Siswa*</Label>
              <Select
                value={penangananForm.siswa_id || 'none'}
                onValueChange={(v) => setPenangananForm({ ...penangananForm, siswa_id: v === 'none' ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Siswa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Pilih Siswa</SelectItem>
                  {studentsList.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nis || '-'} - {s.full_name}{s.class_name ? ` (${s.class_name})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>{jalur === 'kebaikan' ? 'Kebaikan*' : 'Pelanggaran*'}</Label>
              <Select
                value={penangananForm.tatib_id || 'none'}
                onValueChange={(v) => setPenangananForm({ ...penangananForm, tatib_id: v === 'none' ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Aturan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Pilih Aturan</SelectItem>
                  {aturanForm.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      [{a.kode}] {a.nama_aturan}{a.kategori_nama ? ` - ${a.kategori_nama}` : ''} ({formatPoin(a.poin)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Tanggal*</Label>
              <Input
                type="date"
                value={penangananForm.tanggal}
                onChange={(e) => setPenangananForm({ ...penangananForm, tanggal: e.target.value })}
              />
            </div>

            <div>
              <Label>Keterangan</Label>
              <Textarea
                value={penangananForm.catatan}
                onChange={(e) => setPenangananForm({ ...penangananForm, catatan: e.target.value })}
                placeholder="Keterangan tambahan (opsional)"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Batal
            </Button>
            <Button onClick={handleSavePenanganan} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminTatibPenangananPage;
