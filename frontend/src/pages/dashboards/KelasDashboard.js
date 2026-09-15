import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, BookOpen, ClipboardList, UserCircle, Calendar, GraduationCap, BookMarked } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { api } from '@/lib/api';
import { KemenagBadge } from '@/components/branding/KemenagBadge';
import { IslamicBackground } from '@/components/patterns/IslamicPatterns';

const KelasDashboard = () => {
  const { user } = useAuth();
  const [waliKelas, setWaliKelas] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWaliKelas = async () => {
      if (!user?.wali_kelas_id) {
        setLoading(false);
        return;
      }

      try {
        const { data } = await api.get('/kelas/wali-kelas');
        setWaliKelas(data);
      } catch (error) {
        console.error('Error fetching wali kelas:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchWaliKelas();
  }, [user?.wali_kelas_id]);

  return (
    <div className="section-spacing">
      <IslamicBackground pattern="star" opacity={0.02} />
      <div>
        <KemenagBadge variant="default" className="mb-2" />
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Dashboard Kelas</h1>
        <p className="text-sm text-slate-600 mt-1">
          Selamat datang di Kelas {user?.name}
        </p>
      </div>

      {/* Informasi Kelas - Moved to top with better design */}
      <Card className="border-2 border-blue-100 bg-gradient-to-br from-blue-50 to-white">
        <CardHeader className="border-b border-blue-100 bg-white/50">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-blue-600" />
            <CardTitle className="text-blue-900">Informasi Kelas</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Nama Kelas */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-white border border-blue-100">
              <div className="bg-blue-100 p-2 rounded-lg">
                <BookMarked className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <span className="text-xs text-slate-500 uppercase tracking-wide">Nama Kelas</span>
                <p className="font-semibold text-slate-900 mt-0.5">{user?.name}</p>
              </div>
            </div>

            {/* Tingkat */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-white border border-blue-100">
              <div className="bg-purple-100 p-2 rounded-lg">
                <GraduationCap className="h-5 w-5 text-purple-600" />
              </div>
              <div className="flex-1">
                <span className="text-xs text-slate-500 uppercase tracking-wide">Tingkat</span>
                <p className="font-semibold text-slate-900 mt-0.5">Kelas {user?.grade}</p>
              </div>
            </div>

            {/* Wali Kelas */}
            {waliKelas && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-white border border-green-100">
                <div className="bg-green-100 p-2 rounded-lg">
                  <UserCircle className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1">
                  <span className="text-xs text-slate-500 uppercase tracking-wide">Wali Kelas</span>
                  <p className="font-semibold text-slate-900 mt-0.5">
                    {waliKelas.full_name || waliKelas.username}
                  </p>
                  {waliKelas.nip && (
                    <p className="text-xs text-slate-500 mt-0.5">NIP: {waliKelas.nip}</p>
                  )}
                </div>
              </div>
            )}

            {/* Tahun Pelajaran */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-white border border-amber-100">
              <div className="bg-amber-100 p-2 rounded-lg">
                <Calendar className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <span className="text-xs text-slate-500 uppercase tracking-wide">Tahun Pelajaran</span>
                <p className="font-semibold text-slate-900 mt-0.5">{user?.academic_year_name}</p>
                <p className="text-xs text-slate-500 mt-0.5">Semester {user?.semester_name}</p>
              </div>
            </div>
          </div>

          {loading && !waliKelas && user?.wali_kelas_id && (
            <div className="mt-4 text-center text-sm text-slate-500">
              Memuat informasi wali kelas...
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Menu */}
      <div>
        <h2 className="text-xl font-semibold mb-4 text-slate-700">Menu Cepat</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 grid-spacing-comfortable">
          <Card className="hover:shadow-lg transition-all hover:scale-105 cursor-pointer border-2 hover:border-purple-200" onClick={() => window.location.href = '/data-siswa'}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="bg-purple-100 p-3 rounded-lg">
                  <Users className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <CardTitle>Data Siswa</CardTitle>
                  <CardDescription>Lihat daftar siswa</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-lg transition-all hover:scale-105 cursor-pointer border-2 hover:border-green-200" onClick={() => window.location.href = '/pembelajaran/materi'}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="bg-green-100 p-3 rounded-lg">
                  <BookOpen className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <CardTitle>Materi Mapel</CardTitle>
                  <CardDescription>Akses materi pembelajaran</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-lg transition-all hover:scale-105 cursor-pointer border-2 hover:border-blue-200" onClick={() => window.location.href = '/pembelajaran/tugas'}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 p-3 rounded-lg">
                  <ClipboardList className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <CardTitle>Tugas</CardTitle>
                  <CardDescription>Lihat tugas yang diberikan</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default KelasDashboard;
