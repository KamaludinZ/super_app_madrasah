import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BookOpen, Building, FileText, Loader2, Send, User, UserRoundCog } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const STATUSES = [
  { value: 'hadir', short: 'H', active: 'bg-emerald-600 hover:bg-emerald-700 text-white', idle: 'hover:bg-emerald-50' },
  { value: 'sakit', short: 'S', active: 'bg-amber-600 hover:bg-amber-700 text-white', idle: 'hover:bg-amber-50' },
  { value: 'izin', short: 'I', active: 'bg-blue-600 hover:bg-blue-700 text-white', idle: 'hover:bg-blue-50' },
  { value: 'alpha', short: 'A', active: 'bg-red-600 hover:bg-red-700 text-white', idle: 'hover:bg-red-50' },
];

async function loadStudents(classId) {
  if (!classId) return [];
  const { data } = await api.get('/students', { params: { class_id: classId } });
  return data || [];
}

/**
 * Form isi jurnal pada slot yang melibatkan guru pengganti
 * (mengikuti form isi jurnal piket: materi, catatan, absensi siswa).
 *
 * mode 'substitute': guru pengganti mengisi slot yang ditugaskan (dengan absensi).
 * mode 'original'  : guru yang digantikan tetap mengisi jurnal slot-nya sendiri dari luar kelas
 *                    (tanpa absensi; dicatat guru pengganti). Kedua jurnal tersimpan berdampingan.
 */
