import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  BookMarked, Loader2, UserCheck, Database, Award, AlertTriangle,
  ThumbsUp, TrendingUp, School, Map, MapPin, Globe, Flag, Megaphone
} from 'lucide-react';
import { api } from '@/lib/api';
import { Link } from 'react-router-dom';

export default function WaliKelasDashboard() {
  const [stats, setStats] = useState(null);
  const [classInfo, setClassInfo] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/wali-kelas/my-class'),
      api.get('/wali-kelas/dashboard-stats')
    ])
      .then(([classData, statsData]) => {
        console.log('Class Data:', classData.data);
        console.log('Stats Data:', statsData.data);
        setClassInfo(classData.data);
        setStats(statsData.data);
      })
      .catch((error) => {
        console.error('Error loading dashboard:', error);
      })
      .finally(() => setLoading(false));
    loadAnnouncements();
  }, []);

  const loadAnnouncements = async () => {
    try {
      const { data } = await api.get('/announcements');
      setAnnouncements(data.slice(0, 3)); // Show only 3 latest
    } catch (e) {}
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'warning': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'success': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      default: return 'bg-sky-100 text-sky-800 border-sky-200';
    }
  };

  // Level labels for achievements
  const levelLabels = {
    sekolah: { label: 'Sekolah', icon: School, color: 'text-slate-600' },
    kecamatan: { label: 'Kecamatan', icon: Map, color: 'text-blue-600' },
    kabupaten: { label: 'Kabupaten', icon: MapPin, color: 'text-green-600' },
    provinsi: { label: 'Provinsi', icon: Flag, color: 'text-amber-600' },
    nasional: { label: 'Nasional', icon: Globe, color: 'text-rose-600' },
    internasional: { label: 'Internasional', icon: Award, color: 'text-purple-600' },
  };

  if (loading) return <Loader2 className="h-5 w-5 animate-spin" />;

  if (!classInfo?.class) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-slate-500">
          <BookMarked className="h-10 w-10 mx-auto opacity-40 mb-2" />
          <div>Anda tidak terdaftar sebagai wali kelas pada tahun pelajaran aktif</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
          <BookMarked className="h-3 w-3 mr-1" /> Dashboard Wali Kelas
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
          Dashboard Kelas {classInfo.class.name}
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Statistik dan laporan komprehensif kelas yang Anda pegang
        </p>
      </div>

      {/* Pengumuman Section */}
      {announcements.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-blue-600" />
                <CardTitle className="text-lg">Pengumuman</CardTitle>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/pengumuman">Lihat Semua</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {announcements.map((ann) => (
              <div
                key={ann.id}
                className={`p-3 rounded-lg border ${getSeverityColor(ann.severity)}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm">{ann.title}</h3>
                    <p className="text-xs mt-1 line-clamp-2">{ann.body}</p>
                  </div>
                  {ann.is_pinned && (
                    <Badge variant="outline" className="text-xs">Pinned</Badge>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Statistics Widgets Grid */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Attendance Widget */}
          <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <UserCheck className="h-8 w-8 text-emerald-600" />
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300">Bulan Ini</Badge>
              </div>
              <div className="text-3xl font-bold text-emerald-700 mb-1">
                {stats.attendance?.percentage || 0}%
              </div>
              <div className="text-sm text-slate-600 font-medium">Kehadiran Siswa</div>
              <div className="text-xs text-slate-500 mt-2">
                {stats.attendance?.present_records || 0} dari {stats.attendance?.total_records || 0} catatan
              </div>
            </CardContent>
          </Card>

          {/* Student Data Widget */}
          <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <Database className="h-8 w-8 text-blue-600" />
                <Badge className="bg-blue-100 text-blue-700 border-blue-300">Data Siswa</Badge>
              </div>
              <div className="text-3xl font-bold text-blue-700 mb-1">
                {stats.students?.total || 0}
              </div>
              <div className="text-sm text-slate-600 font-medium">Total Siswa</div>
              <div className="text-xs text-slate-500 mt-2">
                {stats.students?.completeness_percentage || 0}% data lengkap ({stats.students?.complete || 0} siswa)
              </div>
            </CardContent>
          </Card>

          {/* Achievements Widget */}
          <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-white">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <Award className="h-8 w-8 text-amber-600" />
                <Badge className="bg-amber-100 text-amber-700 border-amber-300">Prestasi</Badge>
              </div>
              <div className="text-3xl font-bold text-amber-700 mb-1">
                {stats.achievements?.total || 0}
              </div>
              <div className="text-sm text-slate-600 font-medium">Total Prestasi</div>
              <div className="text-xs text-slate-500 mt-2">
                Berbagai tingkat kompetisi
              </div>
            </CardContent>
          </Card>

          {/* Discipline Widget */}
          <Card className="border-rose-200 bg-gradient-to-br from-rose-50 to-white">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <AlertTriangle className="h-8 w-8 text-rose-600" />
                <Badge className="bg-rose-100 text-rose-700 border-rose-300">Tata Tertib</Badge>
              </div>
              <div className="text-2xl font-bold text-rose-700 mb-1">
                {stats.discipline?.violation_points || 0} / {stats.discipline?.achievement_points || 0}
              </div>
              <div className="text-sm text-slate-600 font-medium">Poin Pelanggaran / Prestasi</div>
              <div className="text-xs text-slate-500 mt-2">
                {stats.discipline?.total_records || 0} catatan
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Detailed Statistics */}
      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Achievement Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Award className="h-5 w-5 text-amber-600" />
                Prestasi Per Tingkat
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.achievements?.total > 0 ? (
                <div className="space-y-3">
                  {Object.entries(stats.achievements.by_level).map(([level, count]) => {
                    if (count === 0) return null;
                    const levelInfo = levelLabels[level];
                    const Icon = levelInfo?.icon || Award;
                    return (
                      <div key={level} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <Icon className={`h-5 w-5 ${levelInfo?.color || 'text-slate-600'}`} />
                          <span className="font-medium capitalize">{levelInfo?.label || level}</span>
                        </div>
                        <Badge variant="outline" className="font-bold">{count}</Badge>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <Award className="h-10 w-10 mx-auto opacity-30 mb-2" />
                  <div className="text-sm">Belum ada prestasi tercatat</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Discipline Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-slate-600" />
                Statistik Tata Tertib
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 rounded-lg border-2 border-rose-200 bg-rose-50">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-6 w-6 text-rose-600" />
                    <div>
                      <div className="font-semibold text-rose-900">Poin Pelanggaran</div>
                      <div className="text-xs text-rose-700">Total akumulasi poin</div>
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-rose-700">
                    {stats.discipline?.violation_points || 0}
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border-2 border-emerald-200 bg-emerald-50">
                  <div className="flex items-center gap-3">
                    <ThumbsUp className="h-6 w-6 text-emerald-600" />
                    <div>
                      <div className="font-semibold text-emerald-900">Poin Prestasi</div>
                      <div className="text-xs text-emerald-700">Total poin positif</div>
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-emerald-700">
                    {stats.discipline?.achievement_points || 0}
                  </div>
                </div>

                <div className="text-center text-xs text-slate-500 pt-2">
                  Total {stats.discipline?.total_records || 0} catatan tata tertib
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
