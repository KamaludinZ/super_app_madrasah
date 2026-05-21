import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserCircle, Mail, Phone, MapPin, Calendar, Save, X, User, FileText, GraduationCap, Briefcase, Shield } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { VervalDraftAlert, saveVervalDraft, clearVervalDraft } from '@/components/verval/VervalDraftAlert';

export default function ProfilePage() {
  const { user, refreshMe } = useAuth();
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('personal');
  const [formData, setFormData] = useState({
    // Personal data
    full_name: '',
    email: '',
    phone: '',
    address: '',
    gender: '',
    birth_place: '',
    birth_date: '',

    // Siswa specific
    nisn: '',
    nis: '',
    parent_name: '',
    parent_phone: '',

    // GTK specific
    nip_nuptk: '',
    employee_status: '',
    education_level: '',
    major: '',
    certification: '',
  });
  const [originalData, setOriginalData] = useState({});
  const [hasChanges, setHasChanges] = useState(false);
  const [vervalKey, setVervalKey] = useState(0);

  useEffect(() => {
    if (user) {
      const initial = {
        full_name: user.full_name || '',
        email: user.email || '',
        phone: user.phone || '',
        address: user.address || '',
        gender: user.gender || '',
        birth_place: user.birth_place || '',
        birth_date: user.birth_date || '',
        nisn: user.nisn || '',
        nis: user.nis || '',
        parent_name: user.parent_name || '',
        parent_phone: user.parent_phone || '',
        nip_nuptk: user.nip_nuptk || '',
        employee_status: user.employee_status || '',
        education_level: user.education_level || '',
        major: user.major || '',
        certification: user.certification || '',
      };
      setFormData(initial);
      setOriginalData(initial);
    }
  }, [user]);

  const handleChange = (field, value) => {
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);

    const changed = Object.keys(newFormData).some(key => newFormData[key] !== originalData[key]);
    setHasChanges(changed);

    if (changed && user) {
      const changedFields = {};
      Object.keys(newFormData).forEach(key => {
        if (newFormData[key] !== originalData[key]) {
          changedFields[key] = newFormData[key];
        }
      });
      saveVervalDraft(user.id, changedFields);
      setVervalKey(prev => prev + 1);
    } else if (!changed && user) {
      clearVervalDraft(user.id);
      setVervalKey(prev => prev + 1);
    }
  };

  const handleCancel = () => {
    setFormData(originalData);
    setEditing(false);
    setHasChanges(false);
    if (user) {
      clearVervalDraft(user.id);
      setVervalKey(prev => prev + 1);
    }
  };

  const handleSave = () => {
    if (hasChanges && user) {
      const changedFields = {};
      Object.keys(formData).forEach(key => {
        if (formData[key] !== originalData[key]) {
          changedFields[key] = formData[key];
        }
      });
      saveVervalDraft(user.id, changedFields);
      toast.success('Perubahan disimpan sebagai draft. Gunakan tombol "Ajukan Verval" untuk mengajukan ke admin.');
      setEditing(false);
      setVervalKey(prev => prev + 1);
    }
  };

  const handleVervalRefresh = () => {
    refreshMe?.();
    setVervalKey(prev => prev + 1);
    setEditing(false);
    setHasChanges(false);
  };

  const getUserType = () => {
    if (!user?.roles) return 'siswa';
    if (user.roles.includes('siswa')) return 'siswa';
    if (user.roles.includes('guru')) return 'guru';
    if (user.roles.includes('tenaga_kependidikan')) return 'tenaga_kependidikan';
    return 'siswa';
  };

  const isSiswa = user?.roles?.includes('siswa');
  const isGTK = user?.roles?.includes('guru') || user?.roles?.includes('tenaga_kependidikan');
  const isAdmin = user?.roles?.includes('admin');

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <UserCircle className="h-3 w-3 mr-1" /> Profil Saya
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold">Data Profil</h1>
          <p className="text-sm text-slate-600 mt-1">
            Kelola informasi profil Anda
          </p>
        </div>
        {!editing ? (
          <Button onClick={() => setEditing(true)} variant="outline" size="sm">
            Edit Profil
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button onClick={handleCancel} variant="outline" size="sm">
              <X className="h-4 w-4 mr-1" /> Batal
            </Button>
            <Button onClick={handleSave} size="sm" disabled={!hasChanges}>
              <Save className="h-4 w-4 mr-1" /> Simpan Draft
            </Button>
          </div>
        )}
      </div>

      {/* Verval Draft Alert */}
      <VervalDraftAlert
        key={vervalKey}
        userId={user?.id}
        userType={getUserType()}
        onRefresh={handleVervalRefresh}
      />

      {/* Tabs Card */}
      <Card>
        <CardContent className="p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 mb-6">
              <TabsTrigger value="personal" className="gap-2">
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">Data Pribadi</span>
                <span className="sm:hidden">Pribadi</span>
              </TabsTrigger>

              <TabsTrigger value="contact" className="gap-2">
                <Phone className="h-4 w-4" />
                <span className="hidden sm:inline">Kontak</span>
                <span className="sm:hidden">Kontak</span>
              </TabsTrigger>

              {isSiswa && (
                <TabsTrigger value="student" className="gap-2">
                  <GraduationCap className="h-4 w-4" />
                  <span className="hidden sm:inline">Data Siswa</span>
                  <span className="sm:hidden">Siswa</span>
                </TabsTrigger>
              )}

              {isGTK && (
                <TabsTrigger value="employee" className="gap-2">
                  <Briefcase className="h-4 w-4" />
                  <span className="hidden sm:inline">Data Kepegawaian</span>
                  <span className="sm:hidden">Pegawai</span>
                </TabsTrigger>
              )}

              <TabsTrigger value="account" className="gap-2">
                <Shield className="h-4 w-4" />
                <span className="hidden sm:inline">Akun</span>
                <span className="sm:hidden">Akun</span>
              </TabsTrigger>
            </TabsList>

            {/* Tab: Data Pribadi */}
            <TabsContent value="personal" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-slate-600">Nama Lengkap *</Label>
                  <Input
                    value={formData.full_name}
                    onChange={(e) => handleChange('full_name', e.target.value)}
                    disabled={!editing}
                    placeholder="Masukkan nama lengkap"
                    className={editing ? '' : 'bg-slate-50'}
                  />
                </div>

                <div>
                  <Label className="text-xs text-slate-600">Jenis Kelamin</Label>
                  <Select
                    value={formData.gender}
                    onValueChange={(value) => handleChange('gender', value)}
                    disabled={!editing}
                  >
                    <SelectTrigger className={editing ? '' : 'bg-slate-50'}>
                      <SelectValue placeholder="Pilih jenis kelamin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="L">Laki-laki</SelectItem>
                      <SelectItem value="P">Perempuan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs text-slate-600">Tempat Lahir</Label>
                  <Input
                    value={formData.birth_place}
                    onChange={(e) => handleChange('birth_place', e.target.value)}
                    disabled={!editing}
                    placeholder="Kota/Kabupaten"
                    className={editing ? '' : 'bg-slate-50'}
                  />
                </div>

                <div>
                  <Label className="text-xs text-slate-600">Tanggal Lahir</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      type="date"
                      value={formData.birth_date}
                      onChange={(e) => handleChange('birth_date', e.target.value)}
                      disabled={!editing}
                      className={`pl-10 ${editing ? '' : 'bg-slate-50'}`}
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-xs text-slate-600">Alamat Lengkap</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Textarea
                    value={formData.address}
                    onChange={(e) => handleChange('address', e.target.value)}
                    disabled={!editing}
                    placeholder="Alamat lengkap tempat tinggal"
                    rows={3}
                    className={`pl-10 ${editing ? '' : 'bg-slate-50'}`}
                  />
                </div>
              </div>
            </TabsContent>

            {/* Tab: Kontak */}
            <TabsContent value="contact" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-slate-600">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      disabled={!editing}
                      placeholder="email@example.com"
                      className={`pl-10 ${editing ? '' : 'bg-slate-50'}`}
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-slate-600">Nomor Telepon</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      value={formData.phone}
                      onChange={(e) => handleChange('phone', e.target.value)}
                      disabled={!editing}
                      placeholder="08xxxxxxxxxx"
                      className={`pl-10 ${editing ? '' : 'bg-slate-50'}`}
                    />
                  </div>
                </div>

                {isSiswa && (
                  <>
                    <div>
                      <Label className="text-xs text-slate-600">Nama Orang Tua/Wali</Label>
                      <Input
                        value={formData.parent_name}
                        onChange={(e) => handleChange('parent_name', e.target.value)}
                        disabled={!editing}
                        placeholder="Nama orang tua/wali"
                        className={editing ? '' : 'bg-slate-50'}
                      />
                    </div>

                    <div>
                      <Label className="text-xs text-slate-600">Nomor Telepon Orang Tua/Wali</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          value={formData.parent_phone}
                          onChange={(e) => handleChange('parent_phone', e.target.value)}
                          disabled={!editing}
                          placeholder="08xxxxxxxxxx"
                          className={`pl-10 ${editing ? '' : 'bg-slate-50'}`}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </TabsContent>

            {/* Tab: Data Siswa */}
            {isSiswa && (
              <TabsContent value="student" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-slate-600">NISN</Label>
                    <Input
                      value={formData.nisn}
                      onChange={(e) => handleChange('nisn', e.target.value)}
                      disabled={!editing}
                      placeholder="Nomor Induk Siswa Nasional"
                      className={editing ? '' : 'bg-slate-50'}
                    />
                    <p className="text-xs text-slate-500 mt-1">Nomor Induk Siswa Nasional</p>
                  </div>

                  <div>
                    <Label className="text-xs text-slate-600">NIS</Label>
                    <Input
                      value={formData.nis}
                      onChange={(e) => handleChange('nis', e.target.value)}
                      disabled={!editing}
                      placeholder="Nomor Induk Siswa"
                      className={editing ? '' : 'bg-slate-50'}
                    />
                    <p className="text-xs text-slate-500 mt-1">Nomor Induk Siswa Sekolah</p>
                  </div>

                  {user?.class_name && (
                    <div className="md:col-span-2">
                      <Label className="text-xs text-slate-600">Kelas Saat Ini</Label>
                      <div className="bg-slate-50 border rounded-lg p-3">
                        <Badge className="bg-blue-100 text-blue-800">{user.class_name}</Badge>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            )}

            {/* Tab: Data Kepegawaian (GTK) */}
            {isGTK && (
              <TabsContent value="employee" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-slate-600">NIP/NUPTK</Label>
                    <Input
                      value={formData.nip_nuptk}
                      onChange={(e) => handleChange('nip_nuptk', e.target.value)}
                      disabled={!editing}
                      placeholder="Nomor Induk Pegawai / NUPTK"
                      className={editing ? '' : 'bg-slate-50'}
                    />
                    <p className="text-xs text-slate-500 mt-1">Nomor Induk Pegawai atau NUPTK</p>
                  </div>

                  <div>
                    <Label className="text-xs text-slate-600">Status Kepegawaian</Label>
                    <Select
                      value={formData.employee_status}
                      onValueChange={(value) => handleChange('employee_status', value)}
                      disabled={!editing}
                    >
                      <SelectTrigger className={editing ? '' : 'bg-slate-50'}>
                        <SelectValue placeholder="Pilih status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PNS">PNS</SelectItem>
                        <SelectItem value="PPPK">PPPK</SelectItem>
                        <SelectItem value="GTT">GTT (Guru Tidak Tetap)</SelectItem>
                        <SelectItem value="GTY">GTY (Guru Tetap Yayasan)</SelectItem>
                        <SelectItem value="Honorer">Honorer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs text-slate-600">Pendidikan Terakhir</Label>
                    <Select
                      value={formData.education_level}
                      onValueChange={(value) => handleChange('education_level', value)}
                      disabled={!editing}
                    >
                      <SelectTrigger className={editing ? '' : 'bg-slate-50'}>
                        <SelectValue placeholder="Pilih pendidikan" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="D3">D3 (Diploma)</SelectItem>
                        <SelectItem value="S1">S1 (Sarjana)</SelectItem>
                        <SelectItem value="S2">S2 (Magister)</SelectItem>
                        <SelectItem value="S3">S3 (Doktor)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs text-slate-600">Jurusan/Program Studi</Label>
                    <Input
                      value={formData.major}
                      onChange={(e) => handleChange('major', e.target.value)}
                      disabled={!editing}
                      placeholder="Contoh: Pendidikan Matematika"
                      className={editing ? '' : 'bg-slate-50'}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label className="text-xs text-slate-600">Sertifikasi Pendidik</Label>
                    <Input
                      value={formData.certification}
                      onChange={(e) => handleChange('certification', e.target.value)}
                      disabled={!editing}
                      placeholder="Nomor sertifikat pendidik (jika ada)"
                      className={editing ? '' : 'bg-slate-50'}
                    />
                    <p className="text-xs text-slate-500 mt-1">Kosongkan jika belum memiliki sertifikat</p>
                  </div>
                </div>
              </TabsContent>
            )}

            {/* Tab: Akun */}
            <TabsContent value="account" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-slate-600">Username</Label>
                  <Input
                    value={user?.username || ''}
                    disabled
                    className="bg-slate-50"
                  />
                  <p className="text-xs text-slate-500 mt-1">Username tidak dapat diubah</p>
                </div>

                <div>
                  <Label className="text-xs text-slate-600">Status Akun</Label>
                  <div className="bg-slate-50 border rounded-lg p-3">
                    <Badge className="bg-emerald-100 text-emerald-800">
                      Aktif
                    </Badge>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <Label className="text-xs text-slate-600">Peran (Role)</Label>
                  <div className="flex gap-2 flex-wrap">
                    {(user?.roles || []).map(role => (
                      <Badge key={role} variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        {role}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {editing && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900 mt-6">
              <p className="font-semibold mb-1">ℹ️ Informasi Penting</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Perubahan data akan disimpan sebagai <strong>draft</strong> terlebih dahulu</li>
                <li>Gunakan tombol <strong>"Ajukan Verval"</strong> di atas untuk mengirim ke admin</li>
                <li>Perubahan data baru akan aktif setelah <strong>disetujui admin</strong></li>
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
