import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Upload,
  Eye,
  Trash2,
  Plus,
  Edit,
  Save,
  AlertCircle,
  FileText,
  Image as ImageIcon,
  Check,
  GraduationCap,
  X
} from 'lucide-react';
import { toast } from 'sonner';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

export default function ProfilePageEMIS() {
  // State for student data
  const [studentData, setStudentData] = useState({
    // Data Siswa
    nama_lengkap: '',
    nisn: '',
    nism: '',
    nomor_peserta_ujian: '',
    jenis_kelamin: '',
    tempat_lahir: '',
    tanggal_lahir: '',
    kewarganegaraan: 'WNI',
    nik: '',
    asal_negara: '',
    jumlah_saudara: '',
    anak_ke: '',
    agama: '',
    cita_cita: '',
    hobi: '',
    yang_membiayai: '',
    pra_sekolah: false,
    imunisasi: false,
    no_hp_siswa: '',
    email_siswa: '',
    tidak_punya_hp: false,
    nomor_kip: '',
    nomor_kk: '',
    nama_kepala_keluarga: '',
    nomor_pkh: '',
    nomor_kks: '',
  });

  // State for parent data
  const [ayahData, setAyahData] = useState({
    nama_ayah: '',
    status_ayah: 'Hidup',
    kewarganegaraan_ayah: 'WNI',
    nik_ayah: '',
    asal_negara_ayah: '',
    tempat_lahir_ayah: '',
    tanggal_lahir_ayah: '',
    pendidikan_ayah: '',
    pekerjaan_ayah: '',
    penghasilan_ayah: '',
    no_hp_ayah: '',
  });

  const [ibuData, setIbuData] = useState({
    nama_ibu: '',
    status_ibu: 'Hidup',
    kewarganegaraan_ibu: 'WNI',
    nik_ibu: '',
    asal_negara_ibu: '',
    tempat_lahir_ibu: '',
    tanggal_lahir_ibu: '',
    pendidikan_ibu: '',
    pekerjaan_ibu: '',
    penghasilan_ibu: '',
    no_hp_ibu: '',
  });

  const [waliData, setWaliData] = useState({
    sama_dengan: '',
    nama_wali: '',
    status_wali: 'Hidup',
    kewarganegaraan_wali: 'WNI',
    nik_wali: '',
    asal_negara_wali: '',
    tempat_lahir_wali: '',
    tanggal_lahir_wali: '',
    pendidikan_wali: '',
    pekerjaan_wali: '',
    penghasilan_wali: '',
    no_hp_wali: '',
  });

  // State for address data
  const [alamatAyah, setAlamatAyah] = useState({
    tinggal_luar_negeri: false,
    negara: '',
    status_kepemilikan_ayah: '',
    provinsi_ayah: '',
    kabupaten_ayah: '',
    kecamatan_ayah: '',
    kelurahan_ayah: '',
    rt_ayah: '',
    rw_ayah: '',
    alamat_ayah: '',
    kode_pos_ayah: '',
  });

  const [alamatIbu, setAlamatIbu] = useState({
    sama_dengan_ayah: false,
    tinggal_luar_negeri: false,
    negara: '',
    status_kepemilikan_ibu: '',
    provinsi_ibu: '',
    kabupaten_ibu: '',
    kecamatan_ibu: '',
    kelurahan_ibu: '',
    rt_ibu: '',
    rw_ibu: '',
    alamat_ibu: '',
    kode_pos_ibu: '',
  });

  const [alamatWali, setAlamatWali] = useState({
    sama_dengan: '',
    tinggal_luar_negeri: false,
    negara: '',
    status_kepemilikan_wali: '',
    provinsi_wali: '',
    kabupaten_wali: '',
    kecamatan_wali: '',
    kelurahan_wali: '',
    rt_wali: '',
    rw_wali: '',
    alamat_wali: '',
    kode_pos_wali: '',
  });

  const [alamatSiswa, setAlamatSiswa] = useState({
    status_tempat_tinggal: '',
    tinggal_luar_negeri: false,
    negara: '',
    provinsi_siswa: '',
    kabupaten_siswa: '',
    kecamatan_siswa: '',
    kelurahan_siswa: '',
    rt_siswa: '',
    rw_siswa: '',
    alamat_siswa: '',
    kode_pos_siswa: '',
    jarak_tempuh: '',
    transportasi: '',
    waktu_tempuh: '',
  });

  // State for achievements, scholarships, etc.
  const [prestasi, setPrestasi] = useState([]);
  const [beasiswa, setBeasiswa] = useState([]);
  const [pendidikanLain, setPendidikanLain] = useState([]);
  const [dokumen, setDokumen] = useState({});
  const [rekamDidik, setRekamDidik] = useState({});

  // State for UI
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('data-siswa');
  const [activeParentTab, setActiveParentTab] = useState('ayah');
  const [activeAlamatTab, setActiveAlamatTab] = useState('alamat-ayah');
  const [hasDraft, setHasDraft] = useState(false);
  const [uploading, setUploading] = useState({});

  // State for modals
  const [prestasiModal, setPrestasiModal] = useState(false);
  const [beasiswaModal, setBeasiswaModal] = useState(false);
  const [pendidikanLainModal, setPendidikanLainModal] = useState(false);
  const [currentPrestasiForm, setCurrentPrestasiForm] = useState({});
  const [currentBeasiswaForm, setCurrentBeasiswaForm] = useState({});
  const [currentPendidikanLainForm, setCurrentPendidikanLainForm] = useState({});
  const [editingIndex, setEditingIndex] = useState(null);
  const [rekamDidikModal, setRekamDidikModal] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState(null);
  const [currentRekamDidikForm, setCurrentRekamDidikForm] = useState({});

  // Master data
  const [provinces, setProvinces] = useState([]);
  const [kabupatens, setKabupatens] = useState({});
  const [kecamatans, setKecamatans] = useState({});
  const [kelurahans, setKelurahans] = useState({});
  const [classList, setClassList] = useState([]);
  const [academicYearList, setAcademicYearList] = useState([]);

  const studentId = localStorage.getItem('user_id');
  const userRole = localStorage.getItem('role');
  const isAdmin = userRole === 'admin';

  // Load data on mount
  useEffect(() => {
    loadStudentData();
    checkDraft();
    loadMasterData();
    loadRekamDidik();
    loadClassList();
    loadAcademicYearList();
  }, []);

  // Auto-save draft on data change
  useEffect(() => {
    const timer = setTimeout(() => {
      saveVervalDraft();
    }, 1000);
    return () => clearTimeout(timer);
  }, [studentData, ayahData, ibuData, waliData, alamatAyah, alamatIbu, alamatWali, alamatSiswa]);

  // Copy ayah data to ibu when checkbox is checked
  useEffect(() => {
    if (alamatIbu.sama_dengan_ayah) {
      setAlamatIbu(prev => ({
        ...prev,
        ...alamatAyah,
        sama_dengan_ayah: true,
      }));
    }
  }, [alamatIbu.sama_dengan_ayah, alamatAyah]);

  // Copy data when wali sama dengan ayah/ibu
  useEffect(() => {
    if (waliData.sama_dengan === 'ayah') {
      setWaliData(prev => ({
        ...ayahData,
        sama_dengan: 'ayah',
      }));
    } else if (waliData.sama_dengan === 'ibu') {
      setWaliData(prev => ({
        ...ibuData,
        sama_dengan: 'ibu',
      }));
    }
  }, [waliData.sama_dengan]);

  useEffect(() => {
    if (alamatWali.sama_dengan === 'ayah') {
      setAlamatWali(prev => ({
        ...alamatAyah,
        sama_dengan: 'ayah',
      }));
    } else if (alamatWali.sama_dengan === 'ibu') {
      setAlamatWali(prev => ({
        ...alamatIbu,
        sama_dengan: 'ibu',
      }));
    }
  }, [alamatWali.sama_dengan]);

  // Auto-fill alamat siswa based on status tempat tinggal
  useEffect(() => {
    if (alamatSiswa.status_tempat_tinggal === 'Bersama Ayah Kandung') {
      setAlamatSiswa(prev => ({
        ...prev,
        ...alamatAyah,
        status_tempat_tinggal: 'Bersama Ayah Kandung',
      }));
    } else if (alamatSiswa.status_tempat_tinggal === 'Bersama Ibu Kandung') {
      setAlamatSiswa(prev => ({
        ...prev,
        ...alamatIbu,
        status_tempat_tinggal: 'Bersama Ibu Kandung',
      }));
    } else if (alamatSiswa.status_tempat_tinggal === 'Bersama Wali') {
      setAlamatSiswa(prev => ({
        ...prev,
        ...alamatWali,
        status_tempat_tinggal: 'Bersama Wali',
      }));
    }
  }, [alamatSiswa.status_tempat_tinggal]);

  const loadStudentData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/students/${studentId}/profile-emis`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStudentData(data.student || {});
        setAyahData(data.ayah || {});
        setIbuData(data.ibu || {});
        setWaliData(data.wali || {});
        setAlamatAyah(data.alamat_ayah || {});
        setAlamatIbu(data.alamat_ibu || {});
        setAlamatWali(data.alamat_wali || {});
        setAlamatSiswa(data.alamat_siswa || {});
        setPrestasi(data.prestasi || []);
        setBeasiswa(data.beasiswa || []);
        setPendidikanLain(data.pendidikan_lain || []);
        setDokumen(data.dokumen || {});
      }
    } catch (error) {
      console.error('Error loading student data:', error);
      toast.error('Gagal memuat data siswa');
    } finally {
      setLoading(false);
    }
  };

  const loadMasterData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/master/wilayah`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setProvinces(data.provinces || []);
      }
    } catch (error) {
      console.error('Error loading master data:', error);
    }
  };

  const loadRekamDidik = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/students/${studentId}/rekam-didik`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setRekamDidik(data.rekam_didik || {});
      }
    } catch (error) {
      console.error('Error loading rekam didik:', error);
    }
  };

  const loadClassList = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/classes`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setClassList(data || []);
      }
    } catch (error) {
      console.error('Error loading class list:', error);
    }
  };

  const loadAcademicYearList = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/tahun-pelajaran`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAcademicYearList(data || []);
      }
    } catch (error) {
      console.error('Error loading academic year list:', error);
    }
  };

  const checkDraft = () => {
    const draft = localStorage.getItem(`verval_draft_${studentId}`);
    setHasDraft(!!draft);
  };

  const saveVervalDraft = () => {
    const draftData = {
      studentData,
      ayahData,
      ibuData,
      waliData,
      alamatAyah,
      alamatIbu,
      alamatWali,
      alamatSiswa,
      prestasi,
      beasiswa,
      pendidikanLain,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem(`verval_draft_${studentId}`, JSON.stringify(draftData));
    setHasDraft(true);
  };

  const loadDraft = () => {
    const draft = localStorage.getItem(`verval_draft_${studentId}`);
    if (draft) {
      const draftData = JSON.parse(draft);
      setStudentData(draftData.studentData || {});
      setAyahData(draftData.ayahData || {});
      setIbuData(draftData.ibuData || {});
      setWaliData(draftData.waliData || {});
      setAlamatAyah(draftData.alamatAyah || {});
      setAlamatIbu(draftData.alamatIbu || {});
      setAlamatWali(draftData.alamatWali || {});
      setAlamatSiswa(draftData.alamatSiswa || {});
      setPrestasi(draftData.prestasi || []);
      setBeasiswa(draftData.beasiswa || []);
      setPendidikanLain(draftData.pendidikanLain || []);
      toast.success('Draft berhasil dimuat');
    }
  };

  const deleteDraft = () => {
    localStorage.removeItem(`verval_draft_${studentId}`);
    setHasDraft(false);
    toast.success('Draft berhasil dihapus');
    loadStudentData();
  };

  const handleSaveAll = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      const payload = {
        student: studentData,
        ayah: ayahData,
        ibu: ibuData,
        wali: waliData,
        alamat_ayah: alamatAyah,
        alamat_ibu: alamatIbu,
        alamat_wali: alamatWali,
        alamat_siswa: alamatSiswa,
        prestasi,
        beasiswa,
        pendidikan_lain: pendidikanLain,
      };

      const response = await fetch(`${API_BASE_URL}/api/students/${studentId}/profile-emis`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast.success('Data berhasil disimpan');
        localStorage.removeItem(`verval_draft_${studentId}`);
        setHasDraft(false);
        loadStudentData();
      } else {
        toast.error('Gagal menyimpan data');
      }
    } catch (error) {
      console.error('Error saving data:', error);
      toast.error('Terjadi kesalahan saat menyimpan data');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadDokumen = async (jenisDokumen, file) => {
    try {
      setUploading(prev => ({ ...prev, [jenisDokumen]: true }));
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE_URL}/api/students/${studentId}/dokumen/${jenisDokumen}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setDokumen(prev => ({
          ...prev,
          [jenisDokumen]: data.url,
        }));
        toast.success('Dokumen berhasil diupload');
      } else {
        toast.error('Gagal mengupload dokumen');
      }
    } catch (error) {
      console.error('Error uploading document:', error);
      toast.error('Terjadi kesalahan saat mengupload dokumen');
    } finally {
      setUploading(prev => ({ ...prev, [jenisDokumen]: false }));
    }
  };

  const handleDeleteDokumen = async (jenisDokumen) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/students/${studentId}/dokumen/${jenisDokumen}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setDokumen(prev => {
          const newDokumen = { ...prev };
          delete newDokumen[jenisDokumen];
          return newDokumen;
        });
        toast.success('Dokumen berhasil dihapus');
      } else {
        toast.error('Gagal menghapus dokumen');
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Terjadi kesalahan saat menghapus dokumen');
    }
  };

  const handleAddPrestasi = () => {
    if (editingIndex !== null) {
      const newPrestasi = [...prestasi];
      newPrestasi[editingIndex] = currentPrestasiForm;
      setPrestasi(newPrestasi);
      setEditingIndex(null);
    } else {
      setPrestasi([...prestasi, currentPrestasiForm]);
    }
    setCurrentPrestasiForm({});
    setPrestasiModal(false);
    toast.success('Prestasi berhasil ditambahkan');
  };

  const handleEditPrestasi = (index) => {
    setCurrentPrestasiForm(prestasi[index]);
    setEditingIndex(index);
    setPrestasiModal(true);
  };

  const handleDeletePrestasi = (index) => {
    setPrestasi(prestasi.filter((_, i) => i !== index));
    toast.success('Prestasi berhasil dihapus');
  };

  const handleAddBeasiswa = () => {
    if (editingIndex !== null) {
      const newBeasiswa = [...beasiswa];
      newBeasiswa[editingIndex] = currentBeasiswaForm;
      setBeasiswa(newBeasiswa);
      setEditingIndex(null);
    } else {
      setBeasiswa([...beasiswa, currentBeasiswaForm]);
    }
    setCurrentBeasiswaForm({});
    setBeasiswaModal(false);
    toast.success('Beasiswa berhasil ditambahkan');
  };

  const handleEditBeasiswa = (index) => {
    setCurrentBeasiswaForm(beasiswa[index]);
    setEditingIndex(index);
    setBeasiswaModal(true);
  };

  const handleDeleteBeasiswa = (index) => {
    setBeasiswa(beasiswa.filter((_, i) => i !== index));
    toast.success('Beasiswa berhasil dihapus');
  };

  const handleAddPendidikanLain = () => {
    if (editingIndex !== null) {
      const newPendidikanLain = [...pendidikanLain];
      newPendidikanLain[editingIndex] = currentPendidikanLainForm;
      setPendidikanLain(newPendidikanLain);
      setEditingIndex(null);
    } else {
      setPendidikanLain([...pendidikanLain, currentPendidikanLainForm]);
    }
    setCurrentPendidikanLainForm({});
    setPendidikanLainModal(false);
    toast.success('Pendidikan lain berhasil ditambahkan');
  };

  const handleEditPendidikanLain = (index) => {
    setCurrentPendidikanLainForm(pendidikanLain[index]);
    setEditingIndex(index);
    setPendidikanLainModal(true);
  };

  const handleDeletePendidikanLain = (index) => {
    setPendidikanLain(pendidikanLain.filter((_, i) => i !== index));
    toast.success('Pendidikan lain berhasil dihapus');
  };

  const handleEditRekamDidik = (period) => {
    setEditingPeriod(period);
    setCurrentRekamDidikForm(rekamDidik[period] || {});
    setRekamDidikModal(true);
  };

  const handleSaveRekamDidik = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/students/${studentId}/rekam-didik/${editingPeriod}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(currentRekamDidikForm),
      });

      if (response.ok) {
        const data = await response.json();
        setRekamDidik(prev => ({
          ...prev,
          [editingPeriod]: currentRekamDidikForm.class_id ? currentRekamDidikForm : null,
        }));
        toast.success('Rekam didik berhasil disimpan');
        setRekamDidikModal(false);
        setEditingPeriod(null);
        setCurrentRekamDidikForm({});
        loadRekamDidik();
      } else {
        toast.error('Gagal menyimpan rekam didik');
      }
    } catch (error) {
      console.error('Error saving rekam didik:', error);
      toast.error('Terjadi kesalahan saat menyimpan rekam didik');
    }
  };

  const handleClearRekamDidik = () => {
    setCurrentRekamDidikForm({});
  };

  const getMutasiInfo = () => {
    const info = {
      mutasiMasuk: null,
      mutasiKeluar: null,
    };

    const periods = ['7_ganjil', '7_genap', '8_ganjil', '8_genap', '9_ganjil', '9_genap'];

    // Check for mutasi masuk (first non-null period)
    for (let i = 0; i < periods.length; i++) {
      if (rekamDidik[periods[i]]) {
        if (i > 0 && !rekamDidik[periods[i - 1]]) {
          const [kelas, semester] = periods[i].split('_');
          info.mutasiMasuk = `Kelas ${kelas} Semester ${semester === 'ganjil' ? 'Ganjil' : 'Genap'}`;
        }
        break;
      }
    }

    // Check for mutasi keluar (last non-null period followed by null)
    for (let i = 0; i < periods.length - 1; i++) {
      if (rekamDidik[periods[i]] && !rekamDidik[periods[i + 1]]) {
        const [kelas, semester] = periods[i + 1].split('_');
        info.mutasiKeluar = `Kelas ${kelas} Semester ${semester === 'ganjil' ? 'Ganjil' : 'Genap'}`;
        break;
      }
    }

    return info;
  };

  const renderVervalDraftAlert = () => {
    if (!hasDraft) return null;

    return (
      <Alert className="mb-4 border-yellow-500 bg-yellow-50">
        <AlertCircle className="h-4 w-4 text-yellow-600" />
        <AlertDescription className="flex items-center justify-between">
          <span className="text-yellow-800">
            Anda memiliki draft perubahan yang belum disimpan
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={loadDraft}>
              Muat Draft
            </Button>
            <Button size="sm" variant="outline" onClick={deleteDraft}>
              Hapus Draft
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  };

  const renderDataSiswaTab = () => (
    <Card>
      <CardHeader>
        <CardTitle>Data Siswa</CardTitle>
        <CardDescription>Data pribadi siswa sesuai EMIS</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="nama_lengkap">Nama Lengkap *</Label>
            <Input
              id="nama_lengkap"
              value={studentData.nama_lengkap || ''}
              onChange={(e) => setStudentData({ ...studentData, nama_lengkap: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nisn">NISN *</Label>
            <Input
              id="nisn"
              value={studentData.nisn || ''}
              onChange={(e) => setStudentData({ ...studentData, nisn: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nism">NISM (NIS Madrasah)</Label>
            <Input
              id="nism"
              placeholder="NIS Madrasah untuk Buku Induk"
              value={studentData.nism || ''}
              onChange={(e) => setStudentData({ ...studentData, nism: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nomor_peserta_ujian">Nomor Peserta Ujian Madrasah</Label>
            <Input
              id="nomor_peserta_ujian"
              placeholder="Untuk siswa kelas 9"
              value={studentData.nomor_peserta_ujian || ''}
              onChange={(e) => setStudentData({ ...studentData, nomor_peserta_ujian: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="jenis_kelamin">Jenis Kelamin *</Label>
            <Select
              value={studentData.jenis_kelamin || ''}
              onValueChange={(value) => setStudentData({ ...studentData, jenis_kelamin: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih jenis kelamin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="L">Laki-laki</SelectItem>
                <SelectItem value="P">Perempuan</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tempat_lahir">Tempat Lahir *</Label>
            <Input
              id="tempat_lahir"
              value={studentData.tempat_lahir || ''}
              onChange={(e) => setStudentData({ ...studentData, tempat_lahir: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tanggal_lahir">Tanggal Lahir *</Label>
            <Input
              id="tanggal_lahir"
              type="date"
              value={studentData.tanggal_lahir || ''}
              onChange={(e) => setStudentData({ ...studentData, tanggal_lahir: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="kewarganegaraan">Kewarganegaraan *</Label>
            <Select
              value={studentData.kewarganegaraan || 'WNI'}
              onValueChange={(value) => setStudentData({ ...studentData, kewarganegaraan: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WNI">WNI</SelectItem>
                <SelectItem value="WNA">WNA</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {studentData.kewarganegaraan === 'WNI' ? (
            <div className="space-y-2">
              <Label htmlFor="nik">NIK *</Label>
              <Input
                id="nik"
                value={studentData.nik || ''}
                onChange={(e) => setStudentData({ ...studentData, nik: e.target.value })}
                maxLength={16}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="asal_negara">Asal Negara *</Label>
              <Input
                id="asal_negara"
                value={studentData.asal_negara || ''}
                onChange={(e) => setStudentData({ ...studentData, asal_negara: e.target.value })}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="jumlah_saudara">Jumlah Saudara Kandung</Label>
            <Input
              id="jumlah_saudara"
              type="number"
              value={studentData.jumlah_saudara || ''}
              onChange={(e) => setStudentData({ ...studentData, jumlah_saudara: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="anak_ke">Anak Ke</Label>
            <Input
              id="anak_ke"
              type="number"
              value={studentData.anak_ke || ''}
              onChange={(e) => setStudentData({ ...studentData, anak_ke: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="agama">Agama *</Label>
            <Select
              value={studentData.agama || ''}
              onValueChange={(value) => setStudentData({ ...studentData, agama: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih agama" />
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

          <div className="space-y-2">
            <Label htmlFor="cita_cita">Cita-cita</Label>
            <Input
              id="cita_cita"
              value={studentData.cita_cita || ''}
              onChange={(e) => setStudentData({ ...studentData, cita_cita: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="hobi">Hobi</Label>
            <Input
              id="hobi"
              value={studentData.hobi || ''}
              onChange={(e) => setStudentData({ ...studentData, hobi: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="yang_membiayai">Yang Membiayai Sekolah</Label>
            <Select
              value={studentData.yang_membiayai || ''}
              onValueChange={(value) => setStudentData({ ...studentData, yang_membiayai: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Orang Tua">Orang Tua</SelectItem>
                <SelectItem value="Wali">Wali</SelectItem>
                <SelectItem value="Sendiri">Sendiri</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex gap-4 items-center pt-4 border-t">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="pra_sekolah"
              checked={studentData.pra_sekolah || false}
              onCheckedChange={(checked) => setStudentData({ ...studentData, pra_sekolah: checked })}
            />
            <Label htmlFor="pra_sekolah">Pernah Pra Sekolah/TK</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="imunisasi"
              checked={studentData.imunisasi || false}
              onCheckedChange={(checked) => setStudentData({ ...studentData, imunisasi: checked })}
            />
            <Label htmlFor="imunisasi">Pernah Mendapat Imunisasi</Label>
          </div>
        </div>

        <div className="pt-4 border-t">
          <h3 className="font-semibold mb-4">Kontak</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="no_hp_siswa">No HP Siswa</Label>
              <Input
                id="no_hp_siswa"
                value={studentData.no_hp_siswa || ''}
                onChange={(e) => setStudentData({ ...studentData, no_hp_siswa: e.target.value })}
                disabled={studentData.tidak_punya_hp}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email_siswa">Email Siswa</Label>
              <Input
                id="email_siswa"
                type="email"
                value={studentData.email_siswa || ''}
                onChange={(e) => setStudentData({ ...studentData, email_siswa: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-center space-x-2 mt-2">
            <Checkbox
              id="tidak_punya_hp"
              checked={studentData.tidak_punya_hp || false}
              onCheckedChange={(checked) => setStudentData({ ...studentData, tidak_punya_hp: checked })}
            />
            <Label htmlFor="tidak_punya_hp">Tidak punya HP</Label>
          </div>
        </div>

        <div className="pt-4 border-t">
          <h3 className="font-semibold mb-4">Nomor Identitas Keluarga</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nomor_kk">Nomor Kartu Keluarga (KK)</Label>
              <Input
                id="nomor_kk"
                value={studentData.nomor_kk || ''}
                onChange={(e) => setStudentData({ ...studentData, nomor_kk: e.target.value })}
                maxLength={16}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nama_kepala_keluarga">Nama Kepala Keluarga</Label>
              <Input
                id="nama_kepala_keluarga"
                value={studentData.nama_kepala_keluarga || ''}
                onChange={(e) => setStudentData({ ...studentData, nama_kepala_keluarga: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nomor_kip">Nomor KIP</Label>
              <Input
                id="nomor_kip"
                value={studentData.nomor_kip || ''}
                onChange={(e) => setStudentData({ ...studentData, nomor_kip: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nomor_pkh">Nomor PKH</Label>
              <Input
                id="nomor_pkh"
                value={studentData.nomor_pkh || ''}
                onChange={(e) => setStudentData({ ...studentData, nomor_pkh: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nomor_kks">Nomor KKS</Label>
              <Input
                id="nomor_kks"
                value={studentData.nomor_kks || ''}
                onChange={(e) => setStudentData({ ...studentData, nomor_kks: e.target.value })}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderParentForm = (type, data, setData) => {
    const isDisabled = data[`status_${type}`] === 'Meninggal' || data[`status_${type}`] === 'Tidak Diketahui';
    const label = type === 'ayah' ? 'Ayah' : type === 'ibu' ? 'Ibu' : 'Wali';

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={`nama_${type}`}>Nama {label} *</Label>
            <Input
              id={`nama_${type}`}
              value={data[`nama_${type}`] || ''}
              onChange={(e) => setData({ ...data, [`nama_${type}`]: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`status_${type}`}>Status {label} *</Label>
            <Select
              value={data[`status_${type}`] || 'Hidup'}
              onValueChange={(value) => setData({ ...data, [`status_${type}`]: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Hidup">Hidup</SelectItem>
                <SelectItem value="Meninggal">Meninggal</SelectItem>
                <SelectItem value="Tidak Diketahui">Tidak Diketahui</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`kewarganegaraan_${type}`}>Kewarganegaraan *</Label>
            <Select
              value={data[`kewarganegaraan_${type}`] || 'WNI'}
              onValueChange={(value) => setData({ ...data, [`kewarganegaraan_${type}`]: value })}
              disabled={isDisabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WNI">WNI</SelectItem>
                <SelectItem value="WNA">WNA</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {data[`kewarganegaraan_${type}`] === 'WNI' ? (
            <div className="space-y-2">
              <Label htmlFor={`nik_${type}`}>NIK *</Label>
              <Input
                id={`nik_${type}`}
                value={data[`nik_${type}`] || ''}
                onChange={(e) => setData({ ...data, [`nik_${type}`]: e.target.value })}
                maxLength={16}
                disabled={isDisabled}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor={`asal_negara_${type}`}>Asal Negara *</Label>
              <Input
                id={`asal_negara_${type}`}
                value={data[`asal_negara_${type}`] || ''}
                onChange={(e) => setData({ ...data, [`asal_negara_${type}`]: e.target.value })}
                disabled={isDisabled}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor={`tempat_lahir_${type}`}>Tempat Lahir</Label>
            <Input
              id={`tempat_lahir_${type}`}
              value={data[`tempat_lahir_${type}`] || ''}
              onChange={(e) => setData({ ...data, [`tempat_lahir_${type}`]: e.target.value })}
              disabled={isDisabled}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`tanggal_lahir_${type}`}>Tanggal Lahir</Label>
            <Input
              id={`tanggal_lahir_${type}`}
              type="date"
              value={data[`tanggal_lahir_${type}`] || ''}
              onChange={(e) => setData({ ...data, [`tanggal_lahir_${type}`]: e.target.value })}
              disabled={isDisabled}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`pendidikan_${type}`}>Pendidikan Terakhir</Label>
            <Select
              value={data[`pendidikan_${type}`] || ''}
              onValueChange={(value) => setData({ ...data, [`pendidikan_${type}`]: value })}
              disabled={isDisabled}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih pendidikan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SD/Sederajat">SD/Sederajat</SelectItem>
                <SelectItem value="SMP/Sederajat">SMP/Sederajat</SelectItem>
                <SelectItem value="SMA/Sederajat">SMA/Sederajat</SelectItem>
                <SelectItem value="D1">D1</SelectItem>
                <SelectItem value="D2">D2</SelectItem>
                <SelectItem value="D3">D3</SelectItem>
                <SelectItem value="D4/S1">D4/S1</SelectItem>
                <SelectItem value="S2">S2</SelectItem>
                <SelectItem value="S3">S3</SelectItem>
                <SelectItem value="Tidak Sekolah">Tidak Sekolah</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`pekerjaan_${type}`}>Pekerjaan</Label>
            <Input
              id={`pekerjaan_${type}`}
              value={data[`pekerjaan_${type}`] || ''}
              onChange={(e) => setData({ ...data, [`pekerjaan_${type}`]: e.target.value })}
              disabled={isDisabled}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`penghasilan_${type}`}>Penghasilan per Bulan</Label>
            <Select
              value={data[`penghasilan_${type}`] || ''}
              onValueChange={(value) => setData({ ...data, [`penghasilan_${type}`]: value })}
              disabled={isDisabled}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih penghasilan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Kurang dari 500.000">Kurang dari Rp 500.000</SelectItem>
                <SelectItem value="500.000 - 1.000.000">Rp 500.000 - Rp 1.000.000</SelectItem>
                <SelectItem value="1.000.000 - 2.000.000">Rp 1.000.000 - Rp 2.000.000</SelectItem>
                <SelectItem value="2.000.000 - 3.000.000">Rp 2.000.000 - Rp 3.000.000</SelectItem>
                <SelectItem value="3.000.000 - 5.000.000">Rp 3.000.000 - Rp 5.000.000</SelectItem>
                <SelectItem value="Lebih dari 5.000.000">Lebih dari Rp 5.000.000</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`no_hp_${type}`}>No HP</Label>
            <Input
              id={`no_hp_${type}`}
              value={data[`no_hp_${type}`] || ''}
              onChange={(e) => setData({ ...data, [`no_hp_${type}`]: e.target.value })}
              disabled={isDisabled}
            />
          </div>
        </div>
      </div>
    );
  };

  const renderDataOrangTuaTab = () => (
    <Card>
      <CardHeader>
        <CardTitle>Data Orang Tua</CardTitle>
        <CardDescription>Data ayah dan ibu kandung</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeParentTab} onValueChange={setActiveParentTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="ayah">Ayah Kandung</TabsTrigger>
            <TabsTrigger value="ibu">Ibu Kandung</TabsTrigger>
          </TabsList>
          <TabsContent value="ayah" className="mt-4">
            {renderParentForm('ayah', ayahData, setAyahData)}
          </TabsContent>
          <TabsContent value="ibu" className="mt-4">
            {renderParentForm('ibu', ibuData, setIbuData)}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );

  const renderDataWaliTab = () => (
    <Card>
      <CardHeader>
        <CardTitle>Data Wali</CardTitle>
        <CardDescription>Data wali siswa (jika ada)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="sama_dengan_wali">Data Wali Sama Dengan</Label>
          <Select
            value={waliData.sama_dengan || ''}
            onValueChange={(value) => setWaliData({ ...waliData, sama_dengan: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Pilih atau isi manual" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Isi Manual</SelectItem>
              <SelectItem value="ayah">Sama dengan Ayah Kandung</SelectItem>
              <SelectItem value="ibu">Sama dengan Ibu Kandung</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {renderParentForm('wali', waliData, setWaliData)}
      </CardContent>
    </Card>
  );

  const renderAddressForm = (type, data, setData, showSamaDengan = false) => {
    const label = type === 'ayah' ? 'Ayah Kandung' : type === 'ibu' ? 'Ibu Kandung' : type === 'wali' ? 'Wali' : 'Siswa';

    return (
      <div className="space-y-4">
        {showSamaDengan && type !== 'ayah' && type !== 'siswa' && (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={`sama_dengan_ayah_${type}`}
              checked={data.sama_dengan_ayah || data.sama_dengan === 'ayah'}
              onCheckedChange={(checked) => {
                if (type === 'ibu') {
                  setData({ ...data, sama_dengan_ayah: checked });
                } else {
                  setData({ ...data, sama_dengan: checked ? 'ayah' : '' });
                }
              }}
            />
            <Label htmlFor={`sama_dengan_ayah_${type}`}>Sama dengan Ayah Kandung</Label>
          </div>
        )}

        {showSamaDengan && type === 'wali' && (
          <div className="flex items-center space-x-2">
            <Checkbox
              id="sama_dengan_ibu_wali"
              checked={data.sama_dengan === 'ibu'}
              onCheckedChange={(checked) => setData({ ...data, sama_dengan: checked ? 'ibu' : '' })}
            />
            <Label htmlFor="sama_dengan_ibu_wali">Sama dengan Ibu Kandung</Label>
          </div>
        )}

        {type === 'siswa' && (
          <div className="space-y-2">
            <Label htmlFor="status_tempat_tinggal">Status Tempat Tinggal *</Label>
            <Select
              value={data.status_tempat_tinggal || ''}
              onValueChange={(value) => setData({ ...data, status_tempat_tinggal: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih status tempat tinggal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Bersama Ayah Kandung">Bersama Ayah Kandung</SelectItem>
                <SelectItem value="Bersama Ibu Kandung">Bersama Ibu Kandung</SelectItem>
                <SelectItem value="Bersama Wali">Bersama Wali</SelectItem>
                <SelectItem value="Di Asrama">Di Asrama</SelectItem>
                <SelectItem value="Kost">Kost</SelectItem>
                <SelectItem value="Lainnya">Lainnya</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex items-center space-x-2">
          <Checkbox
            id={`tinggal_luar_negeri_${type}`}
            checked={data.tinggal_luar_negeri || false}
            onCheckedChange={(checked) => setData({ ...data, tinggal_luar_negeri: checked })}
          />
          <Label htmlFor={`tinggal_luar_negeri_${type}`}>Tinggal di Luar Negeri</Label>
        </div>

        {data.tinggal_luar_negeri && (
          <div className="space-y-2">
            <Label htmlFor={`negara_${type}`}>Negara</Label>
            <Input
              id={`negara_${type}`}
              value={data.negara || ''}
              onChange={(e) => setData({ ...data, negara: e.target.value })}
            />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={`status_kepemilikan_${type}`}>Status Kepemilikan</Label>
            <Select
              value={data[`status_kepemilikan_${type}`] || ''}
              onValueChange={(value) => setData({ ...data, [`status_kepemilikan_${type}`]: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Milik Sendiri">Milik Sendiri</SelectItem>
                <SelectItem value="Kontrak">Kontrak</SelectItem>
                <SelectItem value="Menumpang">Menumpang</SelectItem>
                <SelectItem value="Lainnya">Lainnya</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {!data.tinggal_luar_negeri && (
            <>
              <div className="space-y-2">
                <Label htmlFor={`provinsi_${type}`}>Provinsi</Label>
                <Select
                  value={data[`provinsi_${type}`] || ''}
                  onValueChange={(value) => setData({ ...data, [`provinsi_${type}`]: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih provinsi" />
                  </SelectTrigger>
                  <SelectContent>
                    {provinces.map((prov) => (
                      <SelectItem key={prov.id} value={prov.id}>
                        {prov.nama}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`kabupaten_${type}`}>Kabupaten/Kota</Label>
                <Select
                  value={data[`kabupaten_${type}`] || ''}
                  onValueChange={(value) => setData({ ...data, [`kabupaten_${type}`]: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih kabupaten/kota" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Kabupaten options based on selected province */}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`kecamatan_${type}`}>Kecamatan</Label>
                <Select
                  value={data[`kecamatan_${type}`] || ''}
                  onValueChange={(value) => setData({ ...data, [`kecamatan_${type}`]: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih kecamatan" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Kecamatan options */}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`kelurahan_${type}`}>Kelurahan/Desa</Label>
                <Select
                  value={data[`kelurahan_${type}`] || ''}
                  onValueChange={(value) => setData({ ...data, [`kelurahan_${type}`]: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih kelurahan/desa" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Kelurahan options */}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`rt_${type}`}>RT</Label>
                <Input
                  id={`rt_${type}`}
                  value={data[`rt_${type}`] || ''}
                  onChange={(e) => setData({ ...data, [`rt_${type}`]: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`rw_${type}`}>RW</Label>
                <Input
                  id={`rw_${type}`}
                  value={data[`rw_${type}`] || ''}
                  onChange={(e) => setData({ ...data, [`rw_${type}`]: e.target.value })}
                />
              </div>
            </>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor={`alamat_${type}`}>Alamat Lengkap</Label>
          <Input
            id={`alamat_${type}`}
            value={data[`alamat_${type}`] || ''}
            onChange={(e) => setData({ ...data, [`alamat_${type}`]: e.target.value })}
          />
        </div>

        {!data.tinggal_luar_negeri && (
          <div className="space-y-2">
            <Label htmlFor={`kode_pos_${type}`}>Kode Pos</Label>
            <Input
              id={`kode_pos_${type}`}
              value={data[`kode_pos_${type}`] || ''}
              onChange={(e) => setData({ ...data, [`kode_pos_${type}`]: e.target.value })}
              maxLength={5}
            />
          </div>
        )}

        {type === 'siswa' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
            <div className="space-y-2">
              <Label htmlFor="jarak_tempuh">Jarak Tempuh (km)</Label>
              <Input
                id="jarak_tempuh"
                type="number"
                value={data.jarak_tempuh || ''}
                onChange={(e) => setData({ ...data, jarak_tempuh: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="transportasi">Transportasi</Label>
              <Select
                value={data.transportasi || ''}
                onValueChange={(value) => setData({ ...data, transportasi: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih transportasi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Jalan Kaki">Jalan Kaki</SelectItem>
                  <SelectItem value="Sepeda">Sepeda</SelectItem>
                  <SelectItem value="Sepeda Motor">Sepeda Motor</SelectItem>
                  <SelectItem value="Mobil Pribadi">Mobil Pribadi</SelectItem>
                  <SelectItem value="Angkutan Umum">Angkutan Umum</SelectItem>
                  <SelectItem value="Ojek">Ojek</SelectItem>
                  <SelectItem value="Lainnya">Lainnya</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="waktu_tempuh">Waktu Tempuh (menit)</Label>
              <Input
                id="waktu_tempuh"
                type="number"
                value={data.waktu_tempuh || ''}
                onChange={(e) => setData({ ...data, waktu_tempuh: e.target.value })}
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderDataAlamatTab = () => (
    <Card>
      <CardHeader>
        <CardTitle>Data Alamat</CardTitle>
        <CardDescription>Alamat lengkap orang tua, wali, dan tempat tinggal siswa</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeAlamatTab} onValueChange={setActiveAlamatTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="alamat-ayah">Alamat Ayah</TabsTrigger>
            <TabsTrigger value="alamat-ibu">Alamat Ibu</TabsTrigger>
            <TabsTrigger value="alamat-wali">Alamat Wali</TabsTrigger>
            <TabsTrigger value="alamat-siswa">Alamat Siswa</TabsTrigger>
          </TabsList>
          <TabsContent value="alamat-ayah" className="mt-4">
            {renderAddressForm('ayah', alamatAyah, setAlamatAyah, false)}
          </TabsContent>
          <TabsContent value="alamat-ibu" className="mt-4">
            {renderAddressForm('ibu', alamatIbu, setAlamatIbu, true)}
          </TabsContent>
          <TabsContent value="alamat-wali" className="mt-4">
            {renderAddressForm('wali', alamatWali, setAlamatWali, true)}
          </TabsContent>
          <TabsContent value="alamat-siswa" className="mt-4">
            {renderAddressForm('siswa', alamatSiswa, setAlamatSiswa, false)}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );

  const renderPrestasiTab = () => (
    <Card>
      <CardHeader>
        <CardTitle>Prestasi</CardTitle>
        <CardDescription>Daftar prestasi yang pernah diraih siswa</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={() => { setPrestasiModal(true); setEditingIndex(null); setCurrentPrestasiForm({}); }}>
          <Plus className="mr-2 h-4 w-4" /> Tambah Prestasi
        </Button>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Jenis</TableHead>
              <TableHead>Tingkat</TableHead>
              <TableHead>Nama Lomba</TableHead>
              <TableHead>Peringkat</TableHead>
              <TableHead>Tahun</TableHead>
              <TableHead>Penyelenggara</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {prestasi.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Belum ada data prestasi
                </TableCell>
              </TableRow>
            ) : (
              prestasi.map((item, index) => (
                <TableRow key={index}>
                  <TableCell>{item.jenis_prestasi}</TableCell>
                  <TableCell>{item.tingkat}</TableCell>
                  <TableCell>{item.nama_lomba}</TableCell>
                  <TableCell>{item.peringkat}</TableCell>
                  <TableCell>{item.tahun}</TableCell>
                  <TableCell>{item.penyelenggara}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleEditPrestasi(index)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDeletePrestasi(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <Dialog open={prestasiModal} onOpenChange={setPrestasiModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingIndex !== null ? 'Edit' : 'Tambah'} Prestasi</DialogTitle>
              <DialogDescription>Masukkan data prestasi siswa</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="jenis_prestasi">Jenis Prestasi</Label>
                <Select
                  value={currentPrestasiForm.jenis_prestasi || ''}
                  onValueChange={(value) => setCurrentPrestasiForm({ ...currentPrestasiForm, jenis_prestasi: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih jenis" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Akademik">Akademik</SelectItem>
                    <SelectItem value="Non-Akademik">Non-Akademik</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tingkat">Tingkat</Label>
                <Select
                  value={currentPrestasiForm.tingkat || ''}
                  onValueChange={(value) => setCurrentPrestasiForm({ ...currentPrestasiForm, tingkat: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih tingkat" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sekolah">Sekolah</SelectItem>
                    <SelectItem value="Kecamatan">Kecamatan</SelectItem>
                    <SelectItem value="Kabupaten">Kabupaten</SelectItem>
                    <SelectItem value="Provinsi">Provinsi</SelectItem>
                    <SelectItem value="Nasional">Nasional</SelectItem>
                    <SelectItem value="Internasional">Internasional</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 col-span-2">
                <Label htmlFor="nama_lomba">Nama Lomba/Kejuaraan</Label>
                <Input
                  id="nama_lomba"
                  value={currentPrestasiForm.nama_lomba || ''}
                  onChange={(e) => setCurrentPrestasiForm({ ...currentPrestasiForm, nama_lomba: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="peringkat">Peringkat/Juara</Label>
                <Input
                  id="peringkat"
                  value={currentPrestasiForm.peringkat || ''}
                  onChange={(e) => setCurrentPrestasiForm({ ...currentPrestasiForm, peringkat: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tahun">Tahun</Label>
                <Input
                  id="tahun"
                  type="number"
                  value={currentPrestasiForm.tahun || ''}
                  onChange={(e) => setCurrentPrestasiForm({ ...currentPrestasiForm, tahun: e.target.value })}
                />
              </div>

              <div className="space-y-2 col-span-2">
                <Label htmlFor="penyelenggara">Penyelenggara</Label>
                <Input
                  id="penyelenggara"
                  value={currentPrestasiForm.penyelenggara || ''}
                  onChange={(e) => setCurrentPrestasiForm({ ...currentPrestasiForm, penyelenggara: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPrestasiModal(false)}>Batal</Button>
              <Button onClick={handleAddPrestasi}>
                <Save className="mr-2 h-4 w-4" /> Simpan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );

  const renderBeasiswaTab = () => (
    <Card>
      <CardHeader>
        <CardTitle>Beasiswa & Bantuan</CardTitle>
        <CardDescription>Daftar beasiswa dan bantuan yang pernah diterima</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={() => { setBeasiswaModal(true); setEditingIndex(null); setCurrentBeasiswaForm({}); }}>
          <Plus className="mr-2 h-4 w-4" /> Tambah Beasiswa
        </Button>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Jenis</TableHead>
              <TableHead>Nama Beasiswa</TableHead>
              <TableHead>Penyelenggara</TableHead>
              <TableHead>Tahun Mulai</TableHead>
              <TableHead>Tahun Selesai</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {beasiswa.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Belum ada data beasiswa
                </TableCell>
              </TableRow>
            ) : (
              beasiswa.map((item, index) => (
                <TableRow key={index}>
                  <TableCell>{item.jenis_beasiswa}</TableCell>
                  <TableCell>{item.nama_beasiswa}</TableCell>
                  <TableCell>{item.penyelenggara}</TableCell>
                  <TableCell>{item.tahun_mulai}</TableCell>
                  <TableCell>{item.tahun_selesai}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleEditBeasiswa(index)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDeleteBeasiswa(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <Dialog open={beasiswaModal} onOpenChange={setBeasiswaModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingIndex !== null ? 'Edit' : 'Tambah'} Beasiswa</DialogTitle>
              <DialogDescription>Masukkan data beasiswa/bantuan</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="jenis_beasiswa">Jenis</Label>
                <Select
                  value={currentBeasiswaForm.jenis_beasiswa || ''}
                  onValueChange={(value) => setCurrentBeasiswaForm({ ...currentBeasiswaForm, jenis_beasiswa: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih jenis" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="KIP">KIP</SelectItem>
                    <SelectItem value="PKH">PKH</SelectItem>
                    <SelectItem value="KKS">KKS</SelectItem>
                    <SelectItem value="Beasiswa Prestasi">Beasiswa Prestasi</SelectItem>
                    <SelectItem value="Beasiswa Lainnya">Beasiswa Lainnya</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="nama_beasiswa">Nama Beasiswa</Label>
                <Input
                  id="nama_beasiswa"
                  value={currentBeasiswaForm.nama_beasiswa || ''}
                  onChange={(e) => setCurrentBeasiswaForm({ ...currentBeasiswaForm, nama_beasiswa: e.target.value })}
                />
              </div>

              <div className="space-y-2 col-span-2">
                <Label htmlFor="penyelenggara_beasiswa">Penyelenggara</Label>
                <Input
                  id="penyelenggara_beasiswa"
                  value={currentBeasiswaForm.penyelenggara || ''}
                  onChange={(e) => setCurrentBeasiswaForm({ ...currentBeasiswaForm, penyelenggara: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tahun_mulai">Tahun Mulai</Label>
                <Input
                  id="tahun_mulai"
                  type="number"
                  value={currentBeasiswaForm.tahun_mulai || ''}
                  onChange={(e) => setCurrentBeasiswaForm({ ...currentBeasiswaForm, tahun_mulai: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tahun_selesai">Tahun Selesai</Label>
                <Input
                  id="tahun_selesai"
                  type="number"
                  value={currentBeasiswaForm.tahun_selesai || ''}
                  onChange={(e) => setCurrentBeasiswaForm({ ...currentBeasiswaForm, tahun_selesai: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBeasiswaModal(false)}>Batal</Button>
              <Button onClick={handleAddBeasiswa}>
                <Save className="mr-2 h-4 w-4" /> Simpan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );

  const renderPendidikanLainTab = () => (
    <Card>
      <CardHeader>
        <CardTitle>Pendidikan Lain</CardTitle>
        <CardDescription>Pendidikan non-formal yang sedang/pernah diikuti</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={() => { setPendidikanLainModal(true); setEditingIndex(null); setCurrentPendidikanLainForm({}); }}>
          <Plus className="mr-2 h-4 w-4" /> Tambah Pendidikan
        </Button>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Jenis</TableHead>
              <TableHead>Nama Lembaga</TableHead>
              <TableHead>Tahun Mulai</TableHead>
              <TableHead>Tahun Selesai</TableHead>
              <TableHead>Keterangan</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pendidikanLain.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Belum ada data pendidikan lain
                </TableCell>
              </TableRow>
            ) : (
              pendidikanLain.map((item, index) => (
                <TableRow key={index}>
                  <TableCell>{item.jenis_pendidikan}</TableCell>
                  <TableCell>{item.nama_lembaga}</TableCell>
                  <TableCell>{item.tahun_mulai}</TableCell>
                  <TableCell>{item.tahun_selesai}</TableCell>
                  <TableCell>{item.keterangan}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleEditPendidikanLain(index)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDeletePendidikanLain(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <Dialog open={pendidikanLainModal} onOpenChange={setPendidikanLainModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingIndex !== null ? 'Edit' : 'Tambah'} Pendidikan Lain</DialogTitle>
              <DialogDescription>Masukkan data pendidikan non-formal</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="jenis_pendidikan">Jenis Pendidikan</Label>
                <Select
                  value={currentPendidikanLainForm.jenis_pendidikan || ''}
                  onValueChange={(value) => setCurrentPendidikanLainForm({ ...currentPendidikanLainForm, jenis_pendidikan: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih jenis" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TPQ/TPA">TPQ/TPA</SelectItem>
                    <SelectItem value="Pesantren">Pesantren</SelectItem>
                    <SelectItem value="Kursus">Kursus</SelectItem>
                    <SelectItem value="Lainnya">Lainnya</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="nama_lembaga">Nama Lembaga</Label>
                <Input
                  id="nama_lembaga"
                  value={currentPendidikanLainForm.nama_lembaga || ''}
                  onChange={(e) => setCurrentPendidikanLainForm({ ...currentPendidikanLainForm, nama_lembaga: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tahun_mulai_pendidikan">Tahun Mulai</Label>
                <Input
                  id="tahun_mulai_pendidikan"
                  type="number"
                  value={currentPendidikanLainForm.tahun_mulai || ''}
                  onChange={(e) => setCurrentPendidikanLainForm({ ...currentPendidikanLainForm, tahun_mulai: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tahun_selesai_pendidikan">Tahun Selesai</Label>
                <Input
                  id="tahun_selesai_pendidikan"
                  type="number"
                  value={currentPendidikanLainForm.tahun_selesai || ''}
                  onChange={(e) => setCurrentPendidikanLainForm({ ...currentPendidikanLainForm, tahun_selesai: e.target.value })}
                />
              </div>

              <div className="space-y-2 col-span-2">
                <Label htmlFor="keterangan">Keterangan</Label>
                <Input
                  id="keterangan"
                  value={currentPendidikanLainForm.keterangan || ''}
                  onChange={(e) => setCurrentPendidikanLainForm({ ...currentPendidikanLainForm, keterangan: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPendidikanLainModal(false)}>Batal</Button>
              <Button onClick={handleAddPendidikanLain}>
                <Save className="mr-2 h-4 w-4" /> Simpan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );

  const renderDokumenCard = (title, jenis, icon, isConditional = false, conditionalField = '') => {
    const isActive = !isConditional || (conditionalField && studentData[conditionalField]);
    const hasDocument = dokumen[jenis];

    return (
      <Card className={!isActive ? 'opacity-50' : ''}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {icon}
            {title}
            {isConditional && !isActive && (
              <span className="text-xs text-muted-foreground">(Tidak Aktif)</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasDocument ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-600">Dokumen telah diupload</span>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(dokumen[jenis], '_blank')}
                >
                  <Eye className="mr-2 h-4 w-4" /> Lihat
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDeleteDokumen(jenis)}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Hapus
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <Input
                type="file"
                accept="image/*,.pdf"
                disabled={!isActive || uploading[jenis]}
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) handleUploadDokumen(jenis, file);
                }}
              />
              {uploading[jenis] && (
                <p className="text-sm text-muted-foreground mt-2">Mengupload...</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderArsipDokumenTab = () => (
    <Card>
      <CardHeader>
        <CardTitle>Arsip Dokumen</CardTitle>
        <CardDescription>Upload dan kelola dokumen siswa</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {renderDokumenCard('Pas Foto', 'pas_foto', <ImageIcon className="h-4 w-4" />)}
          {renderDokumenCard('Akte Kelahiran', 'akte_kelahiran', <FileText className="h-4 w-4" />)}
          {renderDokumenCard('Ijazah SD/MI', 'ijazah_sd', <FileText className="h-4 w-4" />)}
          {renderDokumenCard('Kartu Keluarga', 'kartu_keluarga', <FileText className="h-4 w-4" />)}
          {renderDokumenCard('KIP', 'kip', <FileText className="h-4 w-4" />, true, 'nomor_kip')}
          {renderDokumenCard('PKH', 'pkh', <FileText className="h-4 w-4" />, true, 'nomor_pkh')}
          {renderDokumenCard('KKS', 'kks', <FileText className="h-4 w-4" />, true, 'nomor_kks')}
          {renderDokumenCard('Ijazah MTs', 'ijazah_mts', <FileText className="h-4 w-4" />)}
        </div>
      </CardContent>
    </Card>
  );

  const renderRekamDidikTab = () => {
    const mutasiInfo = getMutasiInfo();

    const getPeriodData = (period) => {
      return rekamDidik[period];
    };

    const getCellStyle = (data, period) => {
      if (!data) {
        // Check if this is mutasi keluar (previous period has data)
        const periods = ['7_ganjil', '7_genap', '8_ganjil', '8_genap', '9_ganjil', '9_genap'];
        const currentIndex = periods.indexOf(period);
        if (currentIndex > 0 && rekamDidik[periods[currentIndex - 1]]) {
          return 'bg-red-50 text-red-700';
        }
        return 'bg-gray-50 text-gray-500';
      }
      return 'bg-green-50 text-green-700';
    };

    const getCellContent = (data, period) => {
      if (!data) {
        const periods = ['7_ganjil', '7_genap', '8_ganjil', '8_genap', '9_ganjil', '9_genap'];
        const currentIndex = periods.indexOf(period);
        if (currentIndex > 0 && rekamDidik[periods[currentIndex - 1]]) {
          return 'Mutasi Keluar';
        }
        return 'Belum diisi';
      }
      return (
        <div className="space-y-1">
          <div className="font-semibold">{data.class_name || '-'}</div>
          <div className="text-xs">{data.tahun_pelajaran || '-'}</div>
        </div>
      );
    };

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Rekam Didik
          </CardTitle>
          <CardDescription>Riwayat kelas siswa per semester</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(mutasiInfo.mutasiMasuk || mutasiInfo.mutasiKeluar) && (
            <Alert className="border-blue-500 bg-blue-50">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription>
                <div className="text-blue-800 space-y-1">
                  {mutasiInfo.mutasiMasuk && (
                    <div>Siswa mutasi masuk di {mutasiInfo.mutasiMasuk}</div>
                  )}
                  {mutasiInfo.mutasiKeluar && (
                    <div>Siswa mutasi keluar di {mutasiInfo.mutasiKeluar}</div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Tingkat</TableHead>
                  <TableHead>Semester Ganjil</TableHead>
                  <TableHead>Semester Genap</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-semibold">Kelas 7</TableCell>
                  <TableCell>
                    <div className={`p-3 rounded-lg ${getCellStyle(getPeriodData('7_ganjil'), '7_ganjil')}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          {getCellContent(getPeriodData('7_ganjil'), '7_ganjil')}
                        </div>
                        {isAdmin && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditRekamDidik('7_ganjil')}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className={`p-3 rounded-lg ${getCellStyle(getPeriodData('7_genap'), '7_genap')}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          {getCellContent(getPeriodData('7_genap'), '7_genap')}
                        </div>
                        {isAdmin && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditRekamDidik('7_genap')}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </TableCell>
                </TableRow>

                <TableRow>
                  <TableCell className="font-semibold">Kelas 8</TableCell>
                  <TableCell>
                    <div className={`p-3 rounded-lg ${getCellStyle(getPeriodData('8_ganjil'), '8_ganjil')}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          {getCellContent(getPeriodData('8_ganjil'), '8_ganjil')}
                        </div>
                        {isAdmin && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditRekamDidik('8_ganjil')}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className={`p-3 rounded-lg ${getCellStyle(getPeriodData('8_genap'), '8_genap')}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          {getCellContent(getPeriodData('8_genap'), '8_genap')}
                        </div>
                        {isAdmin && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditRekamDidik('8_genap')}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </TableCell>
                </TableRow>

                <TableRow>
                  <TableCell className="font-semibold">Kelas 9</TableCell>
                  <TableCell>
                    <div className={`p-3 rounded-lg ${getCellStyle(getPeriodData('9_ganjil'), '9_ganjil')}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          {getCellContent(getPeriodData('9_ganjil'), '9_ganjil')}
                        </div>
                        {isAdmin && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditRekamDidik('9_ganjil')}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className={`p-3 rounded-lg ${getCellStyle(getPeriodData('9_genap'), '9_genap')}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          {getCellContent(getPeriodData('9_genap'), '9_genap')}
                        </div>
                        {isAdmin && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditRekamDidik('9_genap')}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <Dialog open={rekamDidikModal} onOpenChange={setRekamDidikModal}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Edit Rekam Didik</DialogTitle>
                <DialogDescription>
                  Edit data kelas untuk {editingPeriod && editingPeriod.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="class_id">Kelas</Label>
                  <Select
                    value={currentRekamDidikForm.class_id || ''}
                    onValueChange={(value) => {
                      const selectedClass = classList.find(c => c.id === value);
                      setCurrentRekamDidikForm({
                        ...currentRekamDidikForm,
                        class_id: value,
                        class_name: selectedClass ? selectedClass.name : '',
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih kelas" />
                    </SelectTrigger>
                    <SelectContent>
                      {classList.map((kelas) => (
                        <SelectItem key={kelas.id} value={kelas.id}>
                          {kelas.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tahun_pelajaran_id">Tahun Pelajaran</Label>
                  <Select
                    value={currentRekamDidikForm.tahun_pelajaran_id || ''}
                    onValueChange={(value) => {
                      const selectedYear = academicYearList.find(y => y.id === value);
                      setCurrentRekamDidikForm({
                        ...currentRekamDidikForm,
                        tahun_pelajaran_id: value,
                        tahun_pelajaran: selectedYear ? selectedYear.tahun : '',
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih tahun pelajaran" />
                    </SelectTrigger>
                    <SelectContent>
                      {academicYearList.map((year) => (
                        <SelectItem key={year.id} value={year.id}>
                          {year.tahun}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleClearRekamDidik}
                >
                  <X className="mr-2 h-4 w-4" /> Kosongkan (Mutasi Keluar)
                </Button>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRekamDidikModal(false)}>Batal</Button>
                <Button onClick={handleSaveRekamDidik}>
                  <Save className="mr-2 h-4 w-4" /> Simpan
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    );
  };

  const renderInfoAkunTab = () => (
    <Card>
      <CardHeader>
        <CardTitle>Info Akun</CardTitle>
        <CardDescription>Informasi akun dan pengaturan</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Username</Label>
            <Input value={localStorage.getItem('username') || '-'} disabled />
          </div>

          <div className="space-y-2">
            <Label>Role</Label>
            <Input value={localStorage.getItem('role') || '-'} disabled />
          </div>

          <div className="space-y-2">
            <Label>Last Login</Label>
            <Input value={localStorage.getItem('last_login') || '-'} disabled />
          </div>

          <div className="space-y-2">
            <Label>Status Akun</Label>
            <Input value="Aktif" disabled />
          </div>
        </div>

        <div className="pt-4 border-t">
          <h3 className="font-semibold mb-4">Ganti Password</h3>
          <div className="grid grid-cols-1 gap-4 max-w-md">
            <div className="space-y-2">
              <Label htmlFor="password_lama">Password Lama</Label>
              <Input id="password_lama" type="password" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password_baru">Password Baru</Label>
              <Input id="password_baru" type="password" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="konfirmasi_password">Konfirmasi Password Baru</Label>
              <Input id="konfirmasi_password" type="password" />
            </div>

            <Button className="w-full">Ganti Password</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Memuat data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Profile EMIS</h1>
        <Button onClick={handleSaveAll} disabled={loading}>
          <Save className="mr-2 h-4 w-4" /> Simpan Semua Perubahan
        </Button>
      </div>

      {renderVervalDraftAlert()}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 md:grid-cols-10 gap-1">
          <TabsTrigger value="data-siswa">Data Siswa</TabsTrigger>
          <TabsTrigger value="data-orangtua">Data Orang Tua</TabsTrigger>
          <TabsTrigger value="data-wali">Data Wali</TabsTrigger>
          <TabsTrigger value="data-alamat">Data Alamat</TabsTrigger>
          <TabsTrigger value="prestasi">Prestasi</TabsTrigger>
          <TabsTrigger value="beasiswa">Beasiswa</TabsTrigger>
          <TabsTrigger value="pendidikan-lain">Pendidikan Lain</TabsTrigger>
          <TabsTrigger value="rekam-didik">Rekam Didik</TabsTrigger>
          <TabsTrigger value="arsip-dokumen">Arsip Dokumen</TabsTrigger>
          <TabsTrigger value="info-akun">Info Akun</TabsTrigger>
        </TabsList>

        <TabsContent value="data-siswa" className="mt-4">
          {renderDataSiswaTab()}
        </TabsContent>

        <TabsContent value="data-orangtua" className="mt-4">
          {renderDataOrangTuaTab()}
        </TabsContent>

        <TabsContent value="data-wali" className="mt-4">
          {renderDataWaliTab()}
        </TabsContent>

        <TabsContent value="data-alamat" className="mt-4">
          {renderDataAlamatTab()}
        </TabsContent>

        <TabsContent value="prestasi" className="mt-4">
          {renderPrestasiTab()}
        </TabsContent>

        <TabsContent value="beasiswa" className="mt-4">
          {renderBeasiswaTab()}
        </TabsContent>

        <TabsContent value="pendidikan-lain" className="mt-4">
          {renderPendidikanLainTab()}
        </TabsContent>

        <TabsContent value="rekam-didik" className="mt-4">
          {renderRekamDidikTab()}
        </TabsContent>

        <TabsContent value="arsip-dokumen" className="mt-4">
          {renderArsipDokumenTab()}
        </TabsContent>

        <TabsContent value="info-akun" className="mt-4">
          {renderInfoAkunTab()}
        </TabsContent>
      </Tabs>
    </div>
  );
}
