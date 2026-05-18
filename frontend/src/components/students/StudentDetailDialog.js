import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  User, Users, MapPin, Save, Loader2, Heart, Phone, Mail,
  Calendar, Hash, Globe, FileText, GraduationCap, Pencil, Eye, History,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';

const AGAMA_OPTIONS = ['Islam', 'Kristen Protestan', 'Katolik', 'Hindu', 'Buddha', 'Kong hu cu'];
const CITA_CITA_OPTIONS = ['PNS', 'TNI/Polri', 'Guru/Dosen', 'Dokter', 'Politikus', 'Wiraswasta', 'Seniman/Artis', 'Ilmuwan', 'Agamawan', 'Lainnya'];
const HOBI_OPTIONS = ['Olahraga', 'Kesenian', 'Membaca', 'Menulis', 'Jalan-jalan', 'Lainnya'];
const PEMBIAYA_OPTIONS = ['Orang Tua', 'Wali/Orang Tua Asuh', 'Tanggungan Sendiri', 'Lainnya'];
const PRA_SEKOLAH_OPTIONS = ['Pernah TK/RA', 'Pernah PAUD'];
const IMUNISASI_OPTIONS = ['Hepatitis B', 'BCG', 'DPT', 'Polio', 'Campak', 'Covid'];
const PENDIDIKAN_OPTIONS = ['SD/Sederajat', 'SMP/Sederajat', 'SMA/Sederajat', 'D1', 'D2', 'D3', 'D4/S1', 'S2', 'S3', 'Tidak Sekolah', 'Lainnya'];
const PEKERJAAN_OPTIONS = ['Tidak Bekerja', 'Pensiunan', 'PNS', 'TNI/Polri', 'Guru/Dosen', 'Pegawai Swasta', 'Wiraswasta', 'Pengacara/Jaksa/Hakim/Notaris', 'Seniman/Pelukis/Artis/Sejenis', 'Dokter/Bidan/Perawat', 'Pilot/Pramugara', 'Pedagang', 'Petani/Peternak', 'Nelayan', 'Buruh (Tani/Pabrik/Bangunan)', 'Sopir/Masinis/Kondektur/Tukang Ojek', 'Politikus', 'Lainnya'];
const PENGHASILAN_OPTIONS = ['Di bawah 800.000', '800.001-1.200.000', '1.200.001-1.800.000', '1.800.001-2.500.000', '2.500.001-3.500.000', '3.500.001-4.800.000', '4.800.001-6.500.000', '6.500.001-10.000.000', '10.000.001-20.000.000', 'Lebih dari 20.000.000'];
const STATUS_RUMAH = ['Milik Sendiri', 'Rumah Orang Tua', 'Rumah Saudara/Kerabat', 'Rumah Dinas', 'Sewa/Kontrak', 'Lainnya'];
const STATUS_HIDUP = ['Masih Hidup', 'Sudah Meninggal', 'Tidak Diketahui'];

const EMPTY_PARENT = {
  nama: '', status: 'Masih Hidup', citizenship: 'WNI', nik: '', asal_negara: '', nomor_izin_tinggal: '',
  tempat_lahir: '', tgl_lahir: '', pendidikan: '', pekerjaan: '', penghasilan: '',
  no_hp_unavailable: false, no_hp: '',
};

const EMPTY_ADDR = {
  tinggal_luar_negeri: false, status_kepemilikan: '', alamat: '',
  provinsi: '', kabupaten: '', kecamatan: '', kelurahan: '',
  rt: '', rw: '', kode_pos: '',
};

const EMPTY_DETAIL = {
  citizenship: 'WNI', nik: '', asal_negara: '', nomor_izin_tinggal: '',
  jumlah_saudara: '', anak_ke: '', agama: '', cita_cita: '', hobi: '',
  no_hp_unavailable: false, pembiaya_sekolah: '',
  pra_sekolah: [], imunisasi: [], nomor_kip: '', nomor_kk: '', nama_kepala_keluarga: '',
  ayah: { ...EMPTY_PARENT },
  ibu: { ...EMPTY_PARENT },
  wali: { ...EMPTY_PARENT, hubungan_wali: 'Lainnya', nomor_kks: '', nomor_pkh: '' },
  alamat_ayah: { ...EMPTY_ADDR },
  alamat_ibu: { ...EMPTY_ADDR, sama_dengan_ayah: false },
  alamat_wali: { ...EMPTY_ADDR, sama_dengan_ayah: false, status_wali: 'Lainnya' },
  alamat_siswa: { ...EMPTY_ADDR, status_tempat_tinggal: '', jarak_tempuh: '', transportasi: '', waktu_tempuh: '' },
};

