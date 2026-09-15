import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
  Trophy, Sparkles, BookOpen, Award, Plus, Trash2, Upload, X, ExternalLink, HeartHandshake, FolderUp,
} from 'lucide-react';
import { api, openAuthedFile } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
function fileUrl(u) {
  if (!u) return '';
  if (u.startsWith('http') || u.startsWith('data:')) return u;
  return `${BACKEND_URL}${u}`;
}

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

const BEASISWA_KATEGORI_OPTIONS = ['Beasiswa Lainnya', 'Beasiswa Berprestasi', 'Beasiswa Kurang Mampu/Miskin', 'Beasiswa Miskin dan Berprestasi'];
const INSTANSI_PEMBERI_OPTIONS = ['Kementerian Agama', 'Kementerian Lain', 'Pemerintah Daerah', 'BUMN', 'BUMD', 'Instansi Swasta', 'Yayasan', 'Perorangan', 'Lainnya'];
const FREKUENSI_BELAJAR_OPTIONS = ['Setiap Hari', 'Seminggu 2-3', 'Seminggu Sekali', 'Tidak Rutin'];

const JENIS_KEBUTUHAN_KHUSUS_OPTIONS = ['Tidak ada', 'Lamban belajar', 'Kesulitan Belajar spesifik', 'Gangguan komunikasi', 'Berbakat/memiliki kemampuan dan kecerdasan luar biasa', 'Lainnya'];
const KEBUTUHAN_DISABILITAS_OPTIONS = ['Tidak ada', 'Tuna netra', 'Tuna Rungu', 'Tuna Daksa', 'Tuna Grahita', 'Tuna laras', 'Tuna wicara', 'Lainnya'];

const BERKAS_LIST = [
  { key: 'berkas_kartu_keluarga', label: 'Kartu Keluarga' },
  { key: 'berkas_akta_kelahiran', label: 'Akta Kelahiran' },
  { key: 'berkas_ijazah_sd', label: 'Ijazah SD/MI' },
  { key: 'berkas_kip', label: 'Kartu Indonesia Pintar (KIP)' },
  { key: 'berkas_pkh', label: 'Program Keluarga Harapan (PKH)' },
  { key: 'berkas_kks', label: 'Kartu Keluarga Sejahtera (KKS)' },
  { key: 'berkas_kartu_pelajar', label: 'Kartu Pelajar MTsN 2 Kota Malang' },
];

const EMPTY_KEAHLIAN = { bidang_keahlian: '', nama_keahlian: '', sertifikasi: '', lembaga_penyelenggara: '', hasil_tingkat_skor: '', file_bukti_sertifikat: '' };
const EMPTY_BEASISWA = { tahun: '', kategori: '', nama_beasiswa: '', jenis_instansi_pemberi: '', nama_instansi_pemberi: '', jangka_waktu_bulan: '', nominal_beasiswa: '' };
const EMPTY_PENDIDIKAN_LAIN = { nama_lembaga: '', jenis_lembaga: '', mulai_belajar: '', frekuensi_belajar: '', lokasi_lembaga: '' };
const EMPTY_TAHFIDZ = { juz_alquran_dihafal: '', file_bukti_syahadah: '', file_bukti_tahsin: '' };

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
  keahlian: [],
  tahfidz: { ...EMPTY_TAHFIDZ },
  beasiswa: [],
  pendidikan_lain: [],
  jenis_kebutuhan_khusus: '',
  kebutuhan_disabilitas: [],
  berkas_kartu_keluarga: '',
  berkas_akta_kelahiran: '',
  berkas_ijazah_sd: '',
  berkas_kip: '',
  berkas_pkh: '',
  berkas_kks: '',
  berkas_kartu_pelajar: '',
};

