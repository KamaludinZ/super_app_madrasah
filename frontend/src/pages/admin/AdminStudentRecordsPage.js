import React, { useState, useEffect } from 'react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Checkbox } from '../../components/ui/checkbox';
import {
  Search,
  Download,
  FileText,
  Edit,
  Eye,
  Settings,
  Users,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  FileSpreadsheet
} from 'lucide-react';
import { toast } from 'sonner';

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

const AdminStudentRecordsPage = () => {
  const token = localStorage.getItem('token');

  // State
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showColumnDialog, setShowColumnDialog] = useState(false);
  const [stats, setStats] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [activeTab, setActiveTab] = useState('personal');

  // Customizable columns - default visible columns
  const [visibleColumns, setVisibleColumns] = useState({
    full_name: true,
    nis: true,
    nisn: true,
    class_name: true,
    gender: true,
    birth_place: true,
    birth_date: true,
    father_name: false,
    mother_name: false,
    address: false,
    phone: false,
    admission_date: false,
    graduation_status: true
  });

  const columnLabels = {
    full_name: 'Nama Lengkap',
    nis: 'NIS',
    nisn: 'NISN',
    class_name: 'Kelas',
    gender: 'Jenis Kelamin',
    birth_place: 'Tempat Lahir',
    birth_date: 'Tanggal Lahir',
    father_name: 'Nama Ayah',
    mother_name: 'Nama Ibu',
    address: 'Alamat',
    phone: 'Telepon',
    admission_date: 'Tanggal Masuk',
    graduation_status: 'Status'
  };

  useEffect(() => {
    fetchRecords();
    fetchStats();
  }, [search, statusFilter]);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        limit: 100,
        offset: 0
      });
      if (search) params.append('search', search);

      const res = await fetch(`${API_BASE}/api/student-records?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Gagal memuat data');

      const data = await res.json();
      setRecords(data.items || []);
    } catch (err) {
      toast.error('Gagal memuat data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/student-records/stats/summary`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const handleViewDetail = async (record) => {
    try {
      const res = await fetch(`${API_BASE}/api/student-records/${record.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Gagal memuat detail');

      const data = await res.json();
      setSelectedRecord(data);
      setShowDetailDialog(true);
    } catch (err) {
      toast.error('Gagal memuat detail: ' + err.message);
    }
  };

  const handleEdit = async (record) => {
    try {
      const res = await fetch(`${API_BASE}/api/student-records/${record.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Gagal memuat detail');

      const data = await res.json();
      setSelectedRecord(data);
      setEditForm(data.master_record || {});
      setShowEditDialog(true);
    } catch (err) {
      toast.error('Gagal memuat detail: ' + err.message);
    }
  };

  const handleSaveEdit = async () => {
    try {
      const payload = {
        student_id: selectedRecord.student.id,
        ...editForm
      };

      const res = await fetch(`${API_BASE}/api/student-records`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Gagal menyimpan data');

      toast.success('Buku induk siswa berhasil disimpan');

      setShowEditDialog(false);
      fetchRecords();
      fetchStats();
    } catch (err) {
      toast.error('Gagal menyimpan: ' + err.message);
    }
  };

  const handleExportExcel = async () => {
    toast.info('Fitur export Excel akan segera hadir');
  };

  const handleExportPDF = async (studentId) => {
    toast.info('Fitur export PDF akan segera hadir');
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      aktif: { label: 'Aktif', variant: 'default' },
      lulus: { label: 'Lulus', variant: 'secondary' },
      mutasi_keluar: { label: 'Mutasi', variant: 'outline' }
    };

    const s = statusMap[status] || { label: status || 'Aktif', variant: 'default' };
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Buku Induk Siswa</h1>
          <p className="text-muted-foreground">
            Kelola data lengkap buku induk siswa sesuai standar Kemenag
          </p>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Siswa</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_students}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Buku Induk Lengkap</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.complete_records}</div>
              <p className="text-xs text-muted-foreground">
                {stats.total_students > 0 ? Math.round((stats.complete_records / stats.total_students) * 100) : 0}% dari total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Belum Lengkap</CardTitle>
              <AlertCircle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.incomplete_records}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Belum Ada Data</CardTitle>
              <TrendingUp className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.no_records}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters & Actions */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex flex-1 gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari nama, NIS, NISN, NIK..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Aktif</SelectItem>
                  <SelectItem value="graduated">Lulus</SelectItem>
                  <SelectItem value="mutated">Mutasi</SelectItem>
                  <SelectItem value="all">Semua</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowColumnDialog(true)}>
                <Settings className="mr-2 h-4 w-4" />
                Kolom
              </Button>
              <Button variant="outline" onClick={handleExportExcel}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Export Excel
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="text-center py-8">Memuat data...</div>
          ) : records.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Tidak ada data siswa
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    {Object.entries(visibleColumns).map(([key, visible]) =>
                      visible && (
                        <th key={key} className="text-left p-2 font-medium">
                          {columnLabels[key]}
                        </th>
                      )
                    )}
                    <th className="text-left p-2 font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.id} className="border-b hover:bg-muted/50">
                      {visibleColumns.full_name && (
                        <td className="p-2">{record.full_name}</td>
                      )}
                      {visibleColumns.nis && (
                        <td className="p-2">{record.nis || '-'}</td>
                      )}
                      {visibleColumns.nisn && (
                        <td className="p-2">{record.nisn || '-'}</td>
                      )}
                      {visibleColumns.class_name && (
                        <td className="p-2">{record.class_name || '-'}</td>
                      )}
                      {visibleColumns.gender && (
                        <td className="p-2">{record.master_record?.gender || '-'}</td>
                      )}
                      {visibleColumns.birth_place && (
                        <td className="p-2">{record.master_record?.birth_place || '-'}</td>
                      )}
                      {visibleColumns.birth_date && (
                        <td className="p-2">{record.master_record?.birth_date || '-'}</td>
                      )}
                      {visibleColumns.father_name && (
                        <td className="p-2">{record.master_record?.father_name || '-'}</td>
                      )}
                      {visibleColumns.mother_name && (
                        <td className="p-2">{record.master_record?.mother_name || '-'}</td>
                      )}
                      {visibleColumns.address && (
                        <td className="p-2">{record.master_record?.address || '-'}</td>
                      )}
                      {visibleColumns.phone && (
                        <td className="p-2">{record.master_record?.phone || '-'}</td>
                      )}
                      {visibleColumns.admission_date && (
                        <td className="p-2">{record.master_record?.admission_date || '-'}</td>
                      )}
                      {visibleColumns.graduation_status && (
                        <td className="p-2">{getStatusBadge(record.graduation_status)}</td>
                      )}
                      <td className="p-2">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleViewDetail(record)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(record)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleExportPDF(record.id)}
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Column Customization Dialog */}
      <Dialog open={showColumnDialog} onOpenChange={setShowColumnDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sesuaikan Kolom Tabel</DialogTitle>
            <DialogDescription>
              Pilih kolom yang ingin ditampilkan di tabel
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {Object.entries(columnLabels).map(([key, label]) => (
              <div key={key} className="flex items-center space-x-2">
                <Checkbox
                  id={key}
                  checked={visibleColumns[key]}
                  onCheckedChange={(checked) =>
                    setVisibleColumns({ ...visibleColumns, [key]: checked })
                  }
                />
                <label
                  htmlFor={key}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {label}
                </label>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowColumnDialog(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detail Buku Induk Siswa</DialogTitle>
            <DialogDescription>
              {selectedRecord?.student?.full_name}
            </DialogDescription>
          </DialogHeader>

          {selectedRecord && (
            <Tabs defaultValue="personal" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="personal">Personal</TabsTrigger>
                <TabsTrigger value="family">Keluarga</TabsTrigger>
                <TabsTrigger value="education">Pendidikan</TabsTrigger>
                <TabsTrigger value="health">Kesehatan</TabsTrigger>
                <TabsTrigger value="history">Riwayat</TabsTrigger>
              </TabsList>

              <TabsContent value="personal" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Nama Lengkap</Label>
                    <p className="text-sm">{selectedRecord.student.full_name}</p>
                  </div>
                  <div>
                    <Label>NIS</Label>
                    <p className="text-sm">{selectedRecord.student.nis || '-'}</p>
                  </div>
                  <div>
                    <Label>NISN</Label>
                    <p className="text-sm">{selectedRecord.student.nisn || '-'}</p>
                  </div>
                  <div>
                    <Label>NIK</Label>
                    <p className="text-sm">{selectedRecord.master_record?.nik || '-'}</p>
                  </div>
                  <div>
                    <Label>Jenis Kelamin</Label>
                    <p className="text-sm">{selectedRecord.master_record?.gender || '-'}</p>
                  </div>
                  <div>
                    <Label>Tempat, Tanggal Lahir</Label>
                    <p className="text-sm">
                      {selectedRecord.master_record?.birth_place || '-'}, {selectedRecord.master_record?.birth_date || '-'}
                    </p>
                  </div>
                  <div>
                    <Label>Agama</Label>
                    <p className="text-sm">{selectedRecord.master_record?.religion || '-'}</p>
                  </div>
                  <div>
                    <Label>Kewarganegaraan</Label>
                    <p className="text-sm">{selectedRecord.master_record?.citizenship || '-'}</p>
                  </div>
                  <div className="col-span-2">
                    <Label>Alamat</Label>
                    <p className="text-sm">{selectedRecord.master_record?.address || '-'}</p>
                  </div>
                  <div>
                    <Label>Telepon</Label>
                    <p className="text-sm">{selectedRecord.master_record?.phone || '-'}</p>
                  </div>
                  <div>
                    <Label>Email</Label>
                    <p className="text-sm">{selectedRecord.master_record?.email || '-'}</p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="family" className="space-y-4">
                <div className="space-y-6">
                  {/* Father */}
                  <div>
                    <h3 className="font-semibold mb-2">Data Ayah</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Nama</Label>
                        <p className="text-sm">{selectedRecord.master_record?.father_name || '-'}</p>
                      </div>
                      <div>
                        <Label>NIK</Label>
                        <p className="text-sm">{selectedRecord.master_record?.father_nik || '-'}</p>
                      </div>
                      <div>
                        <Label>Pendidikan</Label>
                        <p className="text-sm">{selectedRecord.master_record?.father_education || '-'}</p>
                      </div>
                      <div>
                        <Label>Pekerjaan</Label>
                        <p className="text-sm">{selectedRecord.master_record?.father_occupation || '-'}</p>
                      </div>
                      <div>
                        <Label>Penghasilan</Label>
                        <p className="text-sm">{selectedRecord.master_record?.father_income || '-'}</p>
                      </div>
                      <div>
                        <Label>Telepon</Label>
                        <p className="text-sm">{selectedRecord.master_record?.father_phone || '-'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Mother */}
                  <div>
                    <h3 className="font-semibold mb-2">Data Ibu</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Nama</Label>
                        <p className="text-sm">{selectedRecord.master_record?.mother_name || '-'}</p>
                      </div>
                      <div>
                        <Label>NIK</Label>
                        <p className="text-sm">{selectedRecord.master_record?.mother_nik || '-'}</p>
                      </div>
                      <div>
                        <Label>Pendidikan</Label>
                        <p className="text-sm">{selectedRecord.master_record?.mother_education || '-'}</p>
                      </div>
                      <div>
                        <Label>Pekerjaan</Label>
                        <p className="text-sm">{selectedRecord.master_record?.mother_occupation || '-'}</p>
                      </div>
                      <div>
                        <Label>Penghasilan</Label>
                        <p className="text-sm">{selectedRecord.master_record?.mother_income || '-'}</p>
                      </div>
                      <div>
                        <Label>Telepon</Label>
                        <p className="text-sm">{selectedRecord.master_record?.mother_phone || '-'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Guardian (if exists) */}
                  {selectedRecord.master_record?.guardian_name && (
                    <div>
                      <h3 className="font-semibold mb-2">Data Wali</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Nama</Label>
                          <p className="text-sm">{selectedRecord.master_record?.guardian_name || '-'}</p>
                        </div>
                        <div>
                          <Label>NIK</Label>
                          <p className="text-sm">{selectedRecord.master_record?.guardian_nik || '-'}</p>
                        </div>
                        <div>
                          <Label>Pendidikan</Label>
                          <p className="text-sm">{selectedRecord.master_record?.guardian_education || '-'}</p>
                        </div>
                        <div>
                          <Label>Pekerjaan</Label>
                          <p className="text-sm">{selectedRecord.master_record?.guardian_occupation || '-'}</p>
                        </div>
                        <div>
                          <Label>Telepon</Label>
                          <p className="text-sm">{selectedRecord.master_record?.guardian_phone || '-'}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="education" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Tanggal Masuk</Label>
                    <p className="text-sm">{selectedRecord.master_record?.admission_date || '-'}</p>
                  </div>
                  <div>
                    <Label>Asal Sekolah</Label>
                    <p className="text-sm">{selectedRecord.master_record?.previous_school || '-'}</p>
                  </div>
                  <div>
                    <Label>Alamat Sekolah Asal</Label>
                    <p className="text-sm">{selectedRecord.master_record?.previous_school_address || '-'}</p>
                  </div>
                  <div>
                    <Label>No. Ijazah SD/MI</Label>
                    <p className="text-sm">{selectedRecord.master_record?.previous_certificate_number || '-'}</p>
                  </div>
                  <div>
                    <Label>No. SKHUN SD/MI</Label>
                    <p className="text-sm">{selectedRecord.master_record?.previous_skhun_number || '-'}</p>
                  </div>
                  <div>
                    <Label>Diterima di Kelas</Label>
                    <p className="text-sm">{selectedRecord.master_record?.admission_grade || '-'}</p>
                  </div>
                  <div>
                    <Label>KIP</Label>
                    <p className="text-sm">{selectedRecord.master_record?.has_kip ? 'Ya' : 'Tidak'}</p>
                  </div>
                  <div>
                    <Label>No. KIP</Label>
                    <p className="text-sm">{selectedRecord.master_record?.kip_number || '-'}</p>
                  </div>
                  <div>
                    <Label>PKH/KPS</Label>
                    <p className="text-sm">{selectedRecord.master_record?.has_pkh ? 'Ya' : 'Tidak'}</p>
                  </div>
                  <div>
                    <Label>No. PKH/KPS</Label>
                    <p className="text-sm">{selectedRecord.master_record?.pkh_number || '-'}</p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="health" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Golongan Darah</Label>
                    <p className="text-sm">{selectedRecord.master_record?.blood_type || '-'}</p>
                  </div>
                  <div>
                    <Label>Tinggi Badan (cm)</Label>
                    <p className="text-sm">{selectedRecord.master_record?.height || '-'}</p>
                  </div>
                  <div>
                    <Label>Berat Badan (kg)</Label>
                    <p className="text-sm">{selectedRecord.master_record?.weight || '-'}</p>
                  </div>
                  <div className="col-span-2">
                    <Label>Riwayat Penyakit</Label>
                    <p className="text-sm">{selectedRecord.master_record?.health_notes || '-'}</p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="history" className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Riwayat Kelas</h3>
                  {selectedRecord.class_history && selectedRecord.class_history.length > 0 ? (
                    <div className="space-y-2">
                      {selectedRecord.class_history.map((history, idx) => (
                        <Card key={idx}>
                          <CardContent className="p-4">
                            <div className="grid grid-cols-3 gap-2 text-sm">
                              <div>
                                <Label>Kelas</Label>
                                <p>{history.class_name || '-'}</p>
                              </div>
                              <div>
                                <Label>Tahun Pelajaran</Label>
                                <p>{history.academic_year_name || '-'}</p>
                              </div>
                              <div>
                                <Label>Alasan</Label>
                                <p>{history.reason || '-'}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Belum ada riwayat kelas</p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => handleExportPDF(selectedRecord?.student?.id)}>
              <Download className="mr-2 h-4 w-4" />
              Export PDF
            </Button>
            <Button onClick={() => setShowDetailDialog(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Buku Induk Siswa</DialogTitle>
            <DialogDescription>
              {selectedRecord?.student?.full_name}
            </DialogDescription>
          </DialogHeader>

          {selectedRecord && (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="personal">Personal</TabsTrigger>
                <TabsTrigger value="family">Keluarga</TabsTrigger>
                <TabsTrigger value="education">Pendidikan</TabsTrigger>
                <TabsTrigger value="health">Kesehatan</TabsTrigger>
              </TabsList>

              <TabsContent value="personal" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>NIK</Label>
                    <Input
                      value={editForm.nik || ''}
                      onChange={(e) => setEditForm({ ...editForm, nik: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Jenis Kelamin</Label>
                    <Select
                      value={editForm.gender || ''}
                      onValueChange={(val) => setEditForm({ ...editForm, gender: val })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="L">Laki-laki</SelectItem>
                        <SelectItem value="P">Perempuan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Tempat Lahir</Label>
                    <Input
                      value={editForm.birth_place || ''}
                      onChange={(e) => setEditForm({ ...editForm, birth_place: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Tanggal Lahir (YYYY-MM-DD)</Label>
                    <Input
                      type="date"
                      value={editForm.birth_date || ''}
                      onChange={(e) => setEditForm({ ...editForm, birth_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Agama</Label>
                    <Select
                      value={editForm.religion || ''}
                      onValueChange={(val) => setEditForm({ ...editForm, religion: val })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Islam">Islam</SelectItem>
                        <SelectItem value="Kristen">Kristen</SelectItem>
                        <SelectItem value="Katolik">Katolik</SelectItem>
                        <SelectItem value="Hindu">Hindu</SelectItem>
                        <SelectItem value="Buddha">Buddha</SelectItem>
                        <SelectItem value="Konghucu">Konghucu</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Kewarganegaraan</Label>
                    <Input
                      value={editForm.citizenship || ''}
                      onChange={(e) => setEditForm({ ...editForm, citizenship: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>Alamat</Label>
                    <Textarea
                      value={editForm.address || ''}
                      onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>RT</Label>
                    <Input
                      value={editForm.rt || ''}
                      onChange={(e) => setEditForm({ ...editForm, rt: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>RW</Label>
                    <Input
                      value={editForm.rw || ''}
                      onChange={(e) => setEditForm({ ...editForm, rw: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Kelurahan</Label>
                    <Input
                      value={editForm.kelurahan || ''}
                      onChange={(e) => setEditForm({ ...editForm, kelurahan: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Kecamatan</Label>
                    <Input
                      value={editForm.kecamatan || ''}
                      onChange={(e) => setEditForm({ ...editForm, kecamatan: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Kabupaten/Kota</Label>
                    <Input
                      value={editForm.kabupaten || ''}
                      onChange={(e) => setEditForm({ ...editForm, kabupaten: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Provinsi</Label>
                    <Input
                      value={editForm.provinsi || ''}
                      onChange={(e) => setEditForm({ ...editForm, provinsi: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Kode Pos</Label>
                    <Input
                      value={editForm.kode_pos || ''}
                      onChange={(e) => setEditForm({ ...editForm, kode_pos: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Telepon</Label>
                    <Input
                      value={editForm.phone || ''}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={editForm.email || ''}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="family" className="space-y-6">
                {/* Father */}
                <div>
                  <h3 className="font-semibold mb-2">Data Ayah</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Nama</Label>
                      <Input
                        value={editForm.father_name || ''}
                        onChange={(e) => setEditForm({ ...editForm, father_name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>NIK</Label>
                      <Input
                        value={editForm.father_nik || ''}
                        onChange={(e) => setEditForm({ ...editForm, father_nik: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Pendidikan</Label>
                      <Input
                        value={editForm.father_education || ''}
                        onChange={(e) => setEditForm({ ...editForm, father_education: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Pekerjaan</Label>
                      <Input
                        value={editForm.father_occupation || ''}
                        onChange={(e) => setEditForm({ ...editForm, father_occupation: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Penghasilan</Label>
                      <Input
                        value={editForm.father_income || ''}
                        onChange={(e) => setEditForm({ ...editForm, father_income: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Telepon</Label>
                      <Input
                        value={editForm.father_phone || ''}
                        onChange={(e) => setEditForm({ ...editForm, father_phone: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Mother */}
                <div>
                  <h3 className="font-semibold mb-2">Data Ibu</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Nama</Label>
                      <Input
                        value={editForm.mother_name || ''}
                        onChange={(e) => setEditForm({ ...editForm, mother_name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>NIK</Label>
                      <Input
                        value={editForm.mother_nik || ''}
                        onChange={(e) => setEditForm({ ...editForm, mother_nik: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Pendidikan</Label>
                      <Input
                        value={editForm.mother_education || ''}
                        onChange={(e) => setEditForm({ ...editForm, mother_education: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Pekerjaan</Label>
                      <Input
                        value={editForm.mother_occupation || ''}
                        onChange={(e) => setEditForm({ ...editForm, mother_occupation: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Penghasilan</Label>
                      <Input
                        value={editForm.mother_income || ''}
                        onChange={(e) => setEditForm({ ...editForm, mother_income: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Telepon</Label>
                      <Input
                        value={editForm.mother_phone || ''}
                        onChange={(e) => setEditForm({ ...editForm, mother_phone: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Guardian */}
                <div>
                  <h3 className="font-semibold mb-2">Data Wali (Opsional)</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Nama</Label>
                      <Input
                        value={editForm.guardian_name || ''}
                        onChange={(e) => setEditForm({ ...editForm, guardian_name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>NIK</Label>
                      <Input
                        value={editForm.guardian_nik || ''}
                        onChange={(e) => setEditForm({ ...editForm, guardian_nik: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Pendidikan</Label>
                      <Input
                        value={editForm.guardian_education || ''}
                        onChange={(e) => setEditForm({ ...editForm, guardian_education: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Pekerjaan</Label>
                      <Input
                        value={editForm.guardian_occupation || ''}
                        onChange={(e) => setEditForm({ ...editForm, guardian_occupation: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Telepon</Label>
                      <Input
                        value={editForm.guardian_phone || ''}
                        onChange={(e) => setEditForm({ ...editForm, guardian_phone: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="education" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Tanggal Masuk (YYYY-MM-DD)</Label>
                    <Input
                      type="date"
                      value={editForm.admission_date || ''}
                      onChange={(e) => setEditForm({ ...editForm, admission_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Diterima di Kelas</Label>
                    <Input
                      value={editForm.admission_grade || ''}
                      onChange={(e) => setEditForm({ ...editForm, admission_grade: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Asal Sekolah</Label>
                    <Input
                      value={editForm.previous_school || ''}
                      onChange={(e) => setEditForm({ ...editForm, previous_school: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Alamat Sekolah Asal</Label>
                    <Input
                      value={editForm.previous_school_address || ''}
                      onChange={(e) => setEditForm({ ...editForm, previous_school_address: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>No. Ijazah SD/MI</Label>
                    <Input
                      value={editForm.previous_certificate_number || ''}
                      onChange={(e) => setEditForm({ ...editForm, previous_certificate_number: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>No. SKHUN SD/MI</Label>
                    <Input
                      value={editForm.previous_skhun_number || ''}
                      onChange={(e) => setEditForm({ ...editForm, previous_skhun_number: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="has_kip"
                      checked={editForm.has_kip || false}
                      onCheckedChange={(checked) => setEditForm({ ...editForm, has_kip: checked })}
                    />
                    <label htmlFor="has_kip" className="text-sm font-medium">
                      Penerima KIP
                    </label>
                  </div>
                  <div>
                    <Label>No. KIP</Label>
                    <Input
                      value={editForm.kip_number || ''}
                      onChange={(e) => setEditForm({ ...editForm, kip_number: e.target.value })}
                      disabled={!editForm.has_kip}
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="has_pkh"
                      checked={editForm.has_pkh || false}
                      onCheckedChange={(checked) => setEditForm({ ...editForm, has_pkh: checked })}
                    />
                    <label htmlFor="has_pkh" className="text-sm font-medium">
                      Penerima PKH/KPS
                    </label>
                  </div>
                  <div>
                    <Label>No. PKH/KPS</Label>
                    <Input
                      value={editForm.pkh_number || ''}
                      onChange={(e) => setEditForm({ ...editForm, pkh_number: e.target.value })}
                      disabled={!editForm.has_pkh}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="health" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Golongan Darah</Label>
                    <Select
                      value={editForm.blood_type || ''}
                      onValueChange={(val) => setEditForm({ ...editForm, blood_type: val })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A">A</SelectItem>
                        <SelectItem value="B">B</SelectItem>
                        <SelectItem value="AB">AB</SelectItem>
                        <SelectItem value="O">O</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Tinggi Badan (cm)</Label>
                    <Input
                      type="number"
                      value={editForm.height || ''}
                      onChange={(e) => setEditForm({ ...editForm, height: parseFloat(e.target.value) || null })}
                    />
                  </div>
                  <div>
                    <Label>Berat Badan (kg)</Label>
                    <Input
                      type="number"
                      value={editForm.weight || ''}
                      onChange={(e) => setEditForm({ ...editForm, weight: parseFloat(e.target.value) || null })}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>Riwayat Penyakit</Label>
                    <Textarea
                      value={editForm.health_notes || ''}
                      onChange={(e) => setEditForm({ ...editForm, health_notes: e.target.value })}
                      placeholder="Catatan kesehatan atau riwayat penyakit"
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Batal
            </Button>
            <Button onClick={handleSaveEdit}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminStudentRecordsPage;
