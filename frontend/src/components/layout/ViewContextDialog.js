import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar, RotateCcw, Eye, EyeOff } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

/**
 * ViewContextDialog - Per-user context override (3-level hierarchical system).
 *
 * Hierarki: Tahun Takwim → Tahun Pelajaran → Semester
 * Setiap user bisa memilih melihat data di periode lampau tanpa
 * mempengaruhi user lain dan context aktif global.
 */
export default function ViewContextDialog({ open, onOpenChange, onUpdated }) {
  const [ctx, setCtx] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selTT, setSelTT] = useState(''); // NEW: Tahun Takwim selector
  const [selAY, setSelAY] = useState('');
  const [selSem, setSelSem] = useState('');

  useEffect(() => {
    if (open) {
      setLoading(true);
      api.get('/auth/view-context')
        .then(({ data }) => {
          setCtx(data);
          // Initialize selectors with current active values
          // Tahun Takwim: get from semester's tahun_takwim_id
          const currentTT = (data.tahun_takwim_info && data.tahun_takwim_info.length > 0)
            ? data.tahun_takwim_info[0].id
            : '';
          const currentAY = data.academic_year_id || '';
          const currentSem = data.semester_id || '';

          setSelTT(currentTT);
          setSelAY(currentAY);
          setSelSem(currentSem);
        })
        .catch(() => toast.error('Gagal memuat data'))
        .finally(() => setLoading(false));
    }
  }, [open]);

  // Filter academic years by selected Tahun Takwim (NEW)
  const availableAcademicYears = (ctx?.available_academic_years || []).filter((ay) => {
    if (!selTT) return true; // Show all if no filter
    // Filter by Tahun Takwim
    return (ay.tahun_takwim_ids || []).includes(selTT);
  });

  // Filter semesters by selected Tahun Takwim AND academic year (cascade filtering)
  const availableSemesters = (ctx?.available_semesters || []).filter((s) => {
    // First filter by Academic Year if selected (more important)
    if (selAY && s.academic_year_id !== selAY) {
      return false;
    }

    // Then filter by Tahun Takwim if selected AND semester has tahun_takwim_id
    if (selTT && s.tahun_takwim_id) {
      if (s.tahun_takwim_id !== selTT) return false;
    }

    return true;
  });

  // Check if selected semester is the same as active global semester
  const activeSemester = (ctx?.available_semesters || []).find(s => s.is_active);
  const isSelectingActiveSemester = selSem && activeSemester && selSem === activeSemester.id;

  // Determine if showing override UI (orange) - only if user has override AND it's different from active
  const showOverrideUI = ctx?.is_override && !isSelectingActiveSemester;

  const handleApply = async () => {
    if (!selTT || !selAY || !selSem) {
      toast.error('Lengkapi semua field terlebih dahulu');
      return;
    }
    setLoading(true);
    try {
      const payload = { semester_id: selSem };
      const { data } = await api.put('/auth/view-context', payload);
      toast.success(`Konteks lihat: ${data.year_name} - ${data.semester_name || 'aktif'}`);
      onUpdated?.(data);
      onOpenChange(false);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menyimpan');
    } finally { setLoading(false); }
  };

  const handleReset = async () => {
    setLoading(true);
    try {
      const { data } = await api.put('/auth/view-context', {});
      toast.success('Kembali ke TP aktif');
      onUpdated?.(data);
      onOpenChange(false);
    } catch (e) {
      toast.error('Gagal reset');
    } finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="view-context-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-[#006837]" />
            Pilih Tahun Pelajaran & Semester
          </DialogTitle>
          <DialogDescription>
            Lihat data dari TP/semester berbeda. Pengaturan ini <strong>hanya untuk Anda</strong> - tidak mempengaruhi user lain atau TP aktif global.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {showOverrideUI && (
            <Alert className="bg-amber-50 border-amber-200">
              <Eye className="h-4 w-4 text-amber-700" />
              <AlertDescription className="text-amber-900 text-sm">
                Anda sedang dalam mode <strong>VIEW</strong>:{' '}
                {ctx.tahun_takwim_info && ctx.tahun_takwim_info.length > 0 && (
                  <span className="text-xs">({ctx.tahun_takwim_info.map(tt => tt.year).join('/')}) </span>
                )}
                <strong>{ctx.year_name} - {ctx.semester_name}</strong>
              </AlertDescription>
            </Alert>
          )}
          {!showOverrideUI && ctx && (
            <Alert className="bg-emerald-50 border-emerald-200">
              <EyeOff className="h-4 w-4 text-emerald-700" />
              <AlertDescription className="text-emerald-900 text-sm">
                Mengikuti semester aktif global:{' '}
                {ctx.tahun_takwim_info && ctx.tahun_takwim_info.length > 0 && (
                  <span className="text-xs">({ctx.tahun_takwim_info.map(tt => tt.year).join('/')}) </span>
                )}
                <strong>{ctx.year_name} - {ctx.semester_name}</strong>
              </AlertDescription>
            </Alert>
          )}

          <div>
            <Label className="text-xs">Tahun Takwim *</Label>
            <Select value={selTT} onValueChange={(v) => { setSelTT(v); setSelAY(''); setSelSem(''); }}>
              <SelectTrigger data-testid="vc-tt-select"><SelectValue placeholder="Pilih Tahun Takwim" /></SelectTrigger>
              <SelectContent>
                {(ctx?.available_tahun_takwim || []).map((tt) => (
                  <SelectItem key={tt.id} value={tt.id}>
                    {tt.year} - {tt.name} {tt.is_active && <Badge className="ml-1 bg-emerald-500 text-[9px]">AKTIF</Badge>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500 mt-1">
              Pilih Tahun Takwim untuk filter data
            </p>
          </div>

          <div>
            <Label className="text-xs">Tahun Pelajaran *</Label>
            <Select value={selAY} onValueChange={(v) => { setSelAY(v); setSelSem(''); }}>
              <SelectTrigger data-testid="vc-ay-select"><SelectValue placeholder="Pilih TP" /></SelectTrigger>
              <SelectContent>
                {availableAcademicYears.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} {a.is_active && <Badge className="ml-1 bg-emerald-500 text-[9px]">AKTIF</Badge>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500 mt-1">
              {availableAcademicYears.length} TP tersedia {selTT && 'untuk Tahun Takwim ini'}
            </p>
          </div>

          <div>
            <Label className="text-xs">Semester *</Label>
            <Select value={selSem} onValueChange={setSelSem}>
              <SelectTrigger data-testid="vc-sem-select"><SelectValue placeholder="Pilih semester" /></SelectTrigger>
              <SelectContent>
                {availableSemesters.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} ({s.code}) - {s.is_active && <span className="text-emerald-600">AKTIF</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500 mt-1">
              {availableSemesters.length} semester tersedia
              {selAY !== '__ACTIVE__' && selAY && ' untuk TP ini'}
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2 flex-col sm:flex-row">
          {showOverrideUI && (
            <Button variant="outline" onClick={handleReset} disabled={loading} className="gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" /> Reset ke TP Aktif
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Batal</Button>
          <Button onClick={handleApply} disabled={loading || !selTT || !selAY || !selSem} className="bg-[#006837] hover:bg-[#005a30]" data-testid="vc-apply">
            {loading ? 'Menyimpan...' : 'Terapkan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
