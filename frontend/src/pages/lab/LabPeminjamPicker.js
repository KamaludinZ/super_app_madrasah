import React, { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';

/**
 * Cascading picker: Jenis (Siswa / GTK) -> filter (Tingkat+Kelas / Guru+Tendik) -> Nama.
 * Reused by Peminjaman Alat ("Peminjam") and Laporan Kerusakan ("Pelapor").
 */
export default function LabPeminjamPicker({ labKey, value, onChange, label = 'Nama', required = false }) {
  const [jenis, setJenis] = useState('siswa'); // 'siswa' | 'gtk'
  const [gtkJenis, setGtkJenis] = useState('guru'); // 'guru' | 'tenaga_kependidikan'
  const [classes, setClasses] = useState([]);
  const [grade, setGrade] = useState('');
  const [classId, setClassId] = useState('');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/classes').then(({ data }) => setClasses(data || [])).catch(() => {});
  }, []);

  const gradeOptions = [...new Set(classes.map((c) => c.grade))].sort((a, b) => a - b);
  const classOptions = classes.filter((c) => !grade || String(c.grade) === String(grade));

  useEffect(() => {
    setLoading(true);
    const params = { peminjam_jenis: jenis };
    if (jenis === 'siswa') {
      if (classId) params.class_id = classId;
      else if (grade) params.grade = grade;
    } else {
      params.gtk_jenis = gtkJenis;
    }
    api.get(`/lab/${labKey}/warga-madrasah`, { params })
      .then(({ data }) => setOptions(data || []))
      .catch(() => setOptions([]))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labKey, jenis, gtkJenis, grade, classId]);

  const handleJenisChange = (v) => {
    setJenis(v);
    setGrade(''); setClassId('');
    onChange('');
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>Jenis {label}</Label>
        <Select value={jenis} onValueChange={handleJenisChange}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="siswa">Siswa</SelectItem>
            <SelectItem value="gtk">Guru / Tenaga Kependidikan</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {jenis === 'siswa' ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Tingkat</Label>
            <Select value={grade || 'all'} onValueChange={(v) => { setGrade(v === 'all' ? '' : v); setClassId(''); }}>
              <SelectTrigger><SelectValue placeholder="Semua Tingkat" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Tingkat</SelectItem>
                {gradeOptions.map((g) => <SelectItem key={g} value={String(g)}>Kelas {g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Kelas</Label>
            <Select value={classId || 'all'} onValueChange={(v) => setClassId(v === 'all' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Semua Kelas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kelas</SelectItem>
                {classOptions.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Label>Jenis GTK</Label>
          <Select value={gtkJenis} onValueChange={setGtkJenis}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="guru">Guru</SelectItem>
              <SelectItem value="tenaga_kependidikan">Tenaga Kependidikan</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label>{label} {required && <span className="text-rose-500">*</span>}</Label>
        <Select value={value || 'none'} onValueChange={(v) => onChange(v === 'none' ? '' : v)}>
          <SelectTrigger><SelectValue placeholder={loading ? 'Memuat...' : `Pilih ${label}`} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Pilih {label}</SelectItem>
            {options.map((o) => <SelectItem key={o.id} value={o.id}>{o.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
        {!loading && options.length === 0 && (
          <p className="text-xs text-amber-600">Tidak ada data untuk filter ini.</p>
        )}
      </div>
    </div>
  );
}
