import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ThumbsUp, ThumbsDown, Lock, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { formatPoin, rangkumPoin } from '@/components/tatib/RingkasanPoin';
import { ambilAturanPoin, catatPoin, hitungNilaiPoin, sarankanKondisi } from '@/lib/poinTatib';
import { pesanGalatTatib } from '@/lib/aksesTatib';
import { hariIniWIB } from '@/lib/tanggal';

const TEMA = {
  kebaikan: {
    judul: 'Catat Poin Kebaikan',
    ikon: ThumbsUp,
    deskripsi: 'Poin kebaikan selalu bernilai plus. Prestasi lomba dicatat di sini dan tidak mengubah data prestasi siswa.',
    labelAturan: 'Kebaikan',
    placeholder: 'Mis. nama lomba, penyelenggara, atau kegiatan (opsional)',
    ikonWarna: 'text-emerald-600',
    teks: 'text-emerald-700',
    latar: 'bg-emerald-50',
    aktif: 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500',
    tombol: 'bg-emerald-600 hover:bg-emerald-700',
  },
  pelanggaran: {
    judul: 'Catat Pelanggaran',
    ikon: ThumbsDown,
    deskripsi: 'Poin pelanggaran selalu bernilai minus dan mengikuti kategori pelanggaran.',
    labelAturan: 'Pelanggaran',
    placeholder: 'Kronologi singkat kejadian (opsional)',
    ikonWarna: 'text-red-600',
    teks: 'text-red-700',
    latar: 'bg-red-50',
    aktif: 'border-red-500 bg-red-50 ring-1 ring-red-500',
    tombol: 'bg-red-600 hover:bg-red-700',
  },
};

const hariIni = () => hariIniWIB();
const formKosong = () => ({ siswa_id: '', kategori: '', aturan_id: '', kondisi_id: '', tanggal: hariIni(), catatan: '' });

