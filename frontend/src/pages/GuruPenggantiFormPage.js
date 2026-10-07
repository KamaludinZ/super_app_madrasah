import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  UserRoundCog, ArrowLeft, ArrowRight, Check, UserMinus, Clock, CalendarDays, UserPlus, ClipboardCheck,
  AlertCircle, RotateCcw,
} from 'lucide-react';
import { DAY_LABELS } from '@/lib/api';
import GuruPenggantiGuard from '@/components/guru-pengganti/GuruPenggantiGuard';
import { apiErrorMessage, createAssignments } from '@/lib/guruPenggantiSchedule';
import StepPilihGuruDigantikan from '@/components/guru-pengganti/StepPilihGuruDigantikan';
import StepPilihSlot from '@/components/guru-pengganti/StepPilihSlot';
import StepPilihTanggal from '@/components/guru-pengganti/StepPilihTanggal';
import StepPilihGuruPengganti from '@/components/guru-pengganti/StepPilihGuruPengganti';
import StepRingkasan, { draftProblem } from '@/components/guru-pengganti/StepRingkasan';
import SaveSuccess from '@/components/guru-pengganti/SaveSuccess';
import { toast } from 'sonner';

// Urutan alur penugasan sesuai PRD:
// guru yang digantikan → slot jam & kelas → tanggal → guru pengganti → simpan.
const STEPS = [
  { key: 'original', label: 'Guru Digantikan', icon: UserMinus, hint: 'Pilih guru yang berhalangan hadir.' },
  { key: 'slot', label: 'Slot Jam & Kelas', icon: Clock, hint: 'Pilih slot jadwal mengajar guru tersebut.' },
  { key: 'dates', label: 'Tanggal', icon: CalendarDays, hint: 'Tandai satu atau beberapa tanggal sesuai hari jadwal.' },
  { key: 'substitute', label: 'Guru Pengganti', icon: UserPlus, hint: 'Pilih guru yang akan mengisi jurnal.' },
  { key: 'review', label: 'Simpan', icon: ClipboardCheck, hint: 'Periksa ringkasan lalu simpan penugasan.' },
];

export const EMPTY_DRAFT = {
  originalTeacherId: '',
  originalTeacherName: '',
  slot: null, // { id, day, jam_ke, start_time, end_time, class_name, subject_name }
  dates: [], // ['YYYY-MM-DD', ...]
  substituteTeacherId: '',
  substituteTeacherName: '',
  substituteSubject: '',
  reason: '',
};

// Langkah ke-i boleh dibuka bila semua langkah sebelumnya sudah terisi.
const isStepComplete = (key, draft) => {
  if (key === 'original') return !!draft.originalTeacherId;
  if (key === 'slot') return !!draft.slot;
  if (key === 'dates') return draft.dates.length > 0;
  if (key === 'substitute') return !!draft.substituteTeacherId;
  return false;
};

export default function GuruPenggantiFormPage() {
  return (
    <GuruPenggantiGuard>
      <GuruPenggantiForm />
    </GuruPenggantiGuard>
  );
}

