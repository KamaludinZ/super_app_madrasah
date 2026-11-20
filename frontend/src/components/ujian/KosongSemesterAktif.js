import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';
import { CalendarX2, Eye, UsersRound } from 'lucide-react';
import { RUTE_UJIAN_TERSEDIA } from '@/lib/ujian';

/**
 * Empty state Beranda Ujian. Grup menu Ujian dimulai kosong setiap semester baru; ujian semester lalu tetap
 * tersimpan sebagai arsip. Dua keadaan: belum ada semester aktif sama sekali, atau semester aktif (konteks lihat
 * pengguna) belum punya ujian. Pengelola mendapat ajakan menyusun kepanitiaan.
 */
export default function KosongSemesterAktif({ konteks, akses }) {
  if (!konteks?.semester_id) {
    return (
      <div data-testid="ujian-kosong-tanpa-semester">
        <EmptyState
          illustration="lantern"
          size="sm"
          title="Belum ada semester aktif"
          description="Ujian selalu terikat pada tahun pelajaran dan semester. Aktifkan semester di menu Master App › Semester agar ujian dapat disusun."
        />
        {akses?.pengelola && (
          <div className="flex justify-center pb-2">
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link to="/admin/semesters"><CalendarX2 className="h-4 w-4" /> Atur Semester</Link>
            </Button>
          </div>
        )}
      </div>
    );
  }

  const label = `Semester ${konteks.semester_nama} TP ${konteks.tahun_pelajaran}`;
  const bisaSusun = akses?.pengelola && RUTE_UJIAN_TERSEDIA.has('/ujian/panitia');
  return (
    <div data-testid="ujian-kosong-semester">
      <EmptyState
        illustration="quran"
        size="sm"
        title={`Belum ada ujian di ${label}`}
        description="Setiap semester baru dimulai dengan daftar ujian kosong. Ujian UTS dan UAS semester sebelumnya tetap tersimpan dan dapat dibuka dari arsip."
      />
      <div className="flex flex-col items-center gap-2 pb-2 text-center">
        {konteks.is_override && (
          <p className="inline-flex items-center gap-1 text-xs text-sky-700" data-testid="ujian-kosong-override">
            <Eye className="h-3.5 w-3.5" /> Anda sedang melihat konteks semester lain lewat Konteks Lihat.
          </p>
        )}
        {bisaSusun && (
          <Button asChild size="sm" className="gap-2 bg-[#006837] hover:bg-[#005a2f]">
            <Link to="/ujian/panitia"><UsersRound className="h-4 w-4" /> Susun Ujian & Kepanitiaan</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