// Formulir pencatatan poin per jalur: 'kebaikan' (PLUS) atau 'pelanggaran' (MINUS).
// Alur: kategori → aturan → kondisi pelaksanaan; nilai poin dihitung otomatis
// (hitungNilaiPoin) dan kondisi pertama/berulang disarankan dari `riwayat` siswa.
// Poin kebaikan tidak terhubung ke data prestasi siswa.
// Disimpan lewat POST /tatib/poin/{jenis}; server menghitung ulang nilainya.
export default function FormPoinTatib({ jenis, open, onOpenChange, studentsList = [], riwayat = [], onTersimpan }) {
  const tema = TEMA[jenis];
  const [daftarAturan, setDaftarAturan] = useState([]);
  const [form, setForm] = useState(formKosong);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(formKosong());
    setDaftarAturan([]);
    ambilAturanPoin(jenis).then(setDaftarAturan).catch(() => toast.error(`Gagal memuat daftar ${tema.labelAturan.toLowerCase()}`));
  }, [open, jenis]); // eslint-disable-line react-hooks/exhaustive-deps

  const kategoriList = useMemo(() => [...new Set(daftarAturan.map((a) => a.kategori_nama))], [daftarAturan]);
  const aturanTersaring = daftarAturan.filter((a) => !form.kategori || a.kategori_nama === form.kategori);
  const aturan = daftarAturan.find((a) => a.id === form.aturan_id);
  const nilai = hitungNilaiPoin(jenis, aturan, form.kondisi_id);
  const saldoSiswa = useMemo(
    () => (form.siswa_id ? rangkumPoin(riwayat.filter((r) => r.siswa_id === form.siswa_id)) : null),
    [riwayat, form.siswa_id],
  );
  const saran = useMemo(() => sarankanKondisi(aturan, form.siswa_id, riwayat), [aturan, form.siswa_id, riwayat]);

  // Kondisi otomatis mengikuti saran tiap kali siswa/aturan berganti; petugas tetap boleh menggantinya.
  useEffect(() => {
    setForm((f) => {
      if (saran) return { ...f, kondisi_id: saran.kondisi_id };
      const masihBerlaku = aturan?.kondisi.some((k) => k.id === f.kondisi_id);
      return masihBerlaku ? f : { ...f, kondisi_id: '' };
    });
  }, [saran]); // eslint-disable-line react-hooks/exhaustive-deps

  const pilihAturan = (id) => {
    const a = daftarAturan.find((x) => x.id === id);
    setForm({ ...form, aturan_id: id, kategori: a?.kategori_nama || form.kategori });
  };

  const simpan = async () => {
    const siswa = studentsList.find((s) => s.id === form.siswa_id);
    if (!siswa || !aturan || !nilai || !form.tanggal) {
      toast.error(`Siswa, ${tema.labelAturan.toLowerCase()}, kondisi, dan tanggal wajib diisi`);
      return;
    }
    setSaving(true);
    try {
      const catatan = await catatPoin(jenis, form);
      toast.success(`${tema.labelAturan} ${formatPoin(catatan.poin)} dicatat untuk ${siswa.full_name}`);
      onTersimpan?.(catatan);
      onOpenChange(false);
    } catch (e) {
      toast.error(pesanGalatTatib(e, 'Gagal mencatat poin'));
    } finally {
      setSaving(false);
    }
  };

  if (!tema) return null;
  const Ikon = tema.ikon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid={`form-poin-${jenis}`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ikon className={`h-5 w-5 ${tema.ikonWarna}`} /> {tema.judul}
          </DialogTitle>
          <DialogDescription>{tema.deskripsi}</DialogDescription>
        </DialogHeader>


        <div className="space-y-4">
          <div>
            <Label>Siswa*</Label>
            <Select value={form.siswa_id || 'none'} onValueChange={(v) => setForm({ ...form, siswa_id: v === 'none' ? '' : v })}>
              <SelectTrigger data-testid={`${jenis}-siswa`}><SelectValue placeholder="Pilih Siswa" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Pilih Siswa</SelectItem>
                {studentsList.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.nis || '-'} - {s.full_name}{s.class_name ? ` (${s.class_name})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {saldoSiswa && (
              <p className="mt-1.5 text-xs text-slate-600" data-testid={`${jenis}-saldo-siswa`}>
                Saldo saat ini{' '}
                <span className="font-semibold tabular-nums">{formatPoin(saldoSiswa.totalPlus + saldoSiswa.totalMinus)}</span>
                {' '}· kebaikan <span className="tabular-nums text-emerald-700">{formatPoin(saldoSiswa.totalPlus)}</span>
                {' '}· pelanggaran <span className="tabular-nums text-red-700">{formatPoin(saldoSiswa.totalMinus)}</span>
                {nilai && (
                  <> → setelah dicatat <span className="font-semibold tabular-nums">{formatPoin(saldoSiswa.totalPlus + saldoSiswa.totalMinus + nilai.poin)}</span></>
                )}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <div>
              <Label>Kategori</Label>
              <Select
                value={form.kategori || 'all'}
                onValueChange={(v) => setForm({ ...form, kategori: v === 'all' ? '' : v, aturan_id: '', kondisi_id: '' })}
              >
                <SelectTrigger data-testid={`${jenis}-kategori`}><SelectValue placeholder="Semua Kategori" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kategori</SelectItem>
                  {kategoriList.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{tema.labelAturan}*</Label>
              <Select value={form.aturan_id || 'none'} onValueChange={(v) => pilihAturan(v === 'none' ? '' : v)}>
                <SelectTrigger data-testid={`${jenis}-aturan`}><SelectValue placeholder={`Pilih ${tema.labelAturan}`} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Pilih {tema.labelAturan}</SelectItem>
                  {aturanTersaring.map((a) => (
                    <SelectItem key={a.id} value={a.id}>[{a.kode}] {a.nama}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {aturan && (
            <fieldset>
              <legend className="text-sm font-medium mb-2">Kondisi saat kejadian*</legend>
              {saran?.kondisi_id === 'ulang' && (
                <p className="mb-2 flex items-center gap-1.5 text-xs text-amber-700" data-testid={`${jenis}-saran-ulang`}>
                  <Sparkles className="h-3.5 w-3.5" /> Dipilih otomatis: siswa ini sudah {saran.jumlahSebelumnya}× tercatat dengan aturan yang sama.
                </p>
              )}
              <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
                {aturan.kondisi.map((k) => {
                  const aktif = form.kondisi_id === k.id;
                  return (
                    <button
                      key={k.id}
                      type="button"
                      role="radio"
                      aria-checked={aktif}
                      onClick={() => setForm({ ...form, kondisi_id: k.id })}
                      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors ${aktif ? tema.aktif : 'hover:bg-slate-50'}`}
                      data-testid={`${jenis}-kondisi-${k.id}`}
                    >
                      <span>{k.label}</span>
                      <span className={`font-semibold tabular-nums ${tema.teks}`}>{formatPoin(k.poin)}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          <div>
            <Label>Tanggal*</Label>
            <Input type="date" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} />
          </div>

          <div>
            <Label>Keterangan</Label>
            <Textarea
              value={form.catatan}
              onChange={(e) => setForm({ ...form, catatan: e.target.value })}
              placeholder={tema.placeholder}
              rows={3}
            />
          </div>

          <div className={`flex items-center justify-between gap-3 rounded-lg px-4 py-3 ${tema.latar}`} data-testid={`${jenis}-nilai`}>
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                <Lock className="h-3.5 w-3.5" /> Nilai poin otomatis
              </p>
              <p className="text-xs text-slate-500 truncate">
                {nilai ? `${aturan.kategori_nama} · ${aturan.nama} · ${nilai.kondisi.label}` : 'Pilih aturan dan kondisi untuk menghitung nilai'}
              </p>
            </div>
            <span className={`shrink-0 text-2xl font-bold tabular-nums ${tema.teks}`}>{nilai ? formatPoin(nilai.poin) : '—'}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={simpan} disabled={saving} className={tema.tombol} data-testid={`${jenis}-simpan`}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
