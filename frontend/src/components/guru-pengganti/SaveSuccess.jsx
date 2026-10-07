import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, List, Plus } from 'lucide-react';
import { DAY_LABELS } from '@/lib/api';
import { parseLocalIso } from '@/lib/guruPengganti';

/** Konfirmasi setelah penugasan guru pengganti berhasil disimpan. */
export default function SaveSuccess({ created, onViewList, onAssignAgain }) {
  const first = created[0];
  return (
    <Card data-testid="gp-save-success">
      <CardContent className="p-6 sm:p-8 text-center space-y-4">
        <div className="mx-auto h-14 w-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Penugasan tersimpan</h2>
          <p className="text-sm text-slate-600 mt-1">
            <span className="font-semibold">{first.substitute_teacher_name}</span> menggantikan{' '}
            <span className="font-semibold">{first.original_teacher_name}</span> di {first.class_name}
            {' '}({DAY_LABELS[first.day]}, jam ke-{first.jam_ke}) pada {created.length} tanggal.
          </p>
        </div>
        <ul className="flex flex-wrap justify-center gap-1.5">
          {created.map((a) => (
            <li key={a.id} className="text-xs rounded-full bg-slate-100 text-slate-700 px-2.5 py-1">
              {parseLocalIso(a.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
            </li>
          ))}
        </ul>
        <p className="text-xs text-slate-500">Slot sudah muncul di jadwal guru pengganti pada tanggal tersebut.</p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
          <Button variant="outline" onClick={onAssignAgain} className="gap-2" data-testid="gp-assign-again">
            <Plus className="h-4 w-4" /> Tugaskan Lagi
          </Button>
          <Button onClick={onViewList} className="bg-[#006837] hover:bg-[#0B7A3B] gap-2" data-testid="gp-view-list">
            <List className="h-4 w-4" /> Lihat Daftar Penugasan
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