function normalizeDetail(raw) {
  return {
    ...EMPTY_DETAIL, ...raw,
    ayah: { ...EMPTY_PARENT, ...(raw?.ayah || {}) },
    ibu: { ...EMPTY_PARENT, ...(raw?.ibu || {}) },
    wali: { ...EMPTY_PARENT, ...EMPTY_DETAIL.wali, ...(raw?.wali || {}) },
    alamat_ayah: { ...EMPTY_ADDR, ...(raw?.alamat_ayah || {}) },
    alamat_ibu: { ...EMPTY_ADDR, ...(raw?.alamat_ibu || {}) },
    alamat_wali: { ...EMPTY_ADDR, ...EMPTY_DETAIL.alamat_wali, ...(raw?.alamat_wali || {}) },
    alamat_siswa: { ...EMPTY_ADDR, ...EMPTY_DETAIL.alamat_siswa, ...(raw?.alamat_siswa || {}) },
    keahlian: raw?.keahlian || [],
    tahfidz: { ...EMPTY_TAHFIDZ, ...(raw?.tahfidz || {}) },
    beasiswa: raw?.beasiswa || [],
    pendidikan_lain: raw?.pendidikan_lain || [],
    jenis_kebutuhan_khusus: raw?.jenis_kebutuhan_khusus || '',
    kebutuhan_disabilitas: raw?.kebutuhan_disabilitas || [],
  };
}