export default function SubstituteJournalDialog({ slot, open, onOpenChange, onSaved, mode = 'substitute' }) {
  const isOriginal = mode === 'original';
  const [materi, setMateri] = useState('');
  const [catatan, setCatatan] = useState('');
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !slot) return;
    setMateri('');
    setCatatan('');
    if (isOriginal) { setStudents([]); setAttendance({}); return; }
    setLoadingStudents(true);
    loadStudents(slot.class_id)
      .then((list) => {
        setStudents(list);
        setAttendance(Object.fromEntries(list.map((st) => [st.id, 'hadir'])));
      })
      .catch(() => { setStudents([]); setAttendance({}); toast.error('Gagal memuat daftar siswa'); })
      .finally(() => setLoadingStudents(false));
  }, [open, slot, isOriginal]);

  const counts = STATUSES.reduce((acc, st) => ({
    ...acc, [st.value]: students.filter((s) => (attendance[s.id] || 'hadir') === st.value).length,
  }), {});

  const submit = async () => {
    if (!materi.trim()) { toast.error('Materi wajib diisi'); return; }
    const payload = {
      mode,
      assignment_id: isOriginal ? slot.substitute?.assignment_id : slot.assignment_id,
      schedule_id: slot.id,
      date: slot.date,
      materi: materi.trim(),
      catatan: catatan.trim() || null,
      siswa_hadir: counts.hadir,
      siswa_tidak_hadir: counts.alpha,
      siswa_izin: counts.izin,
      siswa_sakit: counts.sakit,
      attendance_records: students.map((s) => ({
        student_id: s.id, student_name: s.full_name, status: attendance[s.id] || 'hadir',
      })),
    };
    setSaving(true);
    try {
      if (!isOriginal) {
        // Guru pengganti: POST /guru-pengganti/journals (pola piket_fill_journal; jurnal terpisah).
        await api.post('/guru-pengganti/journals', {
          assignment_id: payload.assignment_id,
          materi: payload.materi,
          catatan: payload.catatan,
          attendance_records: payload.attendance_records,
        });
      } else {
        // Guru asli: POST /guru-pengganti/journals/original (tanpa QR, berdampingan dengan jurnal pengganti).
        await api.post('/guru-pengganti/journals/original', {
          assignment_id: payload.assignment_id,
          materi: payload.materi,
          catatan: payload.catatan,
        });
      }
      toast.success(isOriginal ? 'Jurnal Anda tersimpan berdampingan dengan jurnal guru pengganti' : 'Jurnal guru pengganti tersimpan');
      onSaved?.(slot);
      onOpenChange(false);
    } catch (e) {
      const detail = e?.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Gagal menyimpan jurnal');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto" data-testid="substitute-journal-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserRoundCog className="h-5 w-5 text-amber-600" /> {isOriginal ? 'Isi Jurnal Slot Saya' : 'Isi Jurnal sebagai Guru Pengganti'}
          </DialogTitle>
        </DialogHeader>
        {slot && (
          <div className="space-y-3 py-2">
            <Alert className="border-amber-200 bg-amber-50">
              <AlertDescription className="text-amber-900 text-xs">
                {isOriginal ? (
                  <>
                    Slot ini sedang diampu <strong>{slot.substitute?.substitute_teacher_name || 'guru pengganti'}</strong>.
                    Anda tetap bisa mengisi jurnal sendiri (mis. materi/tugas yang Anda berikan); catatan Anda
                    disimpan berdampingan dan tidak menimpa jurnal guru pengganti. Absensi dicatat guru pengganti.
                  </>
                ) : (
                  <>
                    Anda menggantikan <strong>{slot.original_teacher_name}</strong>. Jurnal ini disimpan terpisah dan
                    tidak menimpa jurnal guru yang digantikan.
                  </>
                )}
              </AlertDescription>
            </Alert>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <InfoTile icon={BookOpen} label="Kelas" value={slot.class_name} />
              {isOriginal ? (
                <InfoTile icon={UserRoundCog} label="Guru Pengganti" value={slot.substitute?.substitute_teacher_name} />
              ) : (
                <InfoTile icon={User} label="Guru Digantikan" value={slot.original_teacher_name} />
              )}
              <InfoTile icon={FileText} label="Mapel" value={slot.subject_name} />
              <InfoTile icon={Building} label="Jam / Ruang" value={`${slot.start_time}-${slot.end_time} · ${slot.room_name || '-'}`} />
            </div>
            <div>
              <Label htmlFor="sj-materi">Materi yang Disampaikan *</Label>
              <Textarea id="sj-materi" value={materi} onChange={(e) => setMateri(e.target.value)} rows={3}
                placeholder="Materi/kegiatan yang dilakukan di kelas..." data-testid="substitute-journal-materi" />
            </div>
            <div>
              <Label htmlFor="sj-catatan">Catatan Pembelajaran (Opsional)</Label>
              <Textarea id="sj-catatan" value={catatan} onChange={(e) => setCatatan(e.target.value)} rows={2} />
            </div>
            {!isOriginal && (
            <div>
              <div className="flex items-center justify-between">
                <Label className="font-semibold">Absensi Siswa</Label>
                <span className="text-xs text-slate-500">
                  H {counts.hadir} · S {counts.sakit} · I {counts.izin} · A {counts.alpha}
                </span>
              </div>
              <div className="mt-2 max-h-60 overflow-y-auto border border-slate-200 rounded-lg divide-y">
                {loadingStudents ? (
                  <div className="p-4 text-sm text-slate-500 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Memuat siswa...
                  </div>
                ) : students.length === 0 ? (
                  <div className="p-4 text-sm text-slate-500 italic">Tidak ada siswa di kelas ini.</div>
                ) : students.map((st, i) => {
                  const current = attendance[st.id] || 'hadir';
                  return (
                    <div key={st.id} className="flex items-center gap-2 px-3 py-1.5">
                      <span className="w-6 text-xs text-slate-400 text-right">{i + 1}</span>
                      <span className="flex-1 text-sm truncate">{st.full_name}</span>
                      <div className="flex gap-1" role="radiogroup" aria-label={`Kehadiran ${st.full_name}`}>
                        {STATUSES.map((opt) => (
                          <Button
                            key={opt.value}
                            type="button"
                            size="sm"
                            role="radio"
                            aria-checked={current === opt.value}
                            variant={current === opt.value ? 'default' : 'outline'}
                            className={`h-7 px-2 text-xs font-semibold ${current === opt.value ? opt.active : opt.idle}`}
                            onClick={() => setAttendance((a) => ({ ...a, [st.id]: opt.value }))}
                          >
                            {opt.short}
                          </Button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={submit} disabled={saving} className="bg-amber-600 hover:bg-amber-700 gap-2" data-testid="substitute-journal-submit">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Simpan Jurnal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InfoTile({ icon: Icon, label, value }) {
  return (
    <div className="p-2 bg-slate-50 rounded-lg flex items-center gap-2 min-w-0">
      <Icon className="h-4 w-4 text-slate-500 shrink-0" />
      <div className="min-w-0">
        <div className="text-xs text-slate-500">{label}</div>
        <div className="font-semibold text-xs truncate">{value || '-'}</div>
      </div>
    </div>
  );
}