function GuruPenggantiForm() {
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState(EMPTY_DRAFT);

  const step = STEPS[stepIndex];
  const canProceed = step.key === 'review' || isStepComplete(step.key, draft);
  const reachable = (i) => STEPS.slice(0, i).every((s) => isStepComplete(s.key, draft));

  const goTo = (i) => { if (reachable(i)) setStepIndex(i); };
  const next = () => { if (canProceed && stepIndex < STEPS.length - 1) setStepIndex(stepIndex + 1); };
  const back = () => (stepIndex === 0 ? navigate('/guru-pengganti') : setStepIndex(stepIndex - 1));

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [savedResult, setSavedResult] = useState(null);
  const problem = draftProblem(draft);
  const save = async () => {
    if (problem || saving) return;
    setSaving(true);
    setSaveError('');
    try {
      const result = await createAssignments({
        scheduleId: draft.slot.id,
        dates: draft.dates,
        substituteTeacherId: draft.substituteTeacherId,
        reason: draft.reason,
      });
      // Lengkapi nama untuk kartu konfirmasi (server menyimpan id).
      const created = (result.created || []).map((a) => ({
        ...a,
        class_name: draft.slot.class_name,
        jam_ke: draft.slot.jam_ke,
        original_teacher_name: draft.originalTeacherName,
        substitute_teacher_name: draft.substituteTeacherName,
      }));
      toast.success(`${created.length} penugasan guru pengganti tersimpan`);
      setSavedResult(created);
    } catch (e) {
      setSaveError(apiErrorMessage(e, 'Gagal menyimpan penugasan. Periksa koneksi lalu coba lagi.'));
      toast.error('Penugasan gagal disimpan');
    } finally {
      setSaving(false);
    }
  };

  const assignAgain = () => {
    setSavedResult(null);
    setDraft(EMPTY_DRAFT);
    setStepIndex(0);
  };

  if (savedResult) {
    return (
      <div className="max-w-2xl mx-auto" data-testid="guru-pengganti-form-page">
        <SaveSuccess
          created={savedResult}
          onViewList={() => navigate('/guru-pengganti')}
          onAssignAgain={assignAgain}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="guru-pengganti-form-page">
      <div>
        <Link to="/guru-pengganti" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-[#006837] mb-3">
          <ArrowLeft className="h-4 w-4" /> Daftar penugasan
        </Link>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2 flex w-fit">
          <UserRoundCog className="h-3 w-3 mr-1" /> Guru Pengganti
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Tugaskan Guru Pengganti</h1>
        <p className="text-sm text-slate-600 mt-1">{step.hint}</p>
      </div>

      {/* Stepper */}
      <ol className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-1" data-testid="gp-stepper">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const done = i < stepIndex && isStepComplete(s.key, draft);
          const active = i === stepIndex;
          const enabled = reachable(i);
          return (
            <li key={s.key} className="flex items-center gap-1 sm:gap-2 shrink-0">
              <button
                type="button"
                onClick={() => goTo(i)}
                disabled={!enabled}
                aria-current={active ? 'step' : undefined}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors ${
                  active
                    ? 'bg-[#006837] border-[#006837] text-white'
                    : done
                      ? 'bg-[#006837]/10 border-[#006837]/20 text-[#006837] hover:bg-[#006837]/15'
                      : 'bg-white border-slate-200 text-slate-500'
                } disabled:cursor-not-allowed disabled:opacity-60`}
                data-testid={`gp-step-${s.key}`}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                <span className={active ? '' : 'hidden sm:inline'}>{s.label}</span>
              </button>
              {i < STEPS.length - 1 && <span className="h-px w-3 sm:w-6 bg-slate-200" aria-hidden />}
            </li>
          );
        })}
      </ol>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardContent className="p-4 sm:p-6 min-h-[280px]" data-testid={`gp-step-body-${step.key}`}>
            <StepBody stepKey={step.key} draft={draft} setDraft={setDraft} />
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardContent className="p-4 space-y-3" data-testid="gp-summary">
            <h3 className="font-bold text-[#006837] text-sm">Ringkasan Penugasan</h3>
            <SummaryRow
              label="Guru digantikan"
              value={draft.originalTeacherId && `${draft.originalTeacherName}${draft.reason ? ` · ${draft.reason}` : ''}`}
            />
            <SummaryRow
              label="Slot"
              value={draft.slot && `${DAY_LABELS[draft.slot.day]} · ${draft.slot.class_name} · Jam ke-${draft.slot.jam_ke} (${draft.slot.start_time}-${draft.slot.end_time})`}
            />
            <SummaryRow label="Tanggal" value={draft.dates.length ? `${draft.dates.length} tanggal dipilih` : null} />
            <SummaryRow label="Guru pengganti" value={draft.substituteTeacherName || null} />
          </CardContent>
        </Card>
      </div>

      {saveError && step.key === 'review' && (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3" data-testid="gp-save-error">
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-rose-800">Penugasan belum tersimpan</div>
            <div className="text-sm text-rose-700">{saveError}</div>
          </div>
          <Button variant="outline" size="sm" onClick={save} disabled={saving} className="gap-1 shrink-0">
            <RotateCcw className="h-3.5 w-3.5" /> Coba lagi
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" onClick={back} className="gap-2" data-testid="gp-back">
          <ArrowLeft className="h-4 w-4" /> {stepIndex === 0 ? 'Batal' : 'Kembali'}
        </Button>
        {step.key === 'review' ? (
          <Button
            onClick={save}
            disabled={!!problem || saving}
            className="bg-[#006837] hover:bg-[#0B7A3B] gap-2"
            data-testid="gp-save"
          >
            <Check className="h-4 w-4" /> {saving ? 'Menyimpan...' : 'Simpan Penugasan'}
          </Button>
        ) : (
          <Button
            onClick={next}
            disabled={!canProceed}
            className="bg-[#006837] hover:bg-[#0B7A3B] gap-2"
            data-testid="gp-next"
          >
            Lanjut <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="text-sm">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={value ? 'font-medium text-slate-900' : 'text-slate-400 italic'}>{value || 'Belum dipilih'}</div>
    </div>
  );
}

// Isi tiap langkah diisi bertahap (pilih guru, slot, kalender, pengganti, simpan).
function StepBody({ stepKey, draft, setDraft }) {
  if (stepKey === 'original') return <StepPilihGuruDigantikan draft={draft} setDraft={setDraft} />;
  if (stepKey === 'slot') return <StepPilihSlot draft={draft} setDraft={setDraft} />;
  if (stepKey === 'dates') return <StepPilihTanggal draft={draft} setDraft={setDraft} />;
  if (stepKey === 'substitute') return <StepPilihGuruPengganti draft={draft} setDraft={setDraft} />;
  if (stepKey === 'review') return <StepRingkasan draft={draft} />;
  const step = STEPS.find((s) => s.key === stepKey);
  const Icon = step.icon;
  return (
    <div className="h-full flex flex-col items-center justify-center text-center py-10 text-slate-400">
      <Icon className="h-10 w-10 mb-3" />
      <div className="text-sm font-medium text-slate-600">{step.label}</div>
      <div className="text-xs mt-1">{step.hint}</div>
    </div>
  );
}
