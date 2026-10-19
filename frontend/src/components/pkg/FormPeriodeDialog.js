import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarCog, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { simpanPeriode } from '@/lib/pkgKelola';

const KOSONG = { nama_periode: '', semester_id: '', tahun_pelajaran: '', semester: '', tanggal_buka: '', tanggal_tutup: '' };

const namaOtomatis = (sem) => `PKG Semester ${sem.name} ${sem.academic_year_name || ''}`.trim();

// Formulir tambah/ubah periode PKG. Semester dipilih dari data akademik (GET /semesters); nama tahun pelajaran
// & semester disalin ke periode agar tetap utuh walau data akademik berubah.
export default function FormPeriodeDialog({ open, periode, semesters = [], onClose, onTersimpan }) {
  const [form, setForm] = useState(KOSONG);
  const [menyimpan, setMenyimpan] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(periode ? {
      nama_periode: periode.nama_periode, semester_id: periode.semester_id || '', tahun_pelajaran: periode.tahun_pelajaran,
      semester: periode.semester, tanggal_buka: periode.tanggal_buka, tanggal_tutup: periode.tanggal_tutup,
    } : KOSONG);
  }, [open, periode]);

  const ubah = (kunci) => (e) => setForm((f) => ({ ...f, [kunci]: e.target.value }));

  const pilihSemester = (id) => {
    const sem = semesters.find((s) => s.id === id);
    if (!sem) return;
    setForm((f) => ({
      ...f,
      semester_id: id,
      tahun_pelajaran: sem.academic_year_name || f.tahun_pelajaran,
      semester: sem.name,
      nama_periode: f.nama_periode || namaOtomatis(sem),
      tanggal_buka: f.tanggal_buka || sem.start_date || '',
      tanggal_tutup: f.tanggal_tutup || sem.end_date || '',
    }));
  };

  const simpan = async (e) => {
    e.preventDefault();
    setMenyimpan(true);
    try {
      const hasil = await simpanPeriode(form, periode?.id);
      toast.success(periode ? 'Periode diperbarui' : 'Periode ditambahkan sebagai draf');
      onTersimpan?.(hasil);
    } catch (err) {
      toast.error(err.message || 'Gagal menyimpan periode');
    } finally {
      setMenyimpan(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg" data-testid="pkg-form-periode">
        <form onSubmit={simpan} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarCog className="h-5 w-5 text-[#006837]" /> {periode ? 'Ubah' : 'Tetapkan'} Periode PKG
            </DialogTitle>
            <DialogDescription className="text-left">
              Periode mewadahi SK, pembagian penilai, penilaian, dan rekap. Periode baru tersimpan sebagai draf.
            </DialogDescription>
          </DialogHeader>
          {semesters.length > 0 ? (
            <div className="space-y-1.5">
              <Label>Semester</Label>
              <Select value={form.semester_id} onValueChange={pilihSemester}>
                <SelectTrigger data-testid="pkg-periode-semester"><SelectValue placeholder="Pilih semester" /></SelectTrigger>
                <SelectContent>
                  {semesters.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name} · {s.academic_year_name || '-'}{s.is_active ? ' (aktif)' : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pkg-periode-tp">Tahun pelajaran</Label>
                <Input id="pkg-periode-tp" value={form.tahun_pelajaran} onChange={ubah('tahun_pelajaran')} placeholder="2026/2027" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pkg-periode-sem">Semester</Label>
                <Input id="pkg-periode-sem" value={form.semester} onChange={ubah('semester')} placeholder="Ganjil" required />
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="pkg-periode-nama">Nama periode</Label>
            <Input id="pkg-periode-nama" value={form.nama_periode} onChange={ubah('nama_periode')} required maxLength={120} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pkg-periode-buka">Tanggal buka</Label>
              <Input id="pkg-periode-buka" type="date" value={form.tanggal_buka} onChange={ubah('tanggal_buka')} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pkg-periode-tutup">Tanggal tutup</Label>
              <Input id="pkg-periode-tutup" type="date" value={form.tanggal_tutup} min={form.tanggal_buka || undefined} onChange={ubah('tanggal_tutup')} required />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
            <Button type="submit" disabled={menyimpan} className="bg-[#006837] hover:bg-[#005830]" data-testid="pkg-periode-simpan">
              {menyimpan && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
