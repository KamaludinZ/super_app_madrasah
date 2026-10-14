import React from 'react';
import { AlertTriangle } from 'lucide-react';

/** Jurnal lama yang hanya menyimpan JUMLAH H/S/I/A (tanpa nama): daftar nama hanyalah perkiraan. */
export default function KehadiranPerkiraanNotice({ show, bisaEdit = false }) {
  if (!show) return null;
  return (
    <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900" data-testid="kehadiran-perkiraan">
      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
      <span>
        Jurnal ini tersimpan sebelum perbaikan sehingga hanya jumlah kehadirannya yang tercatat, bukan nama per siswa.
        Daftar nama di bawah adalah <b>perkiraan</b> dan bisa tidak sesuai.
        {bisaEdit ? ' Sesuaikan status tiap siswa lalu simpan untuk menetapkan data yang benar.' : ' Admin dapat memperbaikinya lewat Edit Jurnal.'}
      </span>
    </div>
  );
}
