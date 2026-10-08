import React, { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { KeyRound, Loader2, ShieldCheck, Inbox, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { bolehResetPinSimpanAkun } from '@/lib/menuUmum';
import { ROLE_LABELS } from '@/lib/api';
import { daftarPermintaanReset, resetPinOlehAdmin } from '@/lib/simpanAkun';
import { Button } from '@/components/ui/button';
import { confirmDialog } from '@/components/ui/confirm-dialog';

const formatWaktu = (iso) => (iso
  ? new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '-');

// Admin: daftar GTK yang mengajukan reset PIN Simpan Akun. Admin hanya bisa mereset PIN,
// TIDAK bisa melihat isi simpanan siapa pun.
export default function AdminResetPinSimpanAkunPage() {
  const { activeRole } = useAuth();
  const [daftar, setDaftar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mereset, setMereset] = useState(null); // user_id yang sedang direset

  const muat = useCallback(() => {
    setLoading(true);
    daftarPermintaanReset()
      .then(setDaftar)
      .catch(() => toast.error('Gagal memuat permintaan reset PIN'))
      .finally(() => setLoading(false));
  }, []);

  const boleh = bolehResetPinSimpanAkun(activeRole);
  useEffect(() => { if (boleh) muat(); }, [boleh, muat]);

  const reset = async (p) => {
    const yakin = await confirmDialog(
      `PIN Simpan Akun milik ${p.nama} akan dihapus. Saat membuka Simpan Akun berikutnya, ${p.nama} membuat PIN baru. Isi simpanannya tidak dibuka dan tidak berubah.`,
      { title: 'Reset PIN Simpan Akun?', confirmText: 'Ya, reset PIN' },
    );
    if (!yakin) return;
    setMereset(p.user_id);
    try {
      await resetPinOlehAdmin(p.user_id);
      toast.success(`PIN ${p.nama} berhasil direset`);
      setDaftar((d) => d.filter((x) => x.user_id !== p.user_id));
    } catch (e) {
      toast.error(e?.response?.data?.detail || e?.message || 'Gagal mereset PIN');
    } finally {
      setMereset(null);
    }
  };

  // Non-admin tidak boleh melihat daftar maupun aksi reset PIN.
  if (!boleh) return <Navigate to="/dashboard" replace />;

  return (
    <div className="space-y-6" data-testid="admin-reset-pin-page">
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
          <KeyRound className="h-3 w-3 mr-1" /> Simpan Akun
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Reset PIN Simpan Akun</h1>
        <p className="text-sm text-slate-600 mt-1">Permintaan reset dari GTK yang lupa PIN brankas akunnya</p>
      </div>

      <p className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
        <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
        Reset hanya menghapus PIN agar pemilik membuat PIN baru. Admin tidak dapat melihat akun yang disimpan GTK.
      </p>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-[#006837]" />
              <p className="text-slate-500">Memuat permintaan...</p>
            </div>
          ) : daftar.length === 0 ? (
            <div className="p-10 text-center" data-testid="admin-reset-pin-kosong">
              <Inbox className="mx-auto mb-3 h-10 w-10 text-slate-300" />
              <p className="font-semibold text-slate-700">Tidak ada permintaan reset PIN</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Peran</TableHead>
                    <TableHead>Diajukan</TableHead>
                    <TableHead>Keterangan</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {daftar.map((p) => (
                    <TableRow key={p.user_id} data-testid={`reset-pin-${p.user_id}`}>
                      <TableCell className="font-medium">{p.nama}</TableCell>
                      <TableCell>{ROLE_LABELS[p.peran] || p.peran}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatWaktu(p.reset_diminta_pada)}</TableCell>
                      <TableCell className="max-w-xs text-sm text-slate-600">{p.keterangan || '-'}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => reset(p)} disabled={!!mereset} data-testid={`reset-pin-aksi-${p.user_id}`}>
                          {mereset === p.user_id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                          Reset PIN
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
