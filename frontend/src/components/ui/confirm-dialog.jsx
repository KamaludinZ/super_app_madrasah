import { useEffect, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// Pengganti window.confirm() yang tampil sesuai gaya aplikasi.
// Pemakaian:  if (!(await confirmDialog('Hapus data ini?'))) return;
let openDialog = null;

export function confirmDialog(message, options = {}) {
  if (!openDialog) {
    // Host belum terpasang (mis. di luar App) -> jatuh ke dialog bawaan browser
    return Promise.resolve(window.confirm(message));
  }
  return new Promise((resolve) => openDialog({ message, options, resolve }));
}

export function ConfirmDialogHost() {
  const [state, setState] = useState(null);

  useEffect(() => {
    openDialog = (next) => setState(next);
    return () => { openDialog = null; };
  }, []);

  const close = (result) => {
    state?.resolve(result);
    setState(null);
  };

  const message = String(state?.message ?? '');
  const isDestructive = /hapus|delete|batalkan|nonaktif|reset|tolak|keluar/i.test(message);

  return (
    <AlertDialog open={!!state} onOpenChange={(open) => { if (!open) close(false); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{state?.options?.title || 'Konfirmasi'}</AlertDialogTitle>
          <AlertDialogDescription className="whitespace-pre-line">{message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => close(false)}>
            {state?.options?.cancelText || 'Batal'}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => close(true)}
            className={isDestructive ? 'bg-rose-600 hover:bg-rose-700' : 'bg-[#006837] hover:bg-[#0B7A3B]'}
          >
            {state?.options?.confirmText || 'Ya, lanjutkan'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
