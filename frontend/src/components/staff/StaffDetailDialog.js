import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  User, Briefcase, MapPin, Save, Loader2, Phone, Mail,
  GraduationCap, Pencil, Hash,
} from 'lucide-react';
import { api, ROLE_LABELS } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';

const PENDIDIKAN_OPTIONS = ['SMA/Sederajat', 'D1', 'D2', 'D3', 'D4/S1', 'S2', 'S3', 'Lainnya'];
const STATUS_KEPEGAWAIAN = ['PNS', 'PPPK', 'Honorer', 'Tetap Yayasan', 'GTT', 'PTT', 'Lainnya'];
const AGAMA_OPTIONS = ['Islam', 'Kristen Protestan', 'Katolik', 'Hindu', 'Buddha', 'Kong hu cu'];

export default function StaffDetailDialog({ user: staffUser, open, onClose, autoEdit = false }) {
  const { user: currentUser, activeRole } = useAuth();
  const isAdmin = activeRole === 'admin' || currentUser?.roles?.includes('admin');
  const canEdit = isAdmin || staffUser?.id === currentUser?.id;

  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(autoEdit);
  const [data, setData] = useState({});
  const [busy, setBusy] = useState(false);
  const [jabatanList, setJabatanList] = useState([]);

  useEffect(() => {
    if (!staffUser?.id) return;
    (async () => {
      setLoading(true);
      try {
        const [userRes, jabatanRes] = await Promise.all([
          api.get('/users'),
          api.get('/jabatan/active')
        ]);
        const found = (userRes.data || []).find((u) => u.id === staffUser.id);
        setData(found || staffUser);
        setJabatanList(jabatanRes.data || []);
      } finally { setLoading(false); }
    })();
  }, [staffUser?.id]);

  const setField = (k, v) => setData({ ...data, [k]: v });

  const toggleJabatan = (jid) => {
    const current = data.jabatan_ids || [];
    if (current.includes(jid)) {
      setData({ ...data, jabatan_ids: current.filter((id) => id !== jid) });
    } else {
      setData({ ...data, jabatan_ids: [...current, jid] });
    }
  };

  const handleSave = async () => {
    setBusy(true);
    try {
      const payload = { ...data };
      delete payload.password_hash;
      delete payload.id; delete payload._id;
      delete payload.roles; // roles diatur via admin users page
      await api.put(`/users/${staffUser.id}`, payload);
      toast.success('Data GTK disimpan');
      setEditMode(false);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menyimpan');
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto" data-testid="staff-detail-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 flex-wrap">
            <Briefcase className="h-5 w-5 text-[#006837]" />
            <span>{data?.full_name || staffUser?.full_name}</span>
            {data?.nip_nuptk && <Badge variant="outline" className="font-mono text-xs">NIP/NUPTK: {data.nip_nuptk}</Badge>}
            <div className="flex gap-1 flex-wrap">
              {(data?.roles || []).filter((r) => r !== 'siswa').map((r) => (
                <Badge key={r} className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 text-xs">{ROLE_LABELS[r] || r}</Badge>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-2">
              {canEdit && !editMode && (
                <Button size="sm" variant="outline" onClick={() => setEditMode(true)} className="gap-1" data-testid="enable-edit-button">
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
              )}
              {editMode && <Badge className="bg-amber-100 text-amber-700 border-amber-200">MODE EDIT</Badge>}
            </div>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-[#006837]" />
            Memuat...
          </div>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <User className="h-4 w-4 text-[#006837]" />
                  <h3 className="font-semibold text-sm uppercase tracking-wide">Identitas Pribadi</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Nama Lengkap" value={data.full_name} onChange={(v) => setField('full_name', v)} disabled={!editMode} />
                  <Field label="NIP/NUPTK" value={data.nip_nuptk} onChange={(v) => setField('nip_nuptk', v)} disabled={!editMode} mono />
                  <SelectField label="Jenis Kelamin" value={data.gender} options={['L', 'P']} labelMap={{ L: 'Laki-laki', P: 'Perempuan' }}
                    onChange={(v) => setField('gender', v)} disabled={!editMode} />
                  <Field label="Tempat Lahir" value={data.birth_place} onChange={(v) => setField('birth_place', v)} disabled={!editMode} />
                  <Field label="Tanggal Lahir" type="date" value={data.birth_date} onChange={(v) => setField('birth_date', v)} disabled={!editMode} />
                  <SelectField label="Agama" value={data.agama} options={AGAMA_OPTIONS} onChange={(v) => setField('agama', v)} disabled={!editMode} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <GraduationCap className="h-4 w-4 text-[#006837]" />
                  <h3 className="font-semibold text-sm uppercase tracking-wide">Riwayat Pendidikan & Kepegawaian</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <SelectField label="Pendidikan Terakhir" value={data.pendidikan_terakhir} options={PENDIDIKAN_OPTIONS} onChange={(v) => setField('pendidikan_terakhir', v)} disabled={!editMode} />
                  <Field label="Jurusan / Program Studi" value={data.jurusan} onChange={(v) => setField('jurusan', v)} disabled={!editMode} />
                  <SelectField label="Status Kepegawaian" value={data.status_kepegawaian} options={STATUS_KEPEGAWAIAN} onChange={(v) => setField('status_kepegawaian', v)} disabled={!editMode} />
                  <Field label="Mulai Bertugas" type="date" value={data.tmt_mulai} onChange={(v) => setField('tmt_mulai', v)} disabled={!editMode} />
                  <Field label="Mata Pelajaran Diampu" value={data.mapel_diampu} onChange={(v) => setField('mapel_diampu', v)} disabled={!editMode} placeholder="Mis. Matematika, IPA" />
                  <div className="sm:col-span-2">
                    <Label className="text-xs uppercase text-slate-500">Jabatan (boleh lebih dari satu)</Label>
                    {editMode ? (
                      <div className="grid grid-cols-2 gap-2 mt-2 max-h-40 overflow-y-auto p-2 border border-slate-200 rounded-lg">
                        {jabatanList.length === 0 ? (
                          <p className="text-sm text-slate-400 col-span-2 py-2">Belum ada jabatan. Kelola di menu Jabatan.</p>
                        ) : (
                          jabatanList.map((j) => (
                            <label key={j.id} className="flex items-center gap-2 cursor-pointer text-sm">
                              <Checkbox checked={(data.jabatan_ids || []).includes(j.id)} onCheckedChange={() => toggleJabatan(j.id)} />
                              <span>{j.name}</span>
                            </label>
                          ))
                        )}
                      </div>
                    ) : (
                      <div className="mt-1 px-3 py-2 rounded-md bg-slate-50 border border-slate-200 min-h-[42px]">
                        {(data.jabatan_ids || []).length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {(data.jabatan_ids || []).map((jid) => {
                              const j = jabatanList.find((jab) => jab.id === jid);
                              return j ? (
                                <Badge key={jid} variant="outline" className="text-xs">{j.name}</Badge>
                              ) : null;
                            })}
                          </div>
                        ) : (
                          <span className="italic text-slate-400 text-sm">-</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <Phone className="h-4 w-4 text-[#006837]" />
                  <h3 className="font-semibold text-sm uppercase tracking-wide">Kontak & Alamat</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Email" type="email" value={data.email} onChange={(v) => setField('email', v)} disabled={!editMode} />
                  <Field label="Nomor HP" type="tel" value={data.phone} onChange={(v) => setField('phone', v)} disabled={!editMode} mono />
                  <div className="sm:col-span-2">
                    <Label className="text-xs uppercase text-slate-500">Alamat</Label>
                    {editMode ? (
                      <Textarea value={data.address || ''} onChange={(e) => setField('address', e.target.value)} rows={2} className="mt-1" placeholder="Jl. ..." />
                    ) : (
                      <div className="mt-1 px-3 py-2 rounded-md bg-slate-50 border border-slate-200 text-sm">{data.address || <span className="italic text-slate-400">-</span>}</div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Tutup</Button>
          {canEdit && editMode && (
            <Button onClick={handleSave} disabled={busy} className="bg-[#006837] hover:bg-[#0B7A3B] gap-2" data-testid="save-staff-button">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Simpan
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, onChange, type = 'text', disabled, mono, placeholder }) {
  return (
    <div>
      <Label className="text-xs uppercase text-slate-500">{label}</Label>
      {disabled ? (
        <div className={`mt-1 px-3 py-2 rounded-md bg-slate-50 border border-slate-200 text-sm ${mono ? 'font-mono' : ''} ${value ? 'text-slate-900' : 'text-slate-400 italic'}`}>{value || '-'}</div>
      ) : (
        <Input type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={`mt-1 ${mono ? 'font-mono' : ''}`} placeholder={placeholder} />
      )}
    </div>
  );
}

function SelectField({ label, value, options, labelMap, onChange, disabled }) {
  if (disabled) {
    return <Field label={label} value={labelMap?.[value] || value} disabled />;
  }
  return (
    <div>
      <Label className="text-xs uppercase text-slate-500">{label}</Label>
      <Select value={value || ''} onValueChange={onChange}>
        <SelectTrigger className="mt-1"><SelectValue placeholder="Pilih..." /></SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o} value={o}>{labelMap?.[o] || o}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
