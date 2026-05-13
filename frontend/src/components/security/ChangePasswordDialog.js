import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

/**
 * ChangePasswordDialog
 * - Auto-prompts on first login (default password) atau setelah 6 bulan.
 * - User bisa "Ubah Sekarang" atau "Nanti Saja (30 hari)".
 */
export function ChangePasswordDialog({ open, onOpenChange, reason, message, onSuccess, onDismiss }) {
  const [showForm, setShowForm] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPw.length < 6) {
      toast.error('Password baru minimal 6 karakter');
      return;
    }
    if (newPw !== confirmPw) {
      toast.error('Konfirmasi password tidak cocok');
      return;
    }
    if (newPw === currentPw) {
      toast.error('Password baru tidak boleh sama dengan password lama');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/change-password', {
        current_password: currentPw,
        new_password: newPw,
      });
      toast.success('Password berhasil diubah. Gunakan password baru pada login berikutnya.');
      onSuccess?.();
      onOpenChange(false);
      setShowForm(false);
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Gagal mengubah password');
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = async () => {
    try {
      await api.post('/auth/dismiss-password-reminder?days=30');
      toast.info('Pengingat ditunda 30 hari');
      onDismiss?.();
      onOpenChange(false);
      setShowForm(false);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Gagal menunda pengingat');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="change-password-dialog">
        <DialogHeader>
          <div className="flex items-center justify-center mb-3">
            <div className="h-14 w-14 rounded-full bg-amber-100 flex items-center justify-center">
              <ShieldCheck className="h-7 w-7 text-amber-700" />
            </div>
          </div>
          <DialogTitle className="text-center">
            {reason === 'first_login' ? 'Saran Keamanan: Ubah Password' : 'Saatnya Ubah Password Berkala'}
          </DialogTitle>
          <DialogDescription className="text-center pt-2">
            {message || 'Demi keamanan akun Anda, kami menyarankan untuk mengubah password.'}
          </DialogDescription>
        </DialogHeader>

        {!showForm ? (
          <div className="space-y-3 pt-2">
            <Alert className="bg-emerald-50 border-emerald-200">
              <Lock className="h-4 w-4 text-emerald-700" />
              <AlertDescription className="text-emerald-900 text-sm">
                Password yang aman: minimal 6 karakter, hindari tanggal lahir atau nama akrab.
              </AlertDescription>
            </Alert>
            <div className="flex flex-col gap-2 pt-2">
              <Button onClick={() => setShowForm(true)} className="w-full bg-[#006837] hover:bg-[#005a30]" data-testid="btn-change-now">
                Ubah Password Sekarang
              </Button>
              <Button variant="outline" onClick={handleDismiss} data-testid="btn-snooze">
                Nanti Saja (Tunda 30 hari)
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3 pt-2">
            <div>
              <Label htmlFor="cp">Password Lama</Label>
              <div className="relative">
                <Input id="cp" type={showCurrent ? 'text' : 'password'} value={currentPw}
                       onChange={(e) => setCurrentPw(e.target.value)} required
                       data-testid="input-current-password" autoComplete="current-password" />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
                        onClick={() => setShowCurrent((v) => !v)} tabIndex={-1}>
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label htmlFor="np">Password Baru (min. 6 karakter)</Label>
              <div className="relative">
                <Input id="np" type={showNew ? 'text' : 'password'} value={newPw}
                       onChange={(e) => setNewPw(e.target.value)} required minLength={6}
                       data-testid="input-new-password" autoComplete="new-password" />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
                        onClick={() => setShowNew((v) => !v)} tabIndex={-1}>
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label htmlFor="cnp">Konfirmasi Password Baru</Label>
              <Input id="cnp" type={showNew ? 'text' : 'password'} value={confirmPw}
                     onChange={(e) => setConfirmPw(e.target.value)} required
                     data-testid="input-confirm-password" autoComplete="new-password" />
            </div>
            <DialogFooter className="pt-2 gap-2 flex-col sm:flex-row">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="sm:flex-1">
                Batal
              </Button>
              <Button type="submit" disabled={loading} className="sm:flex-1 bg-[#006837] hover:bg-[#005a30]" data-testid="btn-submit-change-password">
                {loading ? 'Menyimpan…' : 'Simpan Password Baru'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
