import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, TrendingDown, TrendingUp, Award, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

const AdminTatibDataPage = () => {
  const [penangananList, setPenangananList] = useState([]);
  const [studentsList, setStudentsList] = useState([]);
  const [aturanList, setAturanList] = useState([]);
  const [kategoriList, setKategoriList] = useState([]);
  const [tahunTakwimList, setTahunTakwimList] = useState([]);
  const [semesterList, setSemesterList] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [filterTahunTakwim, setFilterTahunTakwim] = useState('');
  const [filterSemester, setFilterSemester] = useState('');
  const [filterKategori, setFilterKategori] = useState('');

  // Statistics
  const [stats, setStats] = useState({
    total_penanganan: 0,
    total_pelanggaran: 0,
    total_prestasi: 0,
    total_poin_negatif: 0,
    total_poin_positif: 0,
  });

  const [studentStats, setStudentStats] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    calculateStats();
  }, [penangananList, aturanList, filterTahunTakwim, filterSemester, filterKategori]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [penangananRes, studentsRes, aturanRes, kategoriRes, tahunTakwimRes, semesterRes] = await Promise.all([
        api.get('/tatib/penanganan'),
        api.get('/students'),
        api.get('/tatib/aturan'),
        api.get('/tatib/kategori'),
        api.get('/tahun-takwim'),
        api.get('/semesters'),
      ]);
      setPenangananList(penangananRes.data || []);
      setStudentsList(studentsRes.data || []);
      setAturanList(aturanRes.data || []);
      setKategoriList(kategoriRes.data || []);
      setTahunTakwimList(tahunTakwimRes.data || []);
      setSemesterList(semesterRes.data || []);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = () => {
    // Filter penanganan based on active filters
    const filteredPenanganan = penangananList.filter(p => {
      // Filter by semester (which includes tahun takwim and tahun pelajaran)
      if (filterSemester) {
        const semester = semesterList.find(s => s.id === filterSemester);
        if (semester) {
          const penangananDate = new Date(p.tanggal);
          const startDate = new Date(semester.tanggal_mulai);
          const endDate = new Date(semester.tanggal_selesai);
          if (penangananDate < startDate || penangananDate > endDate) return false;
        }
      } else if (filterTahunTakwim) {
        // Filter by tahun takwim only
        const tahunTakwim = tahunTakwimList.find(t => t.id === filterTahunTakwim);
        if (tahunTakwim) {
          const penangananDate = new Date(p.tanggal);
          const startDate = new Date(tahunTakwim.tanggal_mulai);
          const endDate = new Date(tahunTakwim.tanggal_selesai);
          if (penangananDate < startDate || penangananDate > endDate) return false;
        }
      }

      // Filter by kategori
      if (filterKategori) {
        const aturan = aturanList.find(a => a.id === p.aturan_id);
        if (!aturan || aturan.kategori_id !== filterKategori) return false;
      }

      return true;
    });

    // Calculate overall statistics
    let total_pelanggaran = 0;
    let total_prestasi = 0;
    let total_poin_negatif = 0;
    let total_poin_positif = 0;

    filteredPenanganan.forEach(p => {
      const aturan = aturanList.find(a => a.id === p.aturan_id);
      if (aturan) {
        if (aturan.poin < 0) {
          total_pelanggaran++;
          total_poin_negatif += aturan.poin;
        } else {
          total_prestasi++;
          total_poin_positif += aturan.poin;
        }
      }
    });

    setStats({
      total_penanganan: filteredPenanganan.length,
      total_pelanggaran,
      total_prestasi,
      total_poin_negatif,
      total_poin_positif,
    });

    // Calculate per-student statistics
    const studentStatsMap = {};
    filteredPenanganan.forEach(p => {
      if (!studentStatsMap[p.siswa_id]) {
        studentStatsMap[p.siswa_id] = {
          siswa_id: p.siswa_id,
          pelanggaran: 0,
          prestasi: 0,
          poin_negatif: 0,
          poin_positif: 0,
          total_poin: 0,
        };
      }

      const aturan = aturanList.find(a => a.id === p.aturan_id);
      if (aturan) {
        if (aturan.poin < 0) {
          studentStatsMap[p.siswa_id].pelanggaran++;
          studentStatsMap[p.siswa_id].poin_negatif += aturan.poin;
        } else {
          studentStatsMap[p.siswa_id].prestasi++;
          studentStatsMap[p.siswa_id].poin_positif += aturan.poin;
        }
        studentStatsMap[p.siswa_id].total_poin += aturan.poin;
      }
    });

    const studentStatsArray = Object.values(studentStatsMap).sort((a, b) => b.total_poin - a.total_poin);
    setStudentStats(studentStatsArray);
  };

  const getStudentInfo = (id) => {
    const student = studentsList.find(s => s.id === id);
    return student || { nis: '-', nama: '-', kelas: '-' };
  };

  const handleExportData = () => {
    // Simple CSV export
    const headers = ['NIS', 'Nama', 'Kelas', 'Pelanggaran', 'Prestasi', 'Poin Negatif', 'Poin Positif', 'Total Poin'];
    const rows = studentStats.map(stat => {
      const student = getStudentInfo(stat.siswa_id);
      return [
        student.nis,
        student.nama,
        student.kelas,
        stat.pelanggaran,
        stat.prestasi,
        stat.poin_negatif,
        stat.poin_positif,
        stat.total_poin,
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `rekapitulasi_tatib_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast.success('Data berhasil diekspor');
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Data Tata Tertib - Rekapitulasi</h1>
        <Button onClick={handleExportData}>
          <Download className="h-4 w-4 mr-2" />
          Export Data
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Tahun Takwim</Label>
              <Select
                value={filterTahunTakwim || "all"}
                onValueChange={(v) => {
                  setFilterTahunTakwim(v === "all" ? "" : v);
                  setFilterSemester(''); // Clear semester when tahun takwim changes
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Semua Tahun Takwim" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Tahun Takwim</SelectItem>
                  {tahunTakwimList.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nama} ({t.tahun_mulai}/{t.tahun_selesai})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Semester</Label>
              <Select
                value={filterSemester || "all"}
                onValueChange={(v) => setFilterSemester(v === "all" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Semua Semester" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Semester</SelectItem>
                  {semesterList.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nama} - {s.tahun_pelajaran}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Kategori</Label>
              <Select value={filterKategori || "all"} onValueChange={(v) => setFilterKategori(v === "all" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Semua Kategori" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kategori</SelectItem>
                  {kategoriList.map(k => (
                    <SelectItem key={k.id} value={k.id}>{k.nama}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Penanganan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_penanganan}</div>
            <p className="text-xs text-muted-foreground">Pelanggaran & Prestasi</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Pelanggaran
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{stats.total_pelanggaran}</div>
            <p className="text-xs text-muted-foreground">Total: {stats.total_poin_negatif} poin</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Award className="h-4 w-4 text-green-500" />
              Prestasi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{stats.total_prestasi}</div>
            <p className="text-xs text-muted-foreground">Total: +{stats.total_poin_positif} poin</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Total Poin Negatif
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{stats.total_poin_negatif}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Total Poin Positif
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">+{stats.total_poin_positif}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="rekapitulasi" className="w-full">
        <TabsList>
          <TabsTrigger value="rekapitulasi">Rekapitulasi Per Siswa</TabsTrigger>
          <TabsTrigger value="top_pelanggar">Top Pelanggar</TabsTrigger>
          <TabsTrigger value="top_prestasi">Top Prestasi</TabsTrigger>
        </TabsList>

        {/* Rekapitulasi Tab */}
        <TabsContent value="rekapitulasi">
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex justify-center items-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="ml-2">Memuat data...</span>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>NIS</TableHead>
                      <TableHead>Nama Siswa</TableHead>
                      <TableHead>Kelas</TableHead>
                      <TableHead className="text-right">Pelanggaran</TableHead>
                      <TableHead className="text-right">Prestasi</TableHead>
                      <TableHead className="text-right">Poin Negatif</TableHead>
                      <TableHead className="text-right">Poin Positif</TableHead>
                      <TableHead className="text-right">Total Poin</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {studentStats.map(stat => {
                      const student = getStudentInfo(stat.siswa_id);
                      return (
                        <TableRow key={stat.siswa_id}>
                          <TableCell>{student.nis}</TableCell>
                          <TableCell>{student.nama}</TableCell>
                          <TableCell>{student.kelas}</TableCell>
                          <TableCell className="text-right">{stat.pelanggaran}</TableCell>
                          <TableCell className="text-right">{stat.prestasi}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="destructive">{stat.poin_negatif}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="default">+{stat.poin_positif}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant={stat.total_poin >= 0 ? 'default' : 'destructive'}>
                              {stat.total_poin >= 0 ? `+${stat.total_poin}` : stat.total_poin}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {studentStats.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                          Belum ada data penanganan
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Top Pelanggar Tab */}
        <TabsContent value="top_pelanggar">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ranking</TableHead>
                    <TableHead>NIS</TableHead>
                    <TableHead>Nama Siswa</TableHead>
                    <TableHead>Kelas</TableHead>
                    <TableHead className="text-right">Jumlah Pelanggaran</TableHead>
                    <TableHead className="text-right">Total Poin Negatif</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentStats
                    .filter(s => s.pelanggaran > 0)
                    .sort((a, b) => b.pelanggaran - a.pelanggaran)
                    .slice(0, 20)
                    .map((stat, idx) => {
                      const student = getStudentInfo(stat.siswa_id);
                      const variant = idx === 0 ? 'destructive' : idx < 3 ? 'secondary' : 'outline';
                      return (
                        <TableRow key={stat.siswa_id}>
                          <TableCell>
                            <Badge variant={variant}>#{idx + 1}</Badge>
                          </TableCell>
                          <TableCell>{student.nis}</TableCell>
                          <TableCell>{student.nama}</TableCell>
                          <TableCell>{student.kelas}</TableCell>
                          <TableCell className="text-right font-bold">{stat.pelanggaran}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="destructive">{stat.poin_negatif}</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  {studentStats.filter(s => s.pelanggaran > 0).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                        Tidak ada data pelanggaran
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Top Prestasi Tab */}
        <TabsContent value="top_prestasi">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ranking</TableHead>
                    <TableHead>NIS</TableHead>
                    <TableHead>Nama Siswa</TableHead>
                    <TableHead>Kelas</TableHead>
                    <TableHead className="text-right">Jumlah Prestasi</TableHead>
                    <TableHead className="text-right">Total Poin Positif</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentStats
                    .filter(s => s.prestasi > 0)
                    .sort((a, b) => b.prestasi - a.prestasi)
                    .slice(0, 20)
                    .map((stat, idx) => {
                      const student = getStudentInfo(stat.siswa_id);
                      const variant = idx === 0 ? 'default' : idx < 3 ? 'secondary' : 'outline';
                      return (
                        <TableRow key={stat.siswa_id}>
                          <TableCell>
                            <Badge variant={variant}>#{idx + 1}</Badge>
                          </TableCell>
                          <TableCell>{student.nis}</TableCell>
                          <TableCell>{student.nama}</TableCell>
                          <TableCell>{student.kelas}</TableCell>
                          <TableCell className="text-right font-bold">{stat.prestasi}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="default">+{stat.poin_positif}</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  {studentStats.filter(s => s.prestasi > 0).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                        Tidak ada data prestasi
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminTatibDataPage;
