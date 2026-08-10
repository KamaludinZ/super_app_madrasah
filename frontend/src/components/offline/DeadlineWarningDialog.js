/**
 * Deadline Warning Dialog
 *
 * Warns user when trying to save offline near or past deadline
 * Provides clear information about grace period and risks
 */

import React from 'react';
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
import { AlertTriangle, Clock, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function DeadlineWarningDialog({ open, onOpenChange, deadlineInfo, onConfirm, onCancel }) {
  if (!deadlineInfo) return null;

  const { isPastDeadline, isPastGrace, minutesLate, canStillSubmit, scheduleEnd, deadline, graceDeadline } = deadlineInfo;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
              isPastGrace ? 'bg-rose-100' : 'bg-amber-100'
            }`}>
              <AlertTriangle className={`h-5 w-5 ${
                isPastGrace ? 'text-rose-600' : 'text-amber-600'
              }`} />
            </div>
            <AlertDialogTitle className="text-lg">
              {isPastGrace ? 'Deadline Sudah Lewat' : 'Mendekati Deadline'}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              {/* Status */}
              <div className="p-3 bg-slate-50 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600">Jam Pelajaran Berakhir:</span>
                  <Badge variant="outline" className="text-xs">
                    {scheduleEnd ? new Date(scheduleEnd).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600">Deadline Pengisian:</span>
                  <Badge variant="outline" className="text-xs">
                    {deadline ? new Date(deadline).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600">Grace Period Hingga:</span>
                  <Badge variant="outline" className="text-xs">
                    {graceDeadline ? new Date(graceDeadline).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                  </Badge>
                </div>
              </div>

              {/* Warning Message */}
              {isPastGrace ? (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Clock className="h-4 w-4 text-rose-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-rose-900">
                      <p className="font-semibold mb-1">Deadline sudah terlewati {minutesLate} menit yang lalu</p>
                      <p className="text-xs">
                        Server akan menolak jurnal ini karena sudah melewati grace period (30 menit setelah deadline).
                      </p>
                    </div>
                  </div>
                </div>
              ) : isPastDeadline ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Clock className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-amber-900">
                      <p className="font-semibold mb-1">Sudah melewati deadline {minutesLate} menit yang lalu</p>
                      <p className="text-xs">
                        Anda masih bisa menyimpan offline, namun harus disinkronkan dalam waktu <strong>{30 - minutesLate} menit</strong> (sebelum grace period habis).
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-blue-900">
                      <p className="font-semibold mb-1">Mendekati deadline</p>
                      <p className="text-xs">
                        Jurnal akan disimpan offline dan otomatis disinkronkan saat internet tersedia. Pastikan tersinkron sebelum grace period habis.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Info */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-slate-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-slate-700">
                    <p className="font-semibold mb-1">Catatan Penting:</p>
                    <ul className="list-disc list-inside space-y-0.5 ml-1">
                      <li>Deadline: Jam berakhir + 1 jam</li>
                      <li>Grace period: 30 menit setelah deadline</li>
                      <li>Validasi menggunakan waktu server (tidak bisa dimanipulasi)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>
            Batal
          </AlertDialogCancel>
          {canStillSubmit ? (
            <AlertDialogAction
              onClick={onConfirm}
              className={isPastDeadline ? 'bg-amber-600 hover:bg-amber-700' : 'bg-[#006837] hover:bg-[#0B7A3B]'}
            >
              {isPastDeadline ? 'Simpan Offline (Risiko)' : 'Simpan Offline'}
            </AlertDialogAction>
          ) : (
            <AlertDialogAction
              disabled
              className="bg-slate-300 cursor-not-allowed"
            >
              Tidak Bisa Disimpan
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default DeadlineWarningDialog;
