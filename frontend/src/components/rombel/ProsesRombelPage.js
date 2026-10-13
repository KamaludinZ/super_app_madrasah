import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRightLeft, Copy, Loader2, PlayCircle, Users, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';
import { confirmDialog } from '@/components/ui/confirm-dialog';
import { hariIniWIB } from '@/lib/tanggal';

// Proses siswa dari rombel semester asal ke rombel semester tujuan, aksi per siswa.
// Tiap aksi tercatat di riwayat rombel siswa (Detail Siswa > Riwayat Kelas).
export const AKSI = [
  { value: 'naik_kelas', label: 'Naik Kelas' },
  { value: 'lanjut_semester', label: 'Lanjut Semester' },
  { value: 'pindah_kelas', label: 'Pindah Rombel' },
  { value: 'tinggal_kelas', label: 'Tinggal Kelas' },
  { value: 'pindah_semester', label: 'Pindah Semester (Percepatan)' },
  { value: 'lulus', label: 'Lulus' },
];
const AKSI_LABEL = Object.fromEntries(AKSI.map((a) => [a.value, a.label]));
const TINGKAT_AKHIR = 9;

const labelSemester = (s) => (s ? `${s.academic_year_name || '-'} · ${s.name}${s.is_active ? ' (aktif)' : ''}` : '-');
const urutSemester = (a, b) => (a.academic_year_name || '').localeCompare(b.academic_year_name || '')
  || (a.start_date || '').localeCompare(b.start_date || '') || (a.code || '').localeCompare(b.code || '');

const cariRombel = (daftar, grade, kelasAsal) => (
  daftar.find((c) => Number(c.grade) === grade && (c.parallel || '') === (kelasAsal.parallel || '') && !!c.is_accelerated === !!kelasAsal.is_accelerated)
  || daftar.find((c) => Number(c.grade) === grade && (c.parallel || '') === (kelasAsal.parallel || ''))
);

/** Usulan aksi & rombel tujuan untuk satu siswa, dari pasangan semester asal-tujuan. */
function usulan(kelasAsal, semAsal, semTujuan, rombelTujuan, siswa) {
  if (!kelasAsal || !semTujuan) return { aksi: 'pindah_kelas', to_class_id: '' };
  const grade = Number(kelasAsal.grade) || 0;
  if (semAsal?.id === semTujuan.id) {
    const n = parseInt(siswa?.semester_belajar, 10);
    return { aksi: 'pindah_semester', to_class_id: kelasAsal.id, semester_belajar: Number.isFinite(n) ? String(n + 1) : '' };
  }
  if (semAsal && semAsal.academic_year_id === semTujuan.academic_year_id) {
    const sama = rombelTujuan.find((c) => c.name === kelasAsal.name) || cariRombel(rombelTujuan, grade, kelasAsal);
    return { aksi: 'lanjut_semester', to_class_id: sama?.id || '' };
  }
  if (grade >= TINGKAT_AKHIR) return { aksi: 'lulus', to_class_id: '' };
  return { aksi: 'naik_kelas', to_class_id: cariRombel(rombelTujuan, grade + 1, kelasAsal)?.id || '' };
}

