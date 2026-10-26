import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BookOpen, Building, Clock, FileText, Loader2, NotebookPen, Send } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { catatJurnal } from '@/lib/jurnalAsal';

const STATUSES = [
  { value: 'hadir', short: 'H', active: 'bg-emerald-600 hover:bg-emerald-700 text-white', idle: 'hover:bg-emerald-50' },
  { value: 'sakit', short: 'S', active: 'bg-amber-600 hover:bg-amber-700 text-white', idle: 'hover:bg-amber-50' },
  { value: 'izin', short: 'I', active: 'bg-blue-600 hover:bg-blue-700 text-white', idle: 'hover:bg-blue-50' },
  { value: 'alpa', short: 'A', active: 'bg-red-600 hover:bg-red-700 text-white', idle: 'hover:bg-red-50' },
];

/**
 * Catat Jurnal: isi jurnal slot hari ini setelah jam pelajaran lewat (tanpa scan QR), paling lambat 24.00 WIB.
 * Isian sama dengan form jurnal biasa (KD/indikator & materi terdaftar opsional, materi, catatan, absensi siswa);
 * tersimpan dengan asal input "Catat Jurnal" (lib/jurnalAsal -> POST /jurnal/catat).
 */
export default function CatatJurnalDialog({ slot, open, onOpenChange, onSaved }) {
  const [materi, setMateri] = useState('');
  const [catatan, setCatatan] = useState('');
  const [indikatorList, setIndikatorList] = useState([]);
  const [materiList, setMateriList] = useState([]);
  const [indikatorId, setIndikatorId] = useState('');
  const [materiId, setMateriId] = useState('');
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !slot) return;
    setMateri(''); setCatatan(''); setIndikatorId(''); setMateriId('');
    setLoadingStudents(true);
    api.get('/students', { params: { class_id: slot.class_id } })
      .then(({ data }) => {
        setStudents(data || []);
        setAttendance(Object.fromEntries((data || []).map((st) => [st.id, 'hadir'])));
      })
      .catch(() => { setStudents([]); setAttendance({}); toast.error('Gagal memuat daftar siswa'); })
      .finally(() => setLoadingStudents(false));
    const params = { mapel_id: slot.subject_id, ...(slot.semester_id ? { semester_id: slot.semester_id } : {}) };
    Promise.all([api.get('/indikator', { params }), api.get('/materi', { params })])
      .then(([ind, mat]) => { setIndikatorList(ind.data || []); setMateriList(mat.data || []); })
      .catch(() => { setIndikatorList([]); setMateriList([]); });
  }, [open, slot]);

  const counts = STATUSES.reduce((acc, st) => ({
    ...acc, [st.value]: students.filter((s) => (attendance[s.id] || 'hadir') === st.value).length,
  }), {});

  const submit = async () => {
    if (!materi.trim()) { toast.error('Materi pelajaran wajib diisi'); return; }
    setSaving(true);
    try {
      const jurnal = await catatJurnal({
        schedule_id: slot.id,
        materi: materi.trim(),
        indikator_id: indikatorId || null,
        materi_id: materiId || null,
        catatan: catatan.trim() || null,
        attendance_details: students.map((s) => ({
          student_id: s.id, student_name: s.full_name || s.username || '-', status: attendance[s.id] || 'hadir',
        })),
      });
      toast.success('Jurnal tercatat (Catat Jurnal)');
      onSaved?.(slot, jurnal);
      onOpenChange(false);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto" data-testid="catat-jurnal-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <NotebookPen className="h-5 w-5 text-orange-600" /> Catat Jurnal
          </DialogTitle>
        </DialogHeader>
        {slot && (
          <div className="space-y-3 py-2">
            <Alert className="border-orange-200 bg-orange-50">
              <AlertDescription className="text-xs text-orange-900">
                Jam pelajaran ini sudah lewat, jadi jurnal dicatat tanpa scan QR dan ditandai <strong>Catat Jurnal</strong> di riwayat
                (berbeda dari <strong>Jurnal Presisi</strong> yang diisi tepat waktu).
                Bisa diisi sampai pukul 23.59 WIB hari ini; setelah pukul 24.00 tombol ini tidak berlaku lagi.
              </AlertDescription>
            </Alert>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <InfoTile icon={BookOpen} label="Kelas" value={slot.class_name} />
              <InfoTile icon={FileText} label="Mapel" value={slot.subject_name} />
              <InfoTile icon={Clock} label="Jam" value={`${slot.start_time}-${slot.end_time}`} />
              <InfoTile icon={Building} label="Ruang" value={slot.room_name} />
            </div>
            {indikatorList.length > 0 && (
              <div>
                <Label>KD/Indikator (Opsional)</Label>
                <Select value={indikatorId || 'none'} onValueChange={(v) => setIndikatorId(v === 'none' ? '' : v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Pilih KD/Indikator (opsional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Tidak memilih</SelectItem>
                    {indikatorList.map((ind) => (
                      <SelectItem key={ind.id} value={ind.id}>
                        {ind.kode} - {(ind.nama || '').substring(0, 60)}{(ind.nama || '').length > 60 ? '...' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {materiList.length > 0 && (
              <div>
                <Label>Materi/Pokok Bahasan (Opsional)</Label>
                <Select value={materiId || 'none'} onValueChange={(v) => setMateriId(v === 'none' ? '' : v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Pilih materi/pokok bahasan (opsional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Tidak memilih</SelectItem>
                    {materiList.map((m) => <SelectItem key={m.id} value={m.id}>{m.nama}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label htmlFor="cj-materi">Materi yang Diajarkan <span className="text-rose-600">*</span></Label>
              <Textarea id="cj-materi" value={materi} onChange={(e) => setMateri(e.target.value)} rows={3} maxLength={5000}
                placeholder="Contoh: Bab 3 - Bilangan Bulat Positif dan Negatif" className="mt-1" data-testid="catat-jurnal-materi" />
            </div>
            <div>
              <Label htmlFor="cj-catatan">Catatan (Opsional)</Label>
              <Textarea id="cj-catatan" value={catatan} onChange={(e) => setCatatan(e.target.value)} rows={2} maxLength={5000}
                placeholder="Catatan tambahan, tugas, kondisi kelas..." className="mt-1" />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label className="font-semibold">Absensi Siswa</Label>
                <span className="text-xs text-slate-500">H {counts.hadir} · S {counts.sakit} · I {counts.izin} · A {counts.alpa}</span>
              </div>
              <div className="mt-2 max-h-60 overflow-y-auto rounded-lg border border-slate-200 divide-y">
                {loadingStudents ? (
                  <div className="flex items-center gap-2 p-4 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Memuat siswa...</div>
                ) : students.length === 0 ? (
                  <div className="p-4 text-sm italic text-slate-500">Tidak ada siswa di kelas ini.</div>
                ) : students.map((st, i) => {
                  const current = attendance[st.id] || 'hadir';
                  return (
                    <div key={st.id} className="flex items-center gap-2 px-3 py-1.5">
                      <span className="w-6 text-right text-xs text-slate-400">{i + 1}</span>
                      <span className="flex-1 truncate text-sm">{st.full_name}</span>
                      <div className="flex gap-1" role="radiogroup" aria-label={`Kehadiran ${st.full_name}`}>
                        {STATUSES.map((opt) => (
                          <Button key={opt.value} type="button" size="sm" role="radio" aria-checked={current === opt.value}
                            variant={current === opt.value ? 'default' : 'outline'}
                            className={`h-7 px-2 text-xs font-semibold ${current === opt.value ? opt.active : opt.idle}`}
                            onClick={() => setAttendance((a) => ({ ...a, [st.id]: opt.value }))}>
                            {opt.short}
                          </Button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={submit} disabled={saving} className="gap-2 bg-orange-600 hover:bg-orange-700" data-testid="catat-jurnal-submit">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Simpan Jurnal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InfoTile({ icon: Icon, label, value }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-lg bg-slate-50 p-2">
      <Icon className="h-4 w-4 shrink-0 text-slate-500" />
      <div className="min-w-0">
        <div className="text-xs text-slate-500">{label}</div>
        <div className="truncate text-xs font-semibold">{value || '-'}</div>
      </div>
    </div>
  );
}
