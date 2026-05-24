import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft, User, Briefcase, MapPin, Heart, Settings, Award,
  GraduationCap, FileText, Users, FolderOpen, Save, Edit, Upload, Download,
  Calendar, Phone, Mail, CreditCard, Home, CheckCircle, Clock, FileCheck, Plus
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export default function AdminGTKDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [gtk, setGtk] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('data-guru');
  const [activeSubTab, setActiveSubTab] = useState('data-diri');

  // Form states for different tabs
  const [formDataDiri, setFormDataDiri] = useState({});
  const [formKepegawaian, setFormKepegawaian] = useState({});
  const [formInformasiLain, setFormInformasiLain] = useState({});
  const [formTempatTinggal, setFormTempatTinggal] = useState({});
  const [formPerkawinan, setFormPerkawinan] = useState({});
  const [formPenugasan, setFormPenugasan] = useState({});

  // Dialog states
  const [pendidikanDialog, setPendidikanDialog] = useState(false);
  const [diklatDialog, setDiklatDialog] = useState(false);
  const [penghargaanDialog, setPenghargaanDialog] = useState(false);
  const [anakDialog, setAnakDialog] = useState(false);
  const [pesantrenDialog, setPesantrenDialog] = useState(false);
  const [arsipDialog, setArsipDialog] = useState(false);

  const loadGTKData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/users/${id}`);

      // Set all state in one go to prevent multiple re-renders
      setGtk(data);
      setFormDataDiri({
        full_name: data.full_name || '',
        gender: data.gender || '',
        birth_place: data.birth_place || '',
        birth_date: data.birth_date || '',
        nik: data.nik || '',
        nomor_kk: data.nomor_kk || '',
        nama_ibu_kandung: data.nama_ibu_kandung || '',
        agama: data.agama || '',
      });
      setFormKepegawaian({
        status_kepegawaian: data.status_kepegawaian || 'non_asn',
        nuptk: data.nip_nuptk || '',
        nip: data.nip || '',
        jenis_pns: data.jenis_pns || '',
        tmt_pns: data.tmt_pns || '',
        no_sk_pns: data.no_sk_pns || '',
        tanggal_sk_pns: data.tanggal_sk_pns || '',
        file_sk_pns: data.file_sk_pns || '',
      });
      setFormInformasiLain({
        phone: data.phone || '',
        email: data.email || '',
        email_madrasah: data.email_madrasah || '',
        bpjs_kesehatan: data.bpjs_kesehatan || '',
        bpjs_ketenagakerjaan: data.bpjs_ketenagakerjaan || '',
        npwp: data.npwp || '',
        golongan_darah: data.golongan_darah || '',
        nama_rekening: data.nama_rekening || '',
        nomor_rekening: data.nomor_rekening || '',
        bank: data.bank || '',
      });
      setFormTempatTinggal({
        status_tempat_tinggal: data.status_tempat_tinggal || '',
        provinsi: data.provinsi || '',
        kab_kota: data.kab_kota || '',
        kecamatan: data.kecamatan || '',
        kelurahan: data.kelurahan || '',
        rt: data.rt || '',
        rw: data.rw || '',
        kode_pos: data.kode_pos || '',
        jarak_ke_sekolah: data.jarak_ke_sekolah || '',
        transportasi: data.transportasi || '',
        waktu_tempuh: data.waktu_tempuh || '',
        lintang: data.lintang || '',
        bujur: data.bujur || '',
      });
      setFormPerkawinan({
        status_perkawinan: data.status_perkawinan || 'belum_menikah',
        nama_pasangan: data.nama_pasangan || '',
      });
      setFormPenugasan({
        jenis_ptk: data.jenis_ptk || '',
        tmt_pegawai: data.tmt_pegawai || '',
        tmt_guru: data.tmt_guru || '',
        tugas_utama: data.tugas_utama || '',
        tugas_tambahan: data.tugas_tambahan || '',
      });
      setLoading(false);
    } catch (e) {
      toast.error('Gagal memuat data GTK');
      navigate('/admin/gtk');
    }
  }, [id, navigate]);

  useEffect(() => {
    loadGTKData();
  }, [loadGTKData]);

  const handleSave = async () => {
    try {
      const payload = {
        ...formDataDiri,
        ...formKepegawaian,
        ...formInformasiLain,
        ...formTempatTinggal,
        ...formPerkawinan,
        ...formPenugasan,
      };

      await api.put(`/users/${id}`, payload);
      toast.success('Data berhasil disimpan');
      setEditing(false);
      loadGTKData();
    } catch (e) {
      toast.error('Gagal menyimpan data');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-slate-500">Memuat data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/gtk')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
              <User className="h-3 w-3 mr-1" /> Detail GTK
            </Badge>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{gtk?.full_name}</h1>
            <p className="text-sm text-slate-600 mt-1">
              {gtk?.nip_nuptk || 'Belum ada NUPTK'} • {gtk?.roles?.map(r => r.toUpperCase()).join(', ')}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {editing ? (
            <>
              <Button variant="outline" onClick={() => setEditing(false)}>Batal</Button>
              <Button onClick={handleSave} className="bg-[#006837] hover:bg-[#0B7A3B] gap-2">
                <Save className="h-4 w-4" /> Simpan
              </Button>
            </>
          ) : (
            <Button onClick={() => setEditing(true)} className="bg-[#006837] hover:bg-[#0B7A3B] gap-2">
              <Edit className="h-4 w-4" /> Edit Data
            </Button>
          )}
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white border border-slate-200 w-full justify-start overflow-x-auto">
          <TabsTrigger value="data-guru" className="gap-2">
            <User className="h-4 w-4" /> Data Guru
          </TabsTrigger>
          <TabsTrigger value="status-kepegawaian" className="gap-2">
            <Briefcase className="h-4 w-4" /> Status & Riwayat
          </TabsTrigger>
          <TabsTrigger value="pendidikan" className="gap-2">
            <GraduationCap className="h-4 w-4" /> Pendidikan
          </TabsTrigger>
          <TabsTrigger value="diklat" className="gap-2">
            <Award className="h-4 w-4" /> Diklat/Pelatihan
          </TabsTrigger>
          <TabsTrigger value="penghargaan" className="gap-2">
            <Award className="h-4 w-4" /> Penghargaan
          </TabsTrigger>
          <TabsTrigger value="data-anak" className="gap-2">
            <Users className="h-4 w-4" /> Data Anak
          </TabsTrigger>
          <TabsTrigger value="riwayat-pesantren" className="gap-2">
            <FileText className="h-4 w-4" /> Riwayat Pesantren
          </TabsTrigger>
          <TabsTrigger value="arsip-berkas" className="gap-2">
            <FolderOpen className="h-4 w-4" /> Arsip Berkas
          </TabsTrigger>
        </TabsList>

        {/* TAB: DATA GURU */}
        <TabsContent value="data-guru">
          <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
            <TabsList className="bg-slate-50">
              <TabsTrigger value="data-diri">Formulir Data Diri</TabsTrigger>
              <TabsTrigger value="kepegawaian">Kepegawaian</TabsTrigger>
              <TabsTrigger value="informasi-lain">Informasi Lainnya</TabsTrigger>
              <TabsTrigger value="tempat-tinggal">Tempat Tinggal</TabsTrigger>
              <TabsTrigger value="perkawinan">Status Perkawinan</TabsTrigger>
              <TabsTrigger value="penugasan">Penugasan</TabsTrigger>
            </TabsList>

            {/* SUB-TAB: DATA DIRI */}
            <TabsContent value="data-diri">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Formulir Data Diri</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Nama Lengkap *</Label>
                    <Input value={formDataDiri.full_name} onChange={(e) => setFormDataDiri({...formDataDiri, full_name: e.target.value})} disabled={!editing} />
                  </div>
                  <div>
                    <Label>Jenis Kelamin *</Label>
                    <Select value={formDataDiri.gender} onValueChange={(v) => setFormDataDiri({...formDataDiri, gender: v})} disabled={!editing}>
                      <SelectTrigger><SelectValue placeholder="Pilih..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="L">Laki-laki</SelectItem>
                        <SelectItem value="P">Perempuan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Tempat Lahir</Label>
                    <Input value={formDataDiri.birth_place} onChange={(e) => setFormDataDiri({...formDataDiri, birth_place: e.target.value})} disabled={!editing} />
                  </div>
                  <div>
                    <Label>Tanggal Lahir</Label>
                    <Input type="date" value={formDataDiri.birth_date} onChange={(e) => setFormDataDiri({...formDataDiri, birth_date: e.target.value})} disabled={!editing} />
                  </div>
                  <div>
                    <Label>NIK</Label>
                    <Input value={formDataDiri.nik} onChange={(e) => setFormDataDiri({...formDataDiri, nik: e.target.value})} disabled={!editing} placeholder="16 digit" />
                  </div>
                  <div>
                    <Label>Nomor KK</Label>
                    <Input value={formDataDiri.nomor_kk} onChange={(e) => setFormDataDiri({...formDataDiri, nomor_kk: e.target.value})} disabled={!editing} placeholder="16 digit" />
                  </div>
                  <div>
                    <Label>Nama Ibu Kandung</Label>
                    <Input value={formDataDiri.nama_ibu_kandung} onChange={(e) => setFormDataDiri({...formDataDiri, nama_ibu_kandung: e.target.value})} disabled={!editing} />
                  </div>
                  <div>
                    <Label>Agama</Label>
                    <Select value={formDataDiri.agama} onValueChange={(v) => setFormDataDiri({...formDataDiri, agama: v})} disabled={!editing}>
                      <SelectTrigger><SelectValue placeholder="Pilih..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="islam">Islam</SelectItem>
                        <SelectItem value="kristen">Kristen</SelectItem>
                        <SelectItem value="katolik">Katolik</SelectItem>
                        <SelectItem value="hindu">Hindu</SelectItem>
                        <SelectItem value="buddha">Buddha</SelectItem>
                        <SelectItem value="konghucu">Konghucu</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* SUB-TAB: KEPEGAWAIAN */}
            <TabsContent value="kepegawaian">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Data Kepegawaian</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Status Kepegawaian *</Label>
                    <Select value={formKepegawaian.status_kepegawaian} onValueChange={(v) => setFormKepegawaian({...formKepegawaian, status_kepegawaian: v})} disabled={!editing}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pns">PNS</SelectItem>
                        <SelectItem value="pppk">PPPK</SelectItem>
                        <SelectItem value="non_asn">Non ASN</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>NUPTK</Label>
                    <Input value={formKepegawaian.nuptk} onChange={(e) => setFormKepegawaian({...formKepegawaian, nuptk: e.target.value})} disabled={!editing} />
                  </div>
                  <div>
                    <Label>NIP</Label>
                    <Input value={formKepegawaian.nip} onChange={(e) => setFormKepegawaian({...formKepegawaian, nip: e.target.value})} disabled={!editing} />
                  </div>
                  <div>
                    <Label>Jenis PNS</Label>
                    <Select value={formKepegawaian.jenis_pns} onValueChange={(v) => setFormKepegawaian({...formKepegawaian, jenis_pns: v})} disabled={!editing || formKepegawaian.status_kepegawaian !== 'pns'}>
                      <SelectTrigger><SelectValue placeholder="Pilih..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pusat">PNS Pusat</SelectItem>
                        <SelectItem value="daerah">PNS Daerah</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>TMT PNS</Label>
                    <Input type="date" value={formKepegawaian.tmt_pns} onChange={(e) => setFormKepegawaian({...formKepegawaian, tmt_pns: e.target.value})} disabled={!editing} />
                  </div>
                  <div>
                    <Label>No SK PNS</Label>
                    <Input value={formKepegawaian.no_sk_pns} onChange={(e) => setFormKepegawaian({...formKepegawaian, no_sk_pns: e.target.value})} disabled={!editing} />
                  </div>
                  <div>
                    <Label>Tanggal SK</Label>
                    <Input type="date" value={formKepegawaian.tanggal_sk_pns} onChange={(e) => setFormKepegawaian({...formKepegawaian, tanggal_sk_pns: e.target.value})} disabled={!editing} />
                  </div>
                  <div>
                    <Label>File SK</Label>
                    <div className="flex gap-2">
                      <Input type="file" disabled={!editing} />
                      {formKepegawaian.file_sk_pns && (
                        <Button size="sm" variant="outline"><Download className="h-4 w-4" /></Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* SUB-TAB: INFORMASI LAINNYA */}
            <TabsContent value="informasi-lain">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Informasi Lainnya</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Nomor HP</Label>
                    <Input value={formInformasiLain.phone} onChange={(e) => setFormInformasiLain({...formInformasiLain, phone: e.target.value})} disabled={!editing} />
                  </div>
                  <div>
                    <Label>Email Pribadi</Label>
                    <Input type="email" value={formInformasiLain.email} onChange={(e) => setFormInformasiLain({...formInformasiLain, email: e.target.value})} disabled={!editing} />
                  </div>
                  <div>
                    <Label>Email Madrasah Hebat</Label>
                    <Input type="email" value={formInformasiLain.email_madrasah} onChange={(e) => setFormInformasiLain({...formInformasiLain, email_madrasah: e.target.value})} disabled={!editing} />
                  </div>
                  <div>
                    <Label>BPJS Kesehatan</Label>
                    <Input value={formInformasiLain.bpjs_kesehatan} onChange={(e) => setFormInformasiLain({...formInformasiLain, bpjs_kesehatan: e.target.value})} disabled={!editing} />
                  </div>
                  <div>
                    <Label>BPJS Ketenagakerjaan</Label>
                    <Input value={formInformasiLain.bpjs_ketenagakerjaan} onChange={(e) => setFormInformasiLain({...formInformasiLain, bpjs_ketenagakerjaan: e.target.value})} disabled={!editing} />
                  </div>
                  <div>
                    <Label>NPWP</Label>
                    <Input value={formInformasiLain.npwp} onChange={(e) => setFormInformasiLain({...formInformasiLain, npwp: e.target.value})} disabled={!editing} placeholder="15 digit" />
                  </div>
                  <div>
                    <Label>Golongan Darah</Label>
                    <Select value={formInformasiLain.golongan_darah} onValueChange={(v) => setFormInformasiLain({...formInformasiLain, golongan_darah: v})} disabled={!editing}>
                      <SelectTrigger><SelectValue placeholder="Pilih..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A">A</SelectItem>
                        <SelectItem value="B">B</SelectItem>
                        <SelectItem value="AB">AB</SelectItem>
                        <SelectItem value="O">O</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Nama Pemilik Rekening</Label>
                    <Input value={formInformasiLain.nama_rekening} onChange={(e) => setFormInformasiLain({...formInformasiLain, nama_rekening: e.target.value})} disabled={!editing} />
                  </div>
                  <div>
                    <Label>Nomor Rekening</Label>
                    <Input value={formInformasiLain.nomor_rekening} onChange={(e) => setFormInformasiLain({...formInformasiLain, nomor_rekening: e.target.value})} disabled={!editing} />
                  </div>
                  <div>
                    <Label>Bank</Label>
                    <Input value={formInformasiLain.bank} onChange={(e) => setFormInformasiLain({...formInformasiLain, bank: e.target.value})} disabled={!editing} placeholder="BRI, BNI, Mandiri, dll" />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* SUB-TAB: TEMPAT TINGGAL */}
            <TabsContent value="tempat-tinggal">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Informasi Tempat Tinggal</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Status Tempat Tinggal</Label>
                    <Select value={formTempatTinggal.status_tempat_tinggal} onValueChange={(v) => setFormTempatTinggal({...formTempatTinggal, status_tempat_tinggal: v})} disabled={!editing}>
                      <SelectTrigger><SelectValue placeholder="Pilih..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="milik_sendiri">Milik Sendiri</SelectItem>
                        <SelectItem value="sewa">Sewa/Kontrak</SelectItem>
                        <SelectItem value="menumpang">Menumpang</SelectItem>
                        <SelectItem value="dinas">Rumah Dinas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Provinsi</Label>
                    <Input value={formTempatTinggal.provinsi} onChange={(e) => setFormTempatTinggal({...formTempatTinggal, provinsi: e.target.value})} disabled={!editing} />
                  </div>
                  <div>
                    <Label>Kabupaten/Kota</Label>
                    <Input value={formTempatTinggal.kab_kota} onChange={(e) => setFormTempatTinggal({...formTempatTinggal, kab_kota: e.target.value})} disabled={!editing} />
                  </div>
                  <div>
                    <Label>Kecamatan</Label>
                    <Input value={formTempatTinggal.kecamatan} onChange={(e) => setFormTempatTinggal({...formTempatTinggal, kecamatan: e.target.value})} disabled={!editing} />
                  </div>
                  <div>
                    <Label>Kelurahan/Desa</Label>
                    <Input value={formTempatTinggal.kelurahan} onChange={(e) => setFormTempatTinggal({...formTempatTinggal, kelurahan: e.target.value})} disabled={!editing} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>RT</Label>
                      <Input value={formTempatTinggal.rt} onChange={(e) => setFormTempatTinggal({...formTempatTinggal, rt: e.target.value})} disabled={!editing} />
                    </div>
                    <div>
                      <Label>RW</Label>
                      <Input value={formTempatTinggal.rw} onChange={(e) => setFormTempatTinggal({...formTempatTinggal, rw: e.target.value})} disabled={!editing} />
                    </div>
                  </div>
                  <div>
                    <Label>Kode Pos</Label>
                    <Input value={formTempatTinggal.kode_pos} onChange={(e) => setFormTempatTinggal({...formTempatTinggal, kode_pos: e.target.value})} disabled={!editing} />
                  </div>
                  <div>
                    <Label>Jarak ke Sekolah (km)</Label>
                    <Input type="number" value={formTempatTinggal.jarak_ke_sekolah} onChange={(e) => setFormTempatTinggal({...formTempatTinggal, jarak_ke_sekolah: e.target.value})} disabled={!editing} />
                  </div>
                  <div>
                    <Label>Transportasi ke Sekolah</Label>
                    <Select value={formTempatTinggal.transportasi} onValueChange={(v) => setFormTempatTinggal({...formTempatTinggal, transportasi: v})} disabled={!editing}>
                      <SelectTrigger><SelectValue placeholder="Pilih..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="jalan_kaki">Jalan Kaki</SelectItem>
                        <SelectItem value="sepeda">Sepeda</SelectItem>
                        <SelectItem value="motor">Sepeda Motor</SelectItem>
                        <SelectItem value="mobil">Mobil Pribadi</SelectItem>
                        <SelectItem value="angkutan_umum">Angkutan Umum</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Waktu Tempuh (menit)</Label>
                    <Input type="number" value={formTempatTinggal.waktu_tempuh} onChange={(e) => setFormTempatTinggal({...formTempatTinggal, waktu_tempuh: e.target.value})} disabled={!editing} />
                  </div>
                  <div>
                    <Label>Koordinat Lintang</Label>
                    <Input value={formTempatTinggal.lintang} onChange={(e) => setFormTempatTinggal({...formTempatTinggal, lintang: e.target.value})} disabled={!editing} placeholder="-6.200000" />
                  </div>
                  <div>
                    <Label>Koordinat Bujur</Label>
                    <Input value={formTempatTinggal.bujur} onChange={(e) => setFormTempatTinggal({...formTempatTinggal, bujur: e.target.value})} disabled={!editing} placeholder="106.816666" />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* SUB-TAB: STATUS PERKAWINAN */}
            <TabsContent value="perkawinan">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Status Perkawinan</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Status Perkawinan</Label>
                    <Select value={formPerkawinan.status_perkawinan} onValueChange={(v) => setFormPerkawinan({...formPerkawinan, status_perkawinan: v})} disabled={!editing}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="belum_menikah">Belum Menikah</SelectItem>
                        <SelectItem value="menikah">Menikah</SelectItem>
                        <SelectItem value="duda">Duda</SelectItem>
                        <SelectItem value="janda">Janda</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Nama Suami/Istri</Label>
                    <Input value={formPerkawinan.nama_pasangan} onChange={(e) => setFormPerkawinan({...formPerkawinan, nama_pasangan: e.target.value})} disabled={!editing || formPerkawinan.status_perkawinan === 'belum_menikah'} />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* SUB-TAB: PENUGASAN */}
            <TabsContent value="penugasan">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Data Penugasan</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Jenis PTK</Label>
                    <Select value={formPenugasan.jenis_ptk} onValueChange={(v) => setFormPenugasan({...formPenugasan, jenis_ptk: v})} disabled={!editing}>
                      <SelectTrigger><SelectValue placeholder="Pilih..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="guru_mapel">Guru Mata Pelajaran</SelectItem>
                        <SelectItem value="guru_bk">Guru BK</SelectItem>
                        <SelectItem value="kepala_sekolah">Kepala Sekolah</SelectItem>
                        <SelectItem value="tenaga_administrasi">Tenaga Administrasi</SelectItem>
                        <SelectItem value="pustakawan">Pustakawan</SelectItem>
                        <SelectItem value="laboran">Laboran</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>TMT Pegawai</Label>
                    <Input type="date" value={formPenugasan.tmt_pegawai} onChange={(e) => setFormPenugasan({...formPenugasan, tmt_pegawai: e.target.value})} disabled={!editing} />
                  </div>
                  <div>
                    <Label>TMT Guru/Tanggal SK PTK</Label>
                    <Input type="date" value={formPenugasan.tmt_guru} onChange={(e) => setFormPenugasan({...formPenugasan, tmt_guru: e.target.value})} disabled={!editing} />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Tugas Utama</Label>
                    <Textarea value={formPenugasan.tugas_utama} onChange={(e) => setFormPenugasan({...formPenugasan, tugas_utama: e.target.value})} disabled={!editing} rows={2} />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Tugas Tambahan</Label>
                    <Textarea value={formPenugasan.tugas_tambahan} onChange={(e) => setFormPenugasan({...formPenugasan, tugas_tambahan: e.target.value})} disabled={!editing} rows={2} />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* TAB: STATUS DAN RIWAYAT KEPEGAWAIAN */}
        <TabsContent value="status-kepegawaian">
          <Card>
            <CardHeader>
              <CardTitle>Status dan Riwayat Kepegawaian</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Fungsi/Jabatan</Label>
                  <Input placeholder="Contoh: Wali Kelas, Wakasek" disabled={!editing} />
                </div>
                <div>
                  <Label>Status Penugasan</Label>
                  <Select disabled={!editing}>
                    <SelectTrigger><SelectValue placeholder="Pilih..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aktif">Aktif</SelectItem>
                      <SelectItem value="cuti">Cuti</SelectItem>
                      <SelectItem value="tugas_belajar">Tugas Belajar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Pangkat Jabatan</Label>
                  <Input placeholder="Contoh: Penata Muda, III/a" disabled={!editing} />
                </div>
                <div>
                  <Label>Status Keaktifan</Label>
                  <Select disabled={!editing}>
                    <SelectTrigger><SelectValue placeholder="Pilih..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aktif">Aktif</SelectItem>
                      <SelectItem value="non_aktif">Non Aktif</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-semibold mb-2">Perjanjian SK</h4>
                <div className="text-sm text-slate-500">Fitur dalam pengembangan</div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-semibold mb-2">Data Pensiun</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Tanggal Pensiun</Label>
                    <Input type="date" disabled={!editing} />
                  </div>
                  <div>
                    <Label>Nomor SK Pensiun</Label>
                    <Input disabled={!editing} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: PENDIDIKAN FORMAL */}
        <TabsContent value="pendidikan">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Riwayat Pendidikan Formal</CardTitle>
              <Button onClick={() => setPendidikanDialog(true)} size="sm" className="bg-[#006837] hover:bg-[#0B7A3B]">
                <Plus className="h-4 w-4 mr-1" /> Tambah
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Jenjang</TableHead>
                    <TableHead>Nama Institusi</TableHead>
                    <TableHead>Jurusan</TableHead>
                    <TableHead>Tahun Lulus</TableHead>
                    <TableHead>No. Ijazah</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                      Belum ada data pendidikan. Klik "Tambah" untuk menambah data.
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: DIKLAT/PELATIHAN */}
        <TabsContent value="diklat">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Riwayat Diklat/Pelatihan</CardTitle>
              <Button onClick={() => setDiklatDialog(true)} size="sm" className="bg-[#006837] hover:bg-[#0B7A3B]">
                <Plus className="h-4 w-4 mr-1" /> Tambah
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Diklat/Pelatihan</TableHead>
                    <TableHead>Penyelenggara</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Durasi (Jam)</TableHead>
                    <TableHead>No. Sertifikat</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                      Belum ada data diklat. Klik "Tambah" untuk menambah data.
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: PENGHARGAAN */}
        <TabsContent value="penghargaan">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Riwayat Penghargaan</CardTitle>
              <Button onClick={() => setPenghargaanDialog(true)} size="sm" className="bg-[#006837] hover:bg-[#0B7A3B]">
                <Plus className="h-4 w-4 mr-1" /> Tambah
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Jenis Penghargaan</TableHead>
                    <TableHead>Nama Penghargaan</TableHead>
                    <TableHead>Pemberi</TableHead>
                    <TableHead>Tahun</TableHead>
                    <TableHead>Tingkat</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                      Belum ada data penghargaan. Klik "Tambah" untuk menambah data.
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: DATA ANAK */}
        <TabsContent value="data-anak">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Data Anak</CardTitle>
              <Button onClick={() => setAnakDialog(true)} size="sm" className="bg-[#006837] hover:bg-[#0B7A3B]">
                <Plus className="h-4 w-4 mr-1" /> Tambah
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Lengkap</TableHead>
                    <TableHead>Jenis Kelamin</TableHead>
                    <TableHead>Tempat, Tanggal Lahir</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                      Belum ada data anak. Klik "Tambah" untuk menambah data.
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: RIWAYAT PESANTREN */}
        <TabsContent value="riwayat-pesantren">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Riwayat Pesantren</CardTitle>
              <Button onClick={() => setPesantrenDialog(true)} size="sm" className="bg-[#006837] hover:bg-[#0B7A3B]">
                <Plus className="h-4 w-4 mr-1" /> Tambah
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Pesantren</TableHead>
                    <TableHead>Lokasi</TableHead>
                    <TableHead>Periode</TableHead>
                    <TableHead>Keterangan</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                      Belum ada data riwayat pesantren. Klik "Tambah" untuk menambah data.
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: ARSIP BERKAS */}
        <TabsContent value="arsip-berkas">
          <Card>
            <CardHeader>
              <CardTitle>Arsip Berkas</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: 'KTP', key: 'ktp' },
                { label: 'Kartu Keluarga (KK)', key: 'kk' },
                { label: 'Ijazah', key: 'ijazah' },
                { label: 'NPWP', key: 'npwp' },
                { label: 'Absensi', key: 'absensi' },
                { label: 'SKBK/SKMT', key: 'skbk' },
                { label: 'SKAKPT', key: 'skakpt' },
                { label: 'Tunjangan Non ASN', key: 'tunjangan' },
              ].map((doc) => (
                <div key={doc.key} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <FileCheck className="h-5 w-5 text-slate-500" />
                      <span className="font-medium">{doc.label}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">Belum upload</Badge>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="outline" className="flex-1" disabled={!editing}>
                      <Upload className="h-3 w-3 mr-1" /> Upload
                    </Button>
                    <Button size="sm" variant="outline" disabled>
                      <Download className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
