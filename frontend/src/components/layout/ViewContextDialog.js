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
 * ViewContextDialog - Per-user TP/Semester override.
 *
 * Setiap user bisa memilih melihat data di TP/semester lampau tanpa
 * mempengaruhi user lain dan TP aktif global.
 */
export default function ViewContextDialog({ open, onOpenChange, onUpdated }) {
  const [ctx, setCtx] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selAY, setSelAY] = useState('');
  const [selSem, setSelSem] = useState('');

  useEffect(() => {
    if (open) {
      setLoading(true);
      api.get('/auth/view-context')
        .then(({ data }) => {
          setCtx(data);
          setSelAY(data.is_active_global ? '__ACTIVE__' : (data.academic_year_id || ''));
          setSelSem(data.is_active_global ? '__ACTIVE__' : (data.semester || ''));
        })
        .catch(() => toast.error('Gagal memuat data TP'))
        .finally(() => setLoading(false));
    }
  }, [open]);

  const currentAY = (ctx?.available_academic_years || []).find((a) => a.id === selAY) || null;
  const availableSemesters = (currentAY?.semesters || ctx?.available_semesters || ['ganjil', 'genap']);

  const handleApply = async () => {
    setLoading(true);
    try {
      const payload = (selAY === '__ACTIVE__' || !selAY) ? {} : {
        academic_year_id: selAY,
        semester: (selSem === '__ACTIVE__' || !selSem) ? null : selSem,
      };
      const { data } = await api.put('/auth/view-context', payload);
      toast.success(`Konteks lihat: ${data.year_name} - ${data.semester || 'aktif'}`);
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
          {ctx?.is_override && (
            <Alert className="bg-amber-50 border-amber-200">
              <Eye className="h-4 w-4 text-amber-700" />
              <AlertDescription className="text-amber-900 text-sm">
                Anda sedang dalam mode <strong>VIEW</strong>: <strong>{ctx.year_name} - {ctx.semester}</strong>
              </AlertDescription>
            </Alert>
          )}
          {!ctx?.is_override && ctx && (
            <Alert className="bg-emerald-50 border-emerald-200">
              <EyeOff className="h-4 w-4 text-emerald-700" />
              <AlertDescription className="text-emerald-900 text-sm">
                Mengikuti TP aktif global: <strong>{ctx.year_name} - {ctx.semester}</strong>
              </AlertDescription>
            </Alert>
          )}

          <div>
            <Label className="text-xs">Tahun Pelajaran</Label>
            <Select value={selAY} onValueChange={(v) => { setSelAY(v); setSelSem(''); }}>
              <SelectTrigger data-testid="vc-ay-select"><SelectValue placeholder="Pilih TP" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__ACTIVE__">
                  <span className="flex items-center gap-1.5">
                    Ikut TP Aktif Global
                  </span>
                </SelectItem>
                {(ctx?.available_academic_years || []).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} {a.is_active && <Badge className="ml-1 bg-emerald-500 text-[9px]">AKTIF</Badge>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selAY && selAY !== '__ACTIVE__' && (
            <div>
              <Label className="text-xs">Semester</Label>
              <Select value={selSem} onValueChange={setSelSem}>
                <SelectTrigger data-testid="vc-sem-select"><SelectValue placeholder="Pilih semester" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__ACTIVE__">Default (semester aktif TP itu)</SelectItem>
                  {availableSemesters.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2 flex-col sm:flex-row">
          {ctx?.is_override && (
            <Button variant="outline" onClick={handleReset} disabled={loading} className="gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" /> Reset ke TP Aktif
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Batal</Button>
          <Button onClick={handleApply} disabled={loading || !selAY} className="bg-[#006837] hover:bg-[#005a30]" data-testid="vc-apply">
            {loading ? 'Menyimpan...' : 'Terapkan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