export default function StudentDetailDialog({ student, open, onClose, autoEdit = false }) {
  const { activeRole, user } = useAuth();
  const isAdmin = activeRole === 'admin' || user?.roles?.includes('admin');
  const isWaliKelas = activeRole === 'wali_kelas' || user?.roles?.includes('wali_kelas');
  const canEdit = isAdmin || isWaliKelas || student?.id === user?.id;

  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(autoEdit);
  const [tab, setTab] = useState('siswa');
  const [detail, setDetail] = useState(EMPTY_DETAIL);
  const [studentData, setStudentData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [classHistory, setClassHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (!student?.id) return;
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/students/${student.id}/detail`);
        setStudentData(data.student);
        if (data.detail) {
          setDetail({ ...EMPTY_DETAIL, ...data.detail,
            ayah: { ...EMPTY_PARENT, ...(data.detail.ayah || {}) },
            ibu: { ...EMPTY_PARENT, ...(data.detail.ibu || {}) },
            wali: { ...EMPTY_PARENT, ...EMPTY_DETAIL.wali, ...(data.detail.wali || {}) },
            alamat_ayah: { ...EMPTY_ADDR, ...(data.detail.alamat_ayah || {}) },
            alamat_ibu: { ...EMPTY_ADDR, ...(data.detail.alamat_ibu || {}) },
            alamat_wali: { ...EMPTY_ADDR, ...EMPTY_DETAIL.alamat_wali, ...(data.detail.alamat_wali || {}) },
            alamat_siswa: { ...EMPTY_ADDR, ...EMPTY_DETAIL.alamat_siswa, ...(data.detail.alamat_siswa || {}) },
          });
        } else {
          setDetail(EMPTY_DETAIL);
        }
      } catch (e) {
        toast.error('Gagal memuat detail');
      } finally {
        setLoading(false);
      }
    })();
  }, [student?.id]);

  const loadClassHistory = async () => {
    if (!student?.id) return;
    setLoadingHistory(true);
    try {
      const { data } = await api.get(`/students/${student.id}/class-history`);
      setClassHistory(data || []);
    } catch (e) {
      toast.error('Gagal memuat riwayat kelas');
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (tab === 'riwayat' && classHistory.length === 0 && !loadingHistory) {
      loadClassHistory();
    }
  }, [tab]);

  const handleSave = async () => {
    setBusy(true);
    try {
      const payload = { ...detail };
      // Clean numbers
      ['jumlah_saudara', 'anak_ke'].forEach((k) => {
        if (payload[k] === '' || payload[k] == null) payload[k] = null;
        else payload[k] = parseInt(payload[k]);
      });
      await api.put(`/students/${student.id}/detail`, payload);
      toast.success('Detail siswa disimpan');
      setEditMode(false);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menyimpan');
    } finally {
      setBusy(false);
    }
  };

  const setField = (path, value) => {
    const parts = path.split('.');
    const next = { ...detail };
    let cur = next;
    for (let i = 0; i < parts.length - 1; i++) {
      cur[parts[i]] = { ...(cur[parts[i]] || {}) };
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
    setDetail(next);
  };

  const toggleArrayItem = (path, item) => {
    const arr = detail[path] || [];
    if (arr.includes(item)) setField(path, arr.filter((x) => x !== item));
    else setField(path, [...arr, item]);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto" data-testid="student-detail-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 flex-wrap">
            <GraduationCap className="h-5 w-5 text-[#006837]" />
            <span>{studentData?.full_name || student?.full_name}</span>
            {studentData?.nisn && <Badge variant="outline" className="font-mono text-xs">NISN: {studentData.nisn}</Badge>}
            {studentData?.class_name && <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20">{studentData.class_name}</Badge>}
            <div className="ml-auto flex items-center gap-2">
              {canEdit && !editMode && (
                <Button size="sm" variant="outline" onClick={() => setEditMode(true)} className="gap-1" data-testid="enable-edit-button">
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
              )}
              {editMode && (
                <Badge className="bg-amber-100 text-amber-700 border-amber-200">MODE EDIT</Badge>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-[#006837]" />
            Memuat detail siswa...
          </div>
        ) : (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="bg-slate-100 inline-flex w-auto" data-testid="detail-tabs">
              <TabsTrigger value="siswa" data-testid="tab-siswa"><User className="h-3.5 w-3.5 mr-1" /> Data Siswa</TabsTrigger>
              <TabsTrigger value="ortu" data-testid="tab-ortu"><Users className="h-3.5 w-3.5 mr-1" /> Data Orang Tua</TabsTrigger>
              <TabsTrigger value="alamat" data-testid="tab-alamat"><MapPin className="h-3.5 w-3.5 mr-1" /> Data Alamat</TabsTrigger>
              <TabsTrigger value="riwayat" data-testid="tab-riwayat"><History className="h-3.5 w-3.5 mr-1" /> Riwayat Kelas</TabsTrigger>
            </TabsList>

            <TabsContent value="siswa" className="mt-4 space-y-3">
              <Section title="Identitas Pribadi" icon={User}>
                <FormRow label="Nama Lengkap" value={studentData?.full_name} readOnly />
                <FormRow label="NISN" value={studentData?.nisn} readOnly mono />
                <FormRow label="Jenis Kelamin" value={studentData?.gender === 'L' ? 'Laki-laki' : studentData?.gender === 'P' ? 'Perempuan' : '-'} readOnly />
                <FormRow label="Tempat Lahir" value={studentData?.birth_place} readOnly />
                <FormRow label="Tanggal Lahir" value={studentData?.birth_date} readOnly mono />
                <SelectRow label="Warga Negara *" value={detail.citizenship} options={['WNI', 'WNA']} onChange={(v) => setField('citizenship', v)} disabled={!editMode} testid="citizenship" />
                {detail.citizenship === 'WNI' && (
                  <InputRow label="NIK (16 digit)" value={detail.nik} onChange={(v) => setField('nik', v)} disabled={!editMode} mono placeholder="3573...." />
                )}
                {detail.citizenship === 'WNA' && (
                  <>
                    <InputRow label="Asal Negara" value={detail.asal_negara} onChange={(v) => setField('asal_negara', v)} disabled={!editMode} />
                    <InputRow label="Nomor Izin Tinggal (KITAS)" value={detail.nomor_izin_tinggal} onChange={(v) => setField('nomor_izin_tinggal', v)} disabled={!editMode} />
                  </>
                )}
                <InputRow label="Jumlah Saudara" value={detail.jumlah_saudara} onChange={(v) => setField('jumlah_saudara', v)} type="number" maxLength={2} disabled={!editMode} />
                <InputRow label="Anak Ke-" value={detail.anak_ke} onChange={(v) => setField('anak_ke', v)} type="number" maxLength={2} disabled={!editMode} />
                <SelectRow label="Agama" value={detail.agama} options={AGAMA_OPTIONS} onChange={(v) => setField('agama', v)} disabled={!editMode} />
                <SelectRow label="Cita-cita" value={detail.cita_cita} options={CITA_CITA_OPTIONS} onChange={(v) => setField('cita_cita', v)} disabled={!editMode} />
                <SelectRow label="Hobi" value={detail.hobi} options={HOBI_OPTIONS} onChange={(v) => setField('hobi', v)} disabled={!editMode} />
              </Section>

              <Section title="Kontak" icon={Phone}>
                <CheckboxRow label="Tidak memiliki nomor HP" checked={detail.no_hp_unavailable} onChange={(v) => setField('no_hp_unavailable', v)} disabled={!editMode} />
                <InputRow label="Nomor HP" value={studentData?.phone} onChange={() => {}} readOnly type="tel" />
                <InputRow label="Email Siswa" value={studentData?.email} onChange={() => {}} readOnly type="email" />
              </Section>

              <Section title="Pembiayaan Sekolah & Riwayat" icon={GraduationCap}>
                <SelectRow label="Yang Membiayai" value={detail.pembiaya_sekolah} options={PEMBIAYA_OPTIONS} onChange={(v) => setField('pembiaya_sekolah', v)} disabled={!editMode} />
                <CheckboxGroupRow label="Pra-Sekolah" options={PRA_SEKOLAH_OPTIONS} values={detail.pra_sekolah} onToggle={(v) => toggleArrayItem('pra_sekolah', v)} disabled={!editMode} />
                <CheckboxGroupRow label="Imunisasi" options={IMUNISASI_OPTIONS} values={detail.imunisasi} onToggle={(v) => toggleArrayItem('imunisasi', v)} disabled={!editMode} />
                <InputRow label="Nomor KIP" value={detail.nomor_kip} onChange={(v) => setField('nomor_kip', v)} disabled={!editMode} mono />
              </Section>

              <Section title="Kartu Keluarga" icon={Hash}>
                <InputRow label="Nomor KK" value={detail.nomor_kk} onChange={(v) => setField('nomor_kk', v)} disabled={!editMode} mono />
                <InputRow label="Nama Kepala Keluarga" value={detail.nama_kepala_keluarga} onChange={(v) => setField('nama_kepala_keluarga', v)} disabled={!editMode} />
              </Section>
            </TabsContent>

            <TabsContent value="ortu" className="mt-4 space-y-4">
              <ParentSection title="Ayah Kandung" data={detail.ayah} setField={(k, v) => setField(`ayah.${k}`, v)} disabled={!editMode} testidPrefix="ayah" />
              <ParentSection title="Ibu Kandung" data={detail.ibu} setField={(k, v) => setField(`ibu.${k}`, v)} disabled={!editMode} testidPrefix="ibu" />
              <ParentSection title="Wali" data={detail.wali} setField={(k, v) => setField(`wali.${k}`, v)} disabled={!editMode}
                isWali testidPrefix="wali" />
            </TabsContent>

            <TabsContent value="alamat" className="mt-4 space-y-4">
              <AddressSection title="Alamat Ayah Kandung" data={detail.alamat_ayah} setField={(k, v) => setField(`alamat_ayah.${k}`, v)} disabled={!editMode} testidPrefix="alamat-ayah" />
              <AddressSection title="Alamat Ibu Kandung" data={detail.alamat_ibu} setField={(k, v) => setField(`alamat_ibu.${k}`, v)} disabled={!editMode}
                hasSameAsAyah testidPrefix="alamat-ibu" />
              <AddressSection title="Alamat Wali" data={detail.alamat_wali} setField={(k, v) => setField(`alamat_wali.${k}`, v)} disabled={!editMode}
                hasSameAsAyah isWali testidPrefix="alamat-wali" />
              <Section title="Alamat & Akses Siswa ke Madrasah" icon={MapPin}>
                <FormRow label="Alamat (basic)" value={studentData?.address} readOnly />
                <SelectRow label="Status Tempat Tinggal" value={detail.alamat_siswa?.status_tempat_tinggal} options={['Tinggal dengan Ayah Kandung', 'Tinggal dengan Ibu Kandung', 'Tinggal dengan Wali', 'Ikut Saudara/Kerabat', 'Asrama Madrasah', 'Kontrak/Kost', 'Tinggal di Asrama Pesantren', 'Panti Asuhan', 'Rumah Singgah', 'Lainnya']}
                  onChange={(v) => setField('alamat_siswa.status_tempat_tinggal', v)} disabled={!editMode} />
                <SelectRow label="Jarak Tempuh" value={detail.alamat_siswa?.jarak_tempuh} options={['Kurang dari 5 km', '5-10 km', '11-20 km', '21-30 km', 'Lebih dari 30 km']} onChange={(v) => setField('alamat_siswa.jarak_tempuh', v)} disabled={!editMode} />
                <SelectRow label="Transportasi" value={detail.alamat_siswa?.transportasi} options={['Jalan Kaki', 'Sepeda', 'Sepeda Motor', 'Mobil Pribadi', 'Antar Jemput Sekolah', 'Angkutan Umum', 'Perahu/Sampan', 'Kendaraan Pribadi', 'Kereta Api', 'Ojek', 'Andong/Bendi/Sado/Dokar/Delman/Becak', 'Lainnya']} onChange={(v) => setField('alamat_siswa.transportasi', v)} disabled={!editMode} />
                <SelectRow label="Waktu Tempuh" value={detail.alamat_siswa?.waktu_tempuh} options={['1-10 menit', '10-19 menit', '20-29 menit', '30-39 menit', '1-2 jam', 'Lebih dari 2 jam']} onChange={(v) => setField('alamat_siswa.waktu_tempuh', v)} disabled={!editMode} />
              </Section>
            </TabsContent>

            <TabsContent value="riwayat" className="mt-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-100 mb-4">
                    <History className="h-4 w-4 text-[#006837]" />
                    <h3 className="font-semibold text-slate-900 text-sm uppercase tracking-wide">Riwayat Kelas Siswa</h3>
                  </div>

                  {loadingHistory ? (
                    <div className="py-8 text-center text-slate-500">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-[#006837]" />
                      Memuat riwayat kelas...
                    </div>
                  ) : classHistory.length === 0 ? (
                    <p className="text-center py-8 text-slate-400">Belum ada riwayat kelas</p>
                  ) : (
                    <div className="space-y-3">
                      {classHistory.map((h, idx) => {
                        const reasonLabels = {
                          pembagian_kelas: { label: 'Pembagian Kelas', color: 'bg-blue-100 text-blue-700 border-blue-200' },
                          pindah_kelas: { label: 'Pindah Kelas', color: 'bg-amber-100 text-amber-700 border-amber-200' },
                          naik_kelas: { label: 'Naik Kelas', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
                          mutasi_masuk: { label: 'Mutasi Masuk', color: 'bg-purple-100 text-purple-700 border-purple-200' },
                          mutasi_keluar: { label: 'Mutasi Keluar', color: 'bg-rose-100 text-rose-700 border-rose-200' }
                        };
                        const reason = reasonLabels[h.reason] || { label: h.reason, color: 'bg-slate-100 text-slate-700' };
                        const isActive = !h.end_date;

                        return (
                          <div key={h.id} className={`p-4 rounded-lg border-2 ${isActive ? 'border-[#006837] bg-[#006837]/5' : 'border-slate-200 bg-slate-50'}`}>
                            <div className="flex items-start justify-between gap-3 flex-wrap">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <h4 className="font-bold text-lg text-slate-900">{h.class_name}</h4>
                                  {isActive && (
                                    <Badge className="bg-[#006837] text-white">Kelas Saat Ini</Badge>
                                  )}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                                  <div>
                                    <span className="text-slate-600">Tahun Pelajaran:</span>
                                    <div className="font-semibold text-slate-900">{h.academic_year_name}</div>
                                  </div>
                                  <div>
                                    <span className="text-slate-600">Semester:</span>
                                    <div className="font-semibold text-slate-900 capitalize">{h.semester}</div>
                                  </div>
                                  <div>
                                    <span className="text-slate-600">Tanggal Mulai:</span>
                                    <div className="font-mono text-sm text-slate-900">
                                      {new Date(h.start_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                                    </div>
                                  </div>
                                  {h.end_date && (
                                    <div>
                                      <span className="text-slate-600">Tanggal Selesai:</span>
                                      <div className="font-mono text-sm text-slate-900">
                                        {new Date(h.end_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex-shrink-0">
                                <Badge className={`${reason.color} border`}>
                                  {reason.label}
                                </Badge>
                              </div>
                            </div>
                            {h.notes && (
                              <div className="mt-3 pt-3 border-t border-slate-200">
                                <span className="text-xs text-slate-600 uppercase">Catatan:</span>
                                <p className="text-sm text-slate-700 italic mt-1">{h.notes}</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Tutup</Button>
          {canEdit && editMode && (
            <Button onClick={handleSave} disabled={busy} className="bg-[#006837] hover:bg-[#0B7A3B] gap-2" data-testid="save-detail-button">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Simpan Detail
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <Icon className="h-4 w-4 text-[#006837]" />
          <h3 className="font-semibold text-slate-900 text-sm uppercase tracking-wide">{title}</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}

function FormRow({ label, value, readOnly, mono }) {
  return (
    <div>
      <Label className="text-xs uppercase text-slate-500">{label}</Label>
      <div className={`mt-1 px-3 py-2 rounded-md bg-slate-50 border border-slate-200 text-sm ${mono ? 'font-mono' : ''} ${value ? 'text-slate-900' : 'text-slate-400 italic'}`}>
        {value || '-'}
      </div>
    </div>
  );
}

function InputRow({ label, value, onChange, type = 'text', disabled, readOnly, mono, maxLength, placeholder }) {
  if (readOnly) return <FormRow label={label} value={value} mono={mono} />;
  return (
    <div>
      <Label className="text-xs uppercase text-slate-500">{label}</Label>
      <Input type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)} disabled={disabled} maxLength={maxLength} placeholder={placeholder}
        className={`mt-1 ${mono ? 'font-mono' : ''}`} />
    </div>
  );
}

function SelectRow({ label, value, options, onChange, disabled, testid }) {
  if (disabled) return <FormRow label={label} value={value} />;
  return (
    <div>
      <Label className="text-xs uppercase text-slate-500">{label}</Label>
      <Select value={value || ''} onValueChange={onChange}>
        <SelectTrigger className="mt-1" data-testid={testid}><SelectValue placeholder="Pilih..." /></SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function CheckboxRow({ label, checked, onChange, disabled }) {
  return (
    <div className="flex items-center gap-2 col-span-2 p-2 rounded-md bg-slate-50">
      <Checkbox checked={!!checked} onCheckedChange={onChange} disabled={disabled} />
      <Label className="text-sm cursor-pointer">{label}</Label>
    </div>
  );
}

function CheckboxGroupRow({ label, options, values = [], onToggle, disabled }) {
  return (
    <div className="col-span-2">
      <Label className="text-xs uppercase text-slate-500 block mb-2">{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const checked = values.includes(o);
          return (
            <label key={o} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-xs ${checked ? 'bg-[#006837] text-white border-[#006837]' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'} ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}>
              <input type="checkbox" checked={checked} onChange={() => !disabled && onToggle(o)} disabled={disabled} className="sr-only" />
              {o}
            </label>
          );
        })}
      </div>
    </div>
  );
}

function ParentSection({ title, data, setField, disabled, isWali = false, testidPrefix }) {
  const isDead = data.status === 'Sudah Meninggal' || data.status === 'Tidak Diketahui';
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <Users className="h-4 w-4 text-[#006837]" />
          <h3 className="font-semibold text-slate-900 text-sm uppercase tracking-wide">{title}</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {isWali && (
            <SelectRow label="Hubungan Wali" value={data.hubungan_wali} options={['Sama dengan ayah kandung', 'Sama dengan ibu kandung', 'Lainnya']} onChange={(v) => setField('hubungan_wali', v)} disabled={disabled} testid={`${testidPrefix}-hubungan`} />
          )}
          <InputRow label="Nama Lengkap" value={data.nama} onChange={(v) => setField('nama', v)} disabled={disabled} />
          <SelectRow label="Status" value={data.status} options={STATUS_HIDUP} onChange={(v) => setField('status', v)} disabled={disabled} />
          {!isDead && (
            <>
              <SelectRow label="Kewarganegaraan" value={data.citizenship} options={['WNI', 'WNA']} onChange={(v) => setField('citizenship', v)} disabled={disabled} />
              {data.citizenship === 'WNI' && (
                <InputRow label="NIK (16 digit)" value={data.nik} onChange={(v) => setField('nik', v)} disabled={disabled} mono maxLength={16} />
              )}
              {data.citizenship === 'WNA' && (
                <>
                  <InputRow label="Asal Negara" value={data.asal_negara} onChange={(v) => setField('asal_negara', v)} disabled={disabled} />
                  <InputRow label="Nomor Izin Tinggal" value={data.nomor_izin_tinggal} onChange={(v) => setField('nomor_izin_tinggal', v)} disabled={disabled} />
                </>
              )}
              <InputRow label="Tempat Lahir" value={data.tempat_lahir} onChange={(v) => setField('tempat_lahir', v)} disabled={disabled} />
              <InputRow label="Tanggal Lahir" value={data.tgl_lahir} onChange={(v) => setField('tgl_lahir', v)} type="date" disabled={disabled} />
              <SelectRow label="Pendidikan Terakhir" value={data.pendidikan} options={PENDIDIKAN_OPTIONS} onChange={(v) => setField('pendidikan', v)} disabled={disabled} />
              <SelectRow label="Pekerjaan Utama" value={data.pekerjaan} options={PEKERJAAN_OPTIONS} onChange={(v) => setField('pekerjaan', v)} disabled={disabled} />
              <SelectRow label="Penghasilan Bulanan" value={data.penghasilan} options={PENGHASILAN_OPTIONS} onChange={(v) => setField('penghasilan', v)} disabled={disabled} />
              <CheckboxRow label="Tidak memiliki nomor HP" checked={data.no_hp_unavailable} onChange={(v) => setField('no_hp_unavailable', v)} disabled={disabled} />
              {!data.no_hp_unavailable && (
                <InputRow label="Nomor HP" value={data.no_hp} onChange={(v) => setField('no_hp', v)} type="tel" disabled={disabled} maxLength={20} />
              )}
              {isWali && (
                <>
                  <InputRow label="Nomor KKS (opsional)" value={data.nomor_kks} onChange={(v) => setField('nomor_kks', v)} disabled={disabled} mono />
                  <InputRow label="Nomor PKH (opsional)" value={data.nomor_pkh} onChange={(v) => setField('nomor_pkh', v)} disabled={disabled} mono />
                </>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AddressSection({ title, data, setField, disabled, hasSameAsAyah, isWali, testidPrefix }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <MapPin className="h-4 w-4 text-[#006837]" />
          <h3 className="font-semibold text-slate-900 text-sm uppercase tracking-wide">{title}</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {isWali && (
            <SelectRow label="Status Wali" value={data.status_wali} options={['Sama dengan ayah kandung', 'Sama dengan ibu kandung', 'Lainnya']} onChange={(v) => setField('status_wali', v)} disabled={disabled} />
          )}
          {hasSameAsAyah && (
            <CheckboxRow label="Sama dengan alamat ayah kandung" checked={data.sama_dengan_ayah} onChange={(v) => setField('sama_dengan_ayah', v)} disabled={disabled} />
          )}
          <CheckboxRow label="Tinggal di luar negeri" checked={data.tinggal_luar_negeri} onChange={(v) => setField('tinggal_luar_negeri', v)} disabled={disabled} />
          <SelectRow label="Status Kepemilikan Rumah" value={data.status_kepemilikan} options={STATUS_RUMAH} onChange={(v) => setField('status_kepemilikan', v)} disabled={disabled} />
          {!data.tinggal_luar_negeri && (
            <>
              <InputRow label="Provinsi" value={data.provinsi} onChange={(v) => setField('provinsi', v)} disabled={disabled} placeholder="Jawa Timur" />
              <InputRow label="Kabupaten/Kota" value={data.kabupaten} onChange={(v) => setField('kabupaten', v)} disabled={disabled} placeholder="Kota Malang" />
              <InputRow label="Kecamatan" value={data.kecamatan} onChange={(v) => setField('kecamatan', v)} disabled={disabled} />
              <InputRow label="Kelurahan/Desa" value={data.kelurahan} onChange={(v) => setField('kelurahan', v)} disabled={disabled} />
              <InputRow label="RT" value={data.rt} onChange={(v) => setField('rt', v)} type="number" maxLength={3} disabled={disabled} />
              <InputRow label="RW" value={data.rw} onChange={(v) => setField('rw', v)} type="number" maxLength={3} disabled={disabled} />
              <InputRow label="Kode Pos" value={data.kode_pos} onChange={(v) => setField('kode_pos', v)} type="number" maxLength={6} disabled={disabled} />
            </>
          )}
          <div className="col-span-2">
            <Label className="text-xs uppercase text-slate-500">Alamat Lengkap</Label>
            {disabled ? (
              <div className="mt-1 px-3 py-2 rounded-md bg-slate-50 border border-slate-200 text-sm">{data.alamat || <span className="italic text-slate-400">-</span>}</div>
            ) : (
              <Textarea value={data.alamat || ''} onChange={(e) => setField('alamat', e.target.value)} disabled={disabled} rows={2} placeholder="Jl. ..." className="mt-1" />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