export default function ProsesRombelPage({ badge = 'Kenaikan & Kelulusan' }) {
  const { activeRole } = useAuth();
  const bolehProses = ['admin', 'waka_kurikulum'].includes(activeRole);

  const [semesters, setSemesters] = useState([]);
  const [semAsalId, setSemAsalId] = useState('');
  const [semTujuanId, setSemTujuanId] = useState('');
  const [rombelAsal, setRombelAsal] = useState([]);
  const [rombelTujuan, setRombelTujuan] = useState([]);
  const [kelasAsalId, setKelasAsalId] = useState('');
  const [rows, setRows] = useState([]);
  const [sudahDiproses, setSudahDiproses] = useState(0);
  const [loadingSiswa, setLoadingSiswa] = useState(false);
  const [tanggal, setTanggal] = useState(hariIniWIB());
  const [prefixIjazah, setPrefixIjazah] = useState('');
  const [catatan, setCatatan] = useState('');
  const [processing, setProcessing] = useState(false);
  const [hasil, setHasil] = useState(null);
  const [salin, setSalin] = useState(null);
  const [massal, setMassal] = useState({ aksi: '', to_class_id: '' });

  const semAsal = semesters.find((s) => s.id === semAsalId);
  const semTujuan = semesters.find((s) => s.id === semTujuanId);
  const kelasAsal = rombelAsal.find((c) => c.id === kelasAsalId);
  const percepatan = !!semAsalId && semAsalId === semTujuanId;

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/semesters');
        const daftar = [...(data || [])].sort(urutSemester);
        setSemesters(daftar);
        const i = daftar.findIndex((s) => s.is_active);
        if (i >= 0) {
          setSemTujuanId(daftar[i].id);
          setSemAsalId((daftar[i - 1] || daftar[i]).id);
        }
      } catch { toast.error('Gagal memuat semester'); }
    })();
  }, []);

  const muatRombel = async (semId, set) => {
    if (!semId) { set([]); return; }
    try { set((await api.get('/classes', { params: { semester_id: semId } })).data || []); } catch { set([]); }
  };
  useEffect(() => { muatRombel(semAsalId, setRombelAsal); setKelasAsalId(''); setRows([]); }, [semAsalId]);
  useEffect(() => { muatRombel(semTujuanId, setRombelTujuan); }, [semTujuanId]);

  const muatSiswa = async () => {
    if (!kelasAsalId) { setRows([]); return; }
    setLoadingSiswa(true);
    try {
      const { data } = await api.get('/promotions/preview', { params: { from_class_id: kelasAsalId, type: 'proses' } });
      setSudahDiproses(data.sudah_diproses || 0);
      setRows((data.students || []).map((s) => ({ siswa: s, pilih: true, ...usulan(kelasAsal, semAsal, semTujuan, rombelTujuan, s) })));
    } catch { toast.error('Gagal memuat siswa'); }
    finally { setLoadingSiswa(false); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { muatSiswa(); }, [kelasAsalId, rombelTujuan]);

  const ubahBaris = (i, patch) => setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  const terapkanMassal = () => {
    if (!massal.aksi) return;
    setRows((r) => r.map((row) => (row.pilih ? { ...row, aksi: massal.aksi, to_class_id: massal.aksi === 'lulus' ? '' : (massal.to_class_id || row.to_class_id) } : row)));
  };

  const dipilih = rows.filter((r) => r.pilih);
  const ringkasan = useMemo(() => dipilih.reduce((acc, r) => ({ ...acc, [r.aksi]: (acc[r.aksi] || 0) + 1 }), {}), [dipilih]);
  const belumLengkap = dipilih.filter((r) => (r.aksi !== 'lulus' && !r.to_class_id) || (r.aksi === 'pindah_semester' && r.to_class_id === kelasAsalId && !r.semester_belajar));
  const pilihanRombel = percepatan ? rombelAsal : rombelTujuan;

  const proses = async () => {
    if (!dipilih.length) { toast.error('Pilih minimal satu siswa'); return; }
    if (belumLengkap.length) { toast.error(`${belumLengkap.length} siswa belum lengkap (rombel tujuan / semester belajar)`); return; }
    const teks = Object.entries(ringkasan).map(([k, v]) => `${AKSI_LABEL[k]}: ${v}`).join(', ');
    if (!(await confirmDialog(`Proses ${dipilih.length} siswa dari ${kelasAsal?.name} (${teks}) dengan tanggal efektif ${tanggal}? Riwayat rombel setiap siswa akan tercatat.`))) return;
    setProcessing(true);
    try {
      const { data } = await api.post('/promotions/proses', {
        tanggal,
        notes: catatan || undefined,
        certificate_number_prefix: prefixIjazah || undefined,
        items: dipilih.map((r) => ({
          student_id: r.siswa.id, aksi: r.aksi, to_class_id: r.aksi === 'lulus' ? undefined : r.to_class_id,
          semester_belajar: r.aksi === 'pindah_semester' ? (r.semester_belajar || undefined) : undefined,
        })),
      });
      setHasil(data);
      if (data.success_count) toast.success(data.message); else toast.error('Tidak ada siswa yang berhasil diproses');
      await Promise.all([muatRombel(semAsalId, setRombelAsal), muatRombel(semTujuanId, setRombelTujuan)]);
      await muatSiswa();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal memproses');
    } finally { setProcessing(false); }
  };

  const bukaSalin = () => setSalin({
    naik_tingkat: !!semAsal && !!semTujuan && semAsal.academic_year_id !== semTujuan.academic_year_id,
    salin_wali: true,
  });
  const jalankanSalin = async () => {
    setProcessing(true);
    try {
      const { data } = await api.post('/classes/salin-struktur', { from_semester_id: semAsalId, to_semester_id: semTujuanId, ...salin });
      toast.success(data.message);
      setSalin(null);
      await muatRombel(semTujuanId, setRombelTujuan);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menyalin struktur rombel');
    } finally { setProcessing(false); }
  };

  return (
    <div className="space-y-6" data-testid="proses-rombel-page">
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
          <ArrowRightLeft className="h-3 w-3 mr-1" /> {badge}
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Proses Rombel Semester</h1>
        <p className="text-sm text-slate-600 mt-1">Naik kelas, lanjut semester, pindah rombel, tinggal kelas, pindah semester kelas percepatan, dan kelulusan.</p>
      </div>

      <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900 flex gap-3">
        <Info className="h-5 w-5 shrink-0 mt-0.5" />
        <ol className="list-decimal pl-4 space-y-0.5">
          <li>Pilih <b>semester asal</b> dan <b>semester tujuan</b>. Bila rombel semester tujuan belum ada, klik <b>Salin Struktur Rombel</b>.</li>
          <li>Pilih <b>rombel asal</b>; aksi tiap siswa terisi otomatis (Ganjil→Genap: lanjut ke rombel bernama sama; TP baru: naik tingkat; kelas {TINGKAT_AKHIR}: lulus). Ubah bila ada yang pindah rombel / tinggal kelas.</li>
          <li><b>Kelas percepatan</b>: pilih semester asal = semester tujuan, lalu aksi <i>Pindah Semester</i> dengan semester belajar tujuan (di rombel yang sama atau rombel lain).</li>
        </ol>
      </div>

      <Card>
        <CardContent className="p-4 grid gap-4 md:grid-cols-4">
          <div className="space-y-1.5">
            <Label>Semester asal</Label>
            <Select value={semAsalId || undefined} onValueChange={setSemAsalId}>
              <SelectTrigger data-testid="sem-asal"><SelectValue placeholder="Pilih semester" /></SelectTrigger>
              <SelectContent>{semesters.map((s) => <SelectItem key={s.id} value={s.id}>{labelSemester(s)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Semester tujuan</Label>
            <Select value={semTujuanId || undefined} onValueChange={setSemTujuanId}>
              <SelectTrigger data-testid="sem-tujuan"><SelectValue placeholder="Pilih semester" /></SelectTrigger>
              <SelectContent>{semesters.map((s) => <SelectItem key={s.id} value={s.id}>{labelSemester(s)}</SelectItem>)}</SelectContent>
            </Select>
            <p className="text-xs text-slate-500">{rombelTujuan.length} rombel tersedia{percepatan ? ' · mode percepatan (semester sama)' : ''}</p>
          </div>
          <div className="space-y-1.5">
            <Label>Rombel asal</Label>
            <Select value={kelasAsalId || undefined} onValueChange={setKelasAsalId}>
              <SelectTrigger data-testid="rombel-asal"><SelectValue placeholder="Pilih rombel" /></SelectTrigger>
              <SelectContent>
                {rombelAsal.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}{c.is_accelerated ? ' (percepatan)' : ''} — {c.student_count} siswa</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Tanggal efektif</Label>
            <Input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
          </div>
          {bolehProses && semAsalId && semTujuanId && !percepatan && (
            <div className="md:col-span-4">
              <Button variant="outline" className="gap-2" onClick={bukaSalin} data-testid="btn-salin-struktur">
                <Copy className="h-4 w-4" /> Salin Struktur Rombel ke {labelSemester(semTujuan)}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {kelasAsalId && (
        <Card>
          <CardContent className="p-0">
            <div className="flex flex-wrap items-end gap-3 p-4 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-700 mr-auto">
                <Users className="h-4 w-4" />
                <span className="font-semibold">{rows.length} siswa di {kelasAsal?.name}</span>
                {sudahDiproses > 0 && <Badge className="bg-slate-100 text-slate-600 border-slate-200">{sudahDiproses} sudah diproses</Badge>}
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <Select value={massal.aksi || undefined} onValueChange={(v) => setMassal({ ...massal, aksi: v })}>
                  <SelectTrigger className="w-48"><SelectValue placeholder="Atur aksi terpilih…" /></SelectTrigger>
                  <SelectContent>{AKSI.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
                </Select>
                {massal.aksi && massal.aksi !== 'lulus' && (
                  <Select value={massal.to_class_id || undefined} onValueChange={(v) => setMassal({ ...massal, to_class_id: v })}>
                    <SelectTrigger className="w-40"><SelectValue placeholder="Rombel tujuan" /></SelectTrigger>
                    <SelectContent>{pilihanRombel.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                )}
                <Button variant="outline" onClick={terapkanMassal} disabled={!massal.aksi}>Terapkan</Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox checked={rows.length > 0 && rows.every((r) => r.pilih)} onCheckedChange={(v) => setRows((r) => r.map((row) => ({ ...row, pilih: !!v })))} />
                    </TableHead>
                    <TableHead>Siswa</TableHead>
                    <TableHead>Aksi</TableHead>
                    <TableHead>Rombel tujuan</TableHead>
                    <TableHead>Semester belajar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingSiswa ? (
                    <TableRow><TableCell colSpan={5} className="py-10 text-center text-slate-500"><Loader2 className="h-5 w-5 animate-spin inline mr-2" />Memuat siswa…</TableCell></TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="py-10 text-center text-slate-500">
                      {sudahDiproses > 0 ? 'Semua siswa rombel ini sudah diproses.' : 'Tidak ada siswa di rombel ini.'}
                    </TableCell></TableRow>
                  ) : rows.map((r, i) => {
                    const kurang = r.pilih && ((r.aksi !== 'lulus' && !r.to_class_id) || (r.aksi === 'pindah_semester' && r.to_class_id === kelasAsalId && !r.semester_belajar));
                    return (
                      <TableRow key={r.siswa.id} className={r.pilih ? '' : 'opacity-50'} data-testid="proses-row">
                        <TableCell><Checkbox checked={r.pilih} onCheckedChange={(v) => ubahBaris(i, { pilih: !!v })} /></TableCell>
                        <TableCell>
                          <div className="font-medium">{r.siswa.full_name}</div>
                          <div className="text-xs text-slate-500">{r.siswa.nisn || r.siswa.nis || '-'}{r.siswa.semester_belajar ? ` · semester belajar ${r.siswa.semester_belajar}` : ''}</div>
                        </TableCell>
                        <TableCell>
                          <Select value={r.aksi} onValueChange={(v) => ubahBaris(i, { aksi: v, ...(v === 'pindah_semester' && !r.to_class_id ? { to_class_id: kelasAsalId } : {}) })}>
                            <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
                            <SelectContent>{AKSI.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {r.aksi === 'lulus' ? <span className="text-sm text-slate-500">— keluar sebagai alumni</span> : (
                            <Select value={r.to_class_id || undefined} onValueChange={(v) => ubahBaris(i, { to_class_id: v })}>
                              <SelectTrigger className={`w-44 ${kurang && !r.to_class_id ? 'border-rose-400' : ''}`}><SelectValue placeholder="Pilih rombel" /></SelectTrigger>
                              <SelectContent>
                                {(r.aksi === 'pindah_semester' ? [...new Map([...rombelAsal, ...pilihanRombel].map((c) => [c.id, c])).values()] : pilihanRombel)
                                  .map((c) => <SelectItem key={c.id} value={c.id}>{c.name}{c.id === kelasAsalId ? ' (rombel sama)' : ''}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell>
                          {r.aksi === 'pindah_semester' ? (
                            <Input className={`w-24 ${kurang && !r.semester_belajar ? 'border-rose-400' : ''}`} placeholder="mis. 2" value={r.semester_belajar || ''} onChange={(e) => ubahBaris(i, { semester_belajar: e.target.value })} />
                          ) : <span className="text-slate-400">-</span>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {rows.length > 0 && (
              <div className="p-4 border-t border-slate-100 space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  {ringkasan.lulus > 0 && (
                    <div className="space-y-1.5">
                      <Label>Awalan nomor ijazah (opsional)</Label>
                      <Input value={prefixIjazah} onChange={(e) => setPrefixIjazah(e.target.value)} placeholder="mis. MTs.13.35/PP.01.1" />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label>Catatan (opsional)</Label>
                    <Input value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Tercatat di riwayat rombel siswa" />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {Object.entries(ringkasan).map(([k, v]) => <Badge key={k} className="bg-[#006837]/10 text-[#006837] border-[#006837]/20">{AKSI_LABEL[k]}: {v}</Badge>)}
                  {belumLengkap.length > 0 && <Badge className="bg-rose-100 text-rose-700 border-rose-200">{belumLengkap.length} belum lengkap</Badge>}
                  <Button className="ml-auto gap-2 bg-[#006837] hover:bg-[#005830]" onClick={proses} disabled={!bolehProses || processing || !dipilih.length} data-testid="btn-proses">
                    {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />} Proses {dipilih.length} Siswa
                  </Button>
                </div>
                {!bolehProses && <p className="text-xs text-slate-500">Hanya Admin dan Waka Kurikulum yang dapat memproses.</p>}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {hasil && (
        <Card>
          <CardContent className="p-4 space-y-2" data-testid="hasil-proses">
            <div className="flex items-center gap-2 font-semibold text-emerald-700"><CheckCircle2 className="h-5 w-5" /> {hasil.message}</div>
            {hasil.errors?.length > 0 && (
              <div className="rounded-md bg-rose-50 border border-rose-200 p-3 text-sm text-rose-800">
                <div className="flex items-center gap-2 font-semibold mb-1"><AlertCircle className="h-4 w-4" /> {hasil.failed_count} tidak diproses:</div>
                <ul className="list-disc pl-5">{hasil.errors.map((e) => <li key={e}>{e}</li>)}</ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={!!salin} onOpenChange={(o) => !o && setSalin(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Salin Struktur Rombel</DialogTitle>
            <DialogDescription>
              Buat rombel di <b>{labelSemester(semTujuan)}</b> dari rombel <b>{labelSemester(semAsal)}</b>. Siswa tidak ikut dipindah; rombel yang namanya sudah ada dilewati.
            </DialogDescription>
          </DialogHeader>
          {salin && (
            <div className="space-y-3 py-2 text-sm">
              <label className="flex items-start gap-2">
                <Checkbox checked={salin.naik_tingkat} onCheckedChange={(v) => setSalin({ ...salin, naik_tingkat: !!v })} />
                <span>Naikkan tingkat (7A → 8A). Untuk pergantian tahun pelajaran; rombel kelas {TINGKAT_AKHIR} tidak disalin.</span>
              </label>
              <label className="flex items-start gap-2">
                <Checkbox checked={salin.salin_wali} onCheckedChange={(v) => setSalin({ ...salin, salin_wali: !!v })} />
                <span>Salin wali kelas (bisa diubah nanti di menu Kelas).</span>
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSalin(null)} disabled={processing}>Batal</Button>
            <Button onClick={jalankanSalin} disabled={processing} className="gap-2 bg-[#006837] hover:bg-[#005830]">
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />} Salin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