export default function StudentDetailDialog({ student, open, onClose, autoEdit = false, asPage = false }) {
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
  const [achievements, setAchievements] = useState([]);
  const [loadingAchievements, setLoadingAchievements] = useState(false);
  const [initialDetailSnapshot, setInitialDetailSnapshot] = useState(EMPTY_DETAIL);
  const [fieldErrors, setFieldErrors] = useState({ nik: '', nomor_kk: '' });

  useEffect(() => {
    if (!student?.id) return;
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/students/${student.id}/detail`);
        setStudentData(data.student);
        if (data.detail) {
          const normalized = normalizeDetail(data.detail);
          setDetail(normalized);
          setInitialDetailSnapshot(normalized);
        } else {
          setDetail(EMPTY_DETAIL);
          setInitialDetailSnapshot(EMPTY_DETAIL);
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

  const loadAchievements = async () => {
    if (!student?.id) return;
    setLoadingAchievements(true);
    try {
      const { data } = await api.get('/achievements', { params: { student_id: student.id } });
      setAchievements(data || []);
    } catch (e) {
      toast.error('Gagal memuat prestasi');
    } finally {
      setLoadingAchievements(false);
    }
  };

  useEffect(() => {
    if (tab === 'prestasi' && achievements.length === 0 && !loadingAchievements) {
      loadAchievements();
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
      // Validasi NIK & Nomor KK (jika diisi) harus 16 digit angka
      const cleanDigits = (val) => String(val || '').replace(/\D/g, '');
      const nikDigits = cleanDigits(payload.nik);
      const kkDigits = cleanDigits(payload.nomor_kk);

      // Wajib tepat 16 digit (tidak boleh kurang/lebih) jika field diisi
      const nextErrors = { nik: '', nomor_kk: '' };
      if ((payload.nik || '').trim() && nikDigits.length !== 16) {
        nextErrors.nik = 'NIK harus tepat 16 digit angka';
      }
      if ((payload.nomor_kk || '').trim() && kkDigits.length !== 16) {
        nextErrors.nomor_kk = 'Nomor KK harus tepat 16 digit angka';
      }
      setFieldErrors(nextErrors);

      if (nextErrors.nik || nextErrors.nomor_kk) {
        toast.error(nextErrors.nik || nextErrors.nomor_kk);
        setBusy(false);
        return;
      }

      // Normalisasi nilai angka-only maksimal 16 digit
      payload.nik = nikDigits ? nikDigits.slice(0, 16) : '';
      payload.nomor_kk = kkDigits ? kkDigits.slice(0, 16) : '';

      if (isAdmin) {
        // Admin simpan langsung (tanpa verval)
        await api.put(`/api/users/${student.id}`, {
          agama: payload.agama || null,
          nik: payload.nik || null,
          nomor_kk: payload.nomor_kk || null,
          nama_kepala_keluarga: payload.nama_kepala_keluarga || null,
          ibu_nama: payload?.ibu?.nama || null,
        });
        await api.put(`/students/${student.id}/detail`, payload);

        // Refetch agar nilai terbaru langsung terlihat di dialog
        const { data: refreshed } = await api.get(`/students/${student.id}/detail`);
        setStudentData(refreshed.student);
        if (refreshed.detail) {
          const normalized = normalizeDetail(refreshed.detail);
          setDetail(normalized);
          setInitialDetailSnapshot(normalized);
        }

        toast.success('Detail siswa disimpan');
      } else {
        // Payload berisi struktur detail (ayah/ibu/alamat/keahlian/dst) yang disimpan
        // di collection student_details, BUKAN di collection users.
        await api.post('/verval-requests', {
          user_id: student.id,
          user_type: (studentData?.roles || student?.roles || []).includes('siswa')
            ? 'siswa'
            : (studentData?.roles || student?.roles || []).includes('tenaga_kependidikan')
              ? 'tenaga_kependidikan'
              : 'guru',
          request_type: 'profile_update',
          target_collection: 'student_details',
          target_id: student.id,
          old_data: initialDetailSnapshot || {},
          new_data: payload,
        });
        toast.success('Pengajuan perubahan data dikirim untuk review');
      }
      setInitialDetailSnapshot(payload);
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

  const [uploadingKey, setUploadingKey] = useState(null); // e.g. 'keahlian-2', 'tahfidz_syahadah'

  const uploadDetailFile = async (jenis, file) => {
    if (!file) return null;
    if (file.size > 2 * 1024 * 1024) { toast.error('Maks 2MB'); return null; }
    const fd = new FormData();
    fd.append('file', file);
    try {
      const { data } = await api.post(`/students/detail/upload/${jenis}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data.url;
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Gagal upload file');
      return null;
    }
  };

  // === List dinamis (Keahlian / Beasiswa / Pendidikan Lain) ===
  const addListItem = (path, empty) => setField(path, [...(detail[path] || []), { ...empty }]);
  const removeListItem = (path, idx) => setField(path, (detail[path] || []).filter((_, i) => i !== idx));
  const setListItemField = (path, idx, key, value) => {
    const arr = [...(detail[path] || [])];
    arr[idx] = { ...arr[idx], [key]: value };
    setField(path, arr);
  };

  const headerNode = (
    <div className="flex items-center gap-3 flex-wrap">
      <GraduationCap className="h-5 w-5 text-[#006837]" />
      <span className="font-semibold text-lg">{studentData?.full_name || student?.full_name}</span>
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
    </div>
  );

  const bodyNode = loading ? (
    <div className="p-12 text-center text-slate-500">
      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-[#006837]" />
      Memuat detail siswa...
    </div>
  ) : (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="bg-slate-100 inline-flex w-auto flex-wrap h-auto" data-testid="detail-tabs">
              <TabsTrigger value="siswa" data-testid="tab-siswa"><User className="h-3.5 w-3.5 mr-1" /> Data Siswa</TabsTrigger>
              <TabsTrigger value="ortu" data-testid="tab-ortu"><Users className="h-3.5 w-3.5 mr-1" /> Data Orang Tua</TabsTrigger>
              <TabsTrigger value="alamat" data-testid="tab-alamat"><MapPin className="h-3.5 w-3.5 mr-1" /> Data Alamat</TabsTrigger>
              <TabsTrigger value="prestasi" data-testid="tab-prestasi"><Trophy className="h-3.5 w-3.5 mr-1" /> Prestasi</TabsTrigger>
              <TabsTrigger value="keahlian" data-testid="tab-keahlian"><Sparkles className="h-3.5 w-3.5 mr-1" /> Keahlian</TabsTrigger>
              <TabsTrigger value="tahfidz" data-testid="tab-tahfidz"><BookOpen className="h-3.5 w-3.5 mr-1" /> Tahfidz</TabsTrigger>
              <TabsTrigger value="beasiswa" data-testid="tab-beasiswa"><Award className="h-3.5 w-3.5 mr-1" /> Beasiswa & Bantuan</TabsTrigger>
              <TabsTrigger value="pendidikan-lain" data-testid="tab-pendidikan-lain"><GraduationCap className="h-3.5 w-3.5 mr-1" /> Pendidikan Lain</TabsTrigger>
              <TabsTrigger value="kebutuhan-khusus" data-testid="tab-kebutuhan-khusus"><HeartHandshake className="h-3.5 w-3.5 mr-1" /> Kebutuhan Khusus</TabsTrigger>
              <TabsTrigger value="berkas" data-testid="tab-berkas"><FolderUp className="h-3.5 w-3.5 mr-1" /> Upload Berkas</TabsTrigger>
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
                  <InputRow label="NIK (16 digit)" value={detail.nik} onChange={(v) => {
                    const next = String(v || '').replace(/\D/g, '').slice(0, 16);
                    setField('nik', next);
                    setFieldErrors((prev) => ({ ...prev, nik: next.length === 0 || next.length === 16 ? '' : 'NIK harus tepat 16 digit angka' }));
                  }} disabled={!editMode} mono placeholder="3573...." maxLength={16} error={fieldErrors.nik} inputMode="numeric" />
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
                <InputRow label="Nomor KK" value={detail.nomor_kk} onChange={(v) => {
                  const next = String(v || '').replace(/\D/g, '').slice(0, 16);
                  setField('nomor_kk', next);
                  setFieldErrors((prev) => ({ ...prev, nomor_kk: next.length === 0 || next.length === 16 ? '' : 'Nomor KK harus tepat 16 digit angka' }));
                }} disabled={!editMode} mono maxLength={16} error={fieldErrors.nomor_kk} />
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

            <TabsContent value="prestasi" className="mt-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-[#006837]" />
                      <h3 className="font-semibold text-slate-900 text-sm uppercase tracking-wide">Prestasi Siswa</h3>
                    </div>
                    <Button asChild size="sm" variant="outline" className="gap-1.5">
                      <Link to="/prestasi">
                        <ExternalLink className="h-3.5 w-3.5" /> Kelola Prestasi
                      </Link>
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500 mb-3">Data ini diambil dari menu Data Prestasi. Untuk menambah/mengubah prestasi, gunakan tombol "Kelola Prestasi" di atas.</p>
                  {loadingAchievements ? (
                    <div className="py-8 text-center text-slate-500">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-[#006837]" />
                      Memuat prestasi...
                    </div>
                  ) : achievements.length === 0 ? (
                    <p className="text-center py-8 text-slate-400">Belum ada data prestasi</p>
                  ) : (
                    <div className="space-y-2">
                      {achievements.map((a) => (
                        <div key={a.id} className="p-3 rounded-lg border border-slate-200 flex items-start justify-between gap-3 flex-wrap">
                          <div>
                            <div className="font-semibold text-slate-900">{a.name}</div>
                            <div className="text-xs text-slate-600 mt-0.5">
                              {a.year || '-'} &middot; {a.level || '-'} &middot; {a.rank || '-'}
                            </div>
                          </div>
                          {a.is_verified ? (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Terverifikasi</Badge>
                          ) : (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-200">Menunggu</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="keahlian" className="mt-4">
              <DynamicListSection
                title="Keahlian"
                icon={Sparkles}
                items={detail.keahlian}
                disabled={!editMode}
                emptyItem={EMPTY_KEAHLIAN}
                onAdd={() => addListItem('keahlian', EMPTY_KEAHLIAN)}
                onRemove={(idx) => removeListItem('keahlian', idx)}
                addLabel="Tambah Keahlian"
                emptyMessage="Belum ada data keahlian"
                renderItem={(item, idx) => (
                  <>
                    <InputRow label="Bidang Keahlian" value={item.bidang_keahlian} onChange={(v) => setListItemField('keahlian', idx, 'bidang_keahlian', v)} disabled={!editMode} placeholder="Mis. Komputer, Bahasa, Musik" />
                    <InputRow label="Nama Keahlian" value={item.nama_keahlian} onChange={(v) => setListItemField('keahlian', idx, 'nama_keahlian', v)} disabled={!editMode} />
                    <InputRow label="Sertifikasi" value={item.sertifikasi} onChange={(v) => setListItemField('keahlian', idx, 'sertifikasi', v)} disabled={!editMode} />
                    <InputRow label="Lembaga Penyelenggara" value={item.lembaga_penyelenggara} onChange={(v) => setListItemField('keahlian', idx, 'lembaga_penyelenggara', v)} disabled={!editMode} />
                    <InputRow label="Hasil/Tingkat/Skor" value={item.hasil_tingkat_skor} onChange={(v) => setListItemField('keahlian', idx, 'hasil_tingkat_skor', v)} disabled={!editMode} />
                    <FileUploadRow
                      label="Bukti Sertifikat (PDF, maks 2MB)"
                      url={item.file_bukti_sertifikat}
                      disabled={!editMode}
                      accept=".pdf"
                      uploading={uploadingKey === `keahlian-${idx}`}
                      onUpload={async (file) => {
                        if (!file.name.toLowerCase().endsWith('.pdf')) { toast.error('File harus berformat PDF'); return; }
                        setUploadingKey(`keahlian-${idx}`);
                        const url = await uploadDetailFile('keahlian', file);
                        if (url) setListItemField('keahlian', idx, 'file_bukti_sertifikat', url);
                        setUploadingKey(null);
                      }}
                      onClear={() => setListItemField('keahlian', idx, 'file_bukti_sertifikat', '')}
                    />
                  </>
                )}
              />
            </TabsContent>

            <TabsContent value="tahfidz" className="mt-4">
              <Section title="Tahfidz" icon={BookOpen}>
                <InputRow label="Juz Al-Qur'an yang Dihafal" value={detail.tahfidz?.juz_alquran_dihafal} onChange={(v) => setField('tahfidz.juz_alquran_dihafal', v)} disabled={!editMode} placeholder="Mis. Juz 30, Juz 1-5" />
                <FileUploadRow
                  label="Bukti Syahadah (PDF, maks 2MB)"
                  url={detail.tahfidz?.file_bukti_syahadah}
                  disabled={!editMode}
                  accept=".pdf"
                  uploading={uploadingKey === 'tahfidz_syahadah'}
                  onUpload={async (file) => {
                    if (!file.name.toLowerCase().endsWith('.pdf')) { toast.error('File harus berformat PDF'); return; }
                    setUploadingKey('tahfidz_syahadah');
                    const url = await uploadDetailFile('tahfidz_syahadah', file);
                    if (url) setField('tahfidz.file_bukti_syahadah', url);
                    setUploadingKey(null);
                  }}
                  onClear={() => setField('tahfidz.file_bukti_syahadah', '')}
                />
                <FileUploadRow
                  label="Bukti Tahsin (PDF, maks 2MB)"
                  url={detail.tahfidz?.file_bukti_tahsin}
                  disabled={!editMode}
                  accept=".pdf"
                  uploading={uploadingKey === 'tahfidz_tahsin'}
                  onUpload={async (file) => {
                    if (!file.name.toLowerCase().endsWith('.pdf')) { toast.error('File harus berformat PDF'); return; }
                    setUploadingKey('tahfidz_tahsin');
                    const url = await uploadDetailFile('tahfidz_tahsin', file);
                    if (url) setField('tahfidz.file_bukti_tahsin', url);
                    setUploadingKey(null);
                  }}
                  onClear={() => setField('tahfidz.file_bukti_tahsin', '')}
                />
              </Section>
            </TabsContent>

            <TabsContent value="beasiswa" className="mt-4">
              <DynamicListSection
                title="Beasiswa & Bantuan"
                icon={Award}
                items={detail.beasiswa}
                disabled={!editMode}
                emptyItem={EMPTY_BEASISWA}
                onAdd={() => addListItem('beasiswa', EMPTY_BEASISWA)}
                onRemove={(idx) => removeListItem('beasiswa', idx)}
                addLabel="Tambah Beasiswa"
                emptyMessage="Belum ada data beasiswa/bantuan"
                renderItem={(item, idx) => (
                  <>
                    <InputRow label="Tahun" value={item.tahun} onChange={(v) => setListItemField('beasiswa', idx, 'tahun', v)} disabled={!editMode} type="number" />
                    <SelectRow label="Kategori" value={item.kategori} options={BEASISWA_KATEGORI_OPTIONS} onChange={(v) => setListItemField('beasiswa', idx, 'kategori', v)} disabled={!editMode} />
                    <InputRow label="Nama Beasiswa/Bantuan" value={item.nama_beasiswa} onChange={(v) => setListItemField('beasiswa', idx, 'nama_beasiswa', v)} disabled={!editMode} />
                    <SelectRow label="Jenis Instansi Pemberi" value={item.jenis_instansi_pemberi} options={INSTANSI_PEMBERI_OPTIONS} onChange={(v) => setListItemField('beasiswa', idx, 'jenis_instansi_pemberi', v)} disabled={!editMode} />
                    <InputRow label="Nama Instansi Pemberi" value={item.nama_instansi_pemberi} onChange={(v) => setListItemField('beasiswa', idx, 'nama_instansi_pemberi', v)} disabled={!editMode} />
                    <InputRow label="Jangka Waktu (Bulan)" value={item.jangka_waktu_bulan} onChange={(v) => setListItemField('beasiswa', idx, 'jangka_waktu_bulan', v)} disabled={!editMode} type="number" />
                    <InputRow label="Nominal Beasiswa (Rp)" value={item.nominal_beasiswa} onChange={(v) => setListItemField('beasiswa', idx, 'nominal_beasiswa', v)} disabled={!editMode} type="number" />
                  </>
                )}
              />
            </TabsContent>

            <TabsContent value="pendidikan-lain" className="mt-4">
              <DynamicListSection
                title="Pendidikan Lain"
                icon={GraduationCap}
                items={detail.pendidikan_lain}
                disabled={!editMode}
                emptyItem={EMPTY_PENDIDIKAN_LAIN}
                onAdd={() => addListItem('pendidikan_lain', EMPTY_PENDIDIKAN_LAIN)}
                onRemove={(idx) => removeListItem('pendidikan_lain', idx)}
                addLabel="Tambah Pendidikan Lain"
                emptyMessage="Belum ada data pendidikan lain"
                renderItem={(item, idx) => (
                  <>
                    <InputRow label="Nama Lembaga" value={item.nama_lembaga} onChange={(v) => setListItemField('pendidikan_lain', idx, 'nama_lembaga', v)} disabled={!editMode} />
                    <InputRow label="Jenis Lembaga" value={item.jenis_lembaga} onChange={(v) => setListItemField('pendidikan_lain', idx, 'jenis_lembaga', v)} disabled={!editMode} placeholder="Mis. Kursus, Les Privat, Pesantren" />
                    <InputRow label="Mulai Belajar" value={item.mulai_belajar} onChange={(v) => setListItemField('pendidikan_lain', idx, 'mulai_belajar', v)} disabled={!editMode} type="date" />
                    <SelectRow label="Frekuensi Belajar" value={item.frekuensi_belajar} options={FREKUENSI_BELAJAR_OPTIONS} onChange={(v) => setListItemField('pendidikan_lain', idx, 'frekuensi_belajar', v)} disabled={!editMode} />
                    <div className="col-span-2">
                      <Label className="text-xs uppercase text-slate-500">Lokasi Lembaga</Label>
                      {!editMode ? (
                        <div className="mt-1 px-3 py-2 rounded-md bg-slate-50 border border-slate-200 text-sm">{item.lokasi_lembaga || <span className="italic text-slate-400">-</span>}</div>
                      ) : (
                        <Textarea value={item.lokasi_lembaga || ''} onChange={(e) => setListItemField('pendidikan_lain', idx, 'lokasi_lembaga', e.target.value)} rows={2} className="mt-1" />
                      )}
                    </div>
                  </>
                )}
              />
            </TabsContent>

            <TabsContent value="kebutuhan-khusus" className="mt-4">
              <Section title="Kebutuhan Khusus" icon={HeartHandshake}>
                <div className="sm:col-span-2">
                  <SelectRow label="Jenis Kebutuhan Khusus" value={detail.jenis_kebutuhan_khusus} options={JENIS_KEBUTUHAN_KHUSUS_OPTIONS} onChange={(v) => setField('jenis_kebutuhan_khusus', v)} disabled={!editMode} testid="jenis-kebutuhan-khusus" />
                </div>
                <CheckboxGroupRow label="Kebutuhan Disabilitas" options={KEBUTUHAN_DISABILITAS_OPTIONS} values={detail.kebutuhan_disabilitas} onToggle={(v) => toggleArrayItem('kebutuhan_disabilitas', v)} disabled={!editMode} />
              </Section>
            </TabsContent>

            <TabsContent value="berkas" className="mt-4">
              <Section title="Upload Berkas (PDF, maks 2MB)" icon={FolderUp}>
                {BERKAS_LIST.map((b) => (
                  <FileUploadRow
                    key={b.key}
                    label={b.label}
                    url={detail[b.key]}
                    disabled={!editMode}
                    accept=".pdf"
                    uploading={uploadingKey === b.key}
                    onUpload={async (file) => {
                      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
                        toast.error('File harus berformat PDF');
                        return;
                      }
                      setUploadingKey(b.key);
                      const url = await uploadDetailFile(b.key, file);
                      if (url) setField(b.key, url);
                      setUploadingKey(null);
                    }}
                    onClear={() => setField(b.key, '')}
                  />
                ))}
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
  );

  const footerNode = (
    <>
      {!asPage && <Button variant="outline" onClick={onClose}>Tutup</Button>}
      {canEdit && editMode && (
        <Button onClick={handleSave} disabled={busy} className="bg-[#006837] hover:bg-[#0B7A3B] gap-2" data-testid="save-detail-button">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Simpan Detail
        </Button>
      )}
    </>
  );

  if (asPage) {
    return (
      <div className="space-y-4" data-testid="student-detail-page">
        <Card>
          <CardContent className="p-4">{headerNode}</CardContent>
        </Card>
        {bodyNode}
        <div className="flex justify-end gap-2">{footerNode}</div>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto" data-testid="student-detail-dialog">
        <DialogHeader>
          <DialogTitle>{headerNode}</DialogTitle>
        </DialogHeader>

        {bodyNode}

        <DialogFooter>
          {footerNode}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DynamicListSection({ title, icon: Icon, items = [], disabled, onAdd, onRemove, addLabel, emptyMessage, renderItem }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-[#006837]" />
            <h3 className="font-semibold text-slate-900 text-sm uppercase tracking-wide">{title}</h3>
          </div>
          {!disabled && (
            <Button size="sm" variant="outline" onClick={onAdd} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> {addLabel}
            </Button>
          )}
        </div>
        {items.length === 0 ? (
          <p className="text-center py-6 text-slate-400 text-sm">{emptyMessage}</p>
        ) : (
          <div className="space-y-4">
            {items.map((item, idx) => (
              <div key={idx} className="p-3 rounded-lg border border-slate-200 relative">
                {!disabled && (
                  <button type="button" onClick={() => onRemove(idx)}
                    className="absolute -top-2 -right-2 h-6 w-6 bg-rose-600 text-white rounded-full flex items-center justify-center hover:bg-rose-700">
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {renderItem(item, idx)}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FileUploadRow({ label, url, disabled, uploading, onUpload, onClear, accept = '.pdf' }) {
  const resolved = fileUrl(url);

  return (
    <div className="col-span-2 flex items-center justify-between gap-3 py-2 border-b border-slate-100 last:border-b-0">
      <Label className="text-sm text-slate-700">{label}</Label>
      {resolved ? (
        <div className="relative inline-flex items-center gap-2">
          <button type="button" onClick={() => openAuthedFile(url)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 text-xs hover:bg-slate-100">
            <FileText className="h-4 w-4" /> Lihat PDF
          </button>
          {!disabled && (
            <button type="button" onClick={onClear}
              className="h-6 w-6 bg-rose-600 text-white rounded-full flex items-center justify-center hover:bg-rose-700">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      ) : disabled ? (
        <div className="text-sm text-slate-400 italic">Belum diupload</div>
      ) : (
        <label className="px-3 py-1.5 border-2 border-dashed border-slate-300 rounded-lg flex items-center gap-1.5 cursor-pointer hover:border-[#006837] hover:bg-[#006837]/5 text-xs text-slate-500">
          {uploading ? (
            <span>Mengunggah...</span>
          ) : (
            <>
              <Upload className="h-3.5 w-3.5" /> Upload
            </>
          )}
          <input type="file" accept={accept} className="hidden" disabled={uploading}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ''; }} />
        </label>
      )}
    </div>
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

function InputRow({ label, value, onChange, type = 'text', disabled, readOnly, mono, maxLength, placeholder, error, inputMode }) {
  if (readOnly) return <FormRow label={label} value={value} mono={mono} />;
  return (
    <div>
      <Label className="text-xs uppercase text-slate-500">{label}</Label>
      <Input type={type} inputMode={inputMode} value={value ?? ''} onChange={(e) => onChange(e.target.value)} disabled={disabled} maxLength={maxLength} placeholder={placeholder}
        className={`mt-1 ${mono ? 'font-mono' : ''} ${error ? 'border-red-500 focus-visible:ring-red-500' : ''}`} />
      {error ? <p className="text-xs text-red-600 mt-1">{error}</p> : null}
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
