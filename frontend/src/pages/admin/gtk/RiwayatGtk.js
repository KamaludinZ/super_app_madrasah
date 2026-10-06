import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileCheck, FileText, Loader2, Pencil, Plus, Trash2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { api, openAuthedFile } from '@/lib/api';

/**
 * Definisi kolom tiap daftar riwayat GTK (disimpan sebagai array objek di field users).
 * tipe: teks | angka | tanggal | pilihan (opsi) ; wajib = harus diisi di dialog.
 */
export const DAFTAR_RIWAYAT_GTK = {
  riwayat_pendidikan: {
    judul: 'Riwayat Pendidikan Formal', satuan: 'pendidikan',
    kolom: [
      { key: 'jenjang', label: 'Jenjang', tipe: 'pilihan', opsi: ['SD/MI', 'SMP/MTs', 'SMA/MA/SMK', 'D1', 'D2', 'D3', 'D4', 'S1', 'S2', 'S3'], wajib: true },
      { key: 'nama_institusi', label: 'Nama Institusi', wajib: true },
      { key: 'jurusan', label: 'Jurusan' },
      { key: 'tahun_lulus', label: 'Tahun Lulus', tipe: 'angka' },
      { key: 'no_ijazah', label: 'No. Ijazah' },
    ],
  },
  riwayat_diklat: {
    judul: 'Riwayat Diklat/Pelatihan', satuan: 'diklat',
    kolom: [
      { key: 'nama', label: 'Nama Diklat/Pelatihan', wajib: true },
      { key: 'penyelenggara', label: 'Penyelenggara' },
      { key: 'tanggal', label: 'Tanggal', tipe: 'tanggal' },
      { key: 'durasi_jam', label: 'Durasi (Jam)', tipe: 'angka' },
      { key: 'no_sertifikat', label: 'No. Sertifikat' },
    ],
  },
  riwayat_penghargaan: {
    judul: 'Riwayat Penghargaan', satuan: 'penghargaan',
    kolom: [
      { key: 'jenis', label: 'Jenis Penghargaan', tipe: 'pilihan', opsi: ['Satyalancana', 'Piagam', 'Sertifikat', 'Lainnya'] },
      { key: 'nama', label: 'Nama Penghargaan', wajib: true },
      { key: 'pemberi', label: 'Pemberi' },
      { key: 'tahun', label: 'Tahun', tipe: 'angka' },
      { key: 'tingkat', label: 'Tingkat', tipe: 'pilihan', opsi: ['Sekolah', 'Kecamatan', 'Kabupaten/Kota', 'Provinsi', 'Nasional', 'Internasional'] },
    ],
  },
  data_anak: {
    judul: 'Data Anak', satuan: 'anak', tidakAda: { field: 'tidak_punya_anak', label: 'Tidak memiliki anak' },
    kolom: [
      { key: 'nama', label: 'Nama Lengkap', wajib: true },
      { key: 'jenis_kelamin', label: 'Jenis Kelamin', tipe: 'pilihan', opsi: ['Laki-laki', 'Perempuan'] },
      { key: 'tempat_lahir', label: 'Tempat Lahir' },
      { key: 'tanggal_lahir', label: 'Tanggal Lahir', tipe: 'tanggal' },
      { key: 'status', label: 'Status', tipe: 'pilihan', opsi: ['Anak Kandung', 'Anak Tiri', 'Anak Angkat'] },
    ],
  },
  riwayat_pesantren: {
    judul: 'Riwayat Pesantren', satuan: 'riwayat pesantren', tidakAda: { field: 'tidak_pernah_pesantren', label: 'Tidak pernah mondok di pesantren' },
    kolom: [
      { key: 'nama', label: 'Nama Pesantren', wajib: true },
      { key: 'lokasi', label: 'Lokasi' },
      { key: 'tahun_masuk', label: 'Tahun Masuk', tipe: 'angka' },
      { key: 'tahun_keluar', label: 'Tahun Keluar', tipe: 'angka' },
      { key: 'keterangan', label: 'Keterangan' },
    ],
  },
};

const formatSel = (k, v) => {
  if (v == null || v === '') return '-';
  if (k.tipe === 'tanggal') {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
    return m ? new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : String(v);
  }
  return String(v);
};

/** Validasi isian satu item riwayat -> pesan galat atau ''. */
export function validasiItemRiwayat(def, item) {
  for (const k of def.kolom) {
    const v = String(item[k.key] ?? '').trim();
    if (k.wajib && !v) return `${k.label} wajib diisi`;
    if (v && k.tipe === 'angka' && !/^\d+(\.\d+)?$/.test(v)) return `${k.label} harus berupa angka`;
    if (v && k.tipe === 'angka' && /tahun/.test(k.key) && !/^(19|20)\d{2}$/.test(v)) return `${k.label} harus 4 digit tahun`;
  }
  return '';
}

function FieldDialog({ k, nilai, onChange }) {
  if (k.tipe === 'pilihan') {
    return (
      <Select value={nilai || ''} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="Pilih..." /></SelectTrigger>
        <SelectContent>{k.opsi.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
      </Select>
    );
  }
  return (
    <Input type={k.tipe === 'tanggal' ? 'date' : 'text'} inputMode={k.tipe === 'angka' ? 'numeric' : undefined}
      value={nilai || ''} onChange={(e) => onChange(e.target.value)} />
  );
}

/**
 * Tabel satu daftar riwayat GTK + dialog tambah/ubah, hapus, dan penanda "tidak ada" (untuk anak/pesantren).
 * Perubahan ditampung di form dan tersimpan saat tombol Simpan halaman ditekan.
 */
export function DaftarRiwayatGtk({ jenis, items = [], tidakAda = false, onChange, onTidakAda, editing, testid }) {
  const def = DAFTAR_RIWAYAT_GTK[jenis];
  const [dialog, setDialog] = useState(null); // { index | null, item }
  const [galat, setGalat] = useState('');

  const buka = (index) => { setGalat(''); setDialog({ index, item: index == null ? {} : { ...items[index] } }); };
  const simpan = () => {
    const pesan = validasiItemRiwayat(def, dialog.item);
    if (pesan) { setGalat(pesan); return; }
    const bersih = Object.fromEntries(def.kolom.map((k) => [k.key, String(dialog.item[k.key] ?? '').trim()]));
    const baru = dialog.index == null ? [...items, bersih] : items.map((it, i) => (i === dialog.index ? bersih : it));
    onChange(baru);
    if (def.tidakAda && tidakAda) onTidakAda(false);
    setDialog(null);
  };

  return (
    <div className="space-y-3" data-testid={testid}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {def.tidakAda ? (
          <label className={`flex items-center gap-2 text-sm ${editing ? 'cursor-pointer' : ''}`}>
            <Checkbox checked={!!tidakAda} disabled={!editing || items.length > 0} onCheckedChange={(v) => onTidakAda(!!v)} data-testid={`${testid}-tidak-ada`} />
            {def.tidakAda.label}{items.length > 0 && <span className="text-xs text-slate-400">(hapus data dulu)</span>}
          </label>
        ) : <span />}
        <Button onClick={() => buka(null)} size="sm" disabled={!editing || !!tidakAda} className="bg-[#006837] hover:bg-[#0B7A3B]" data-testid={`${testid}-tambah`}>
          <Plus className="h-4 w-4 mr-1" /> Tambah
        </Button>
      </div>
      {!editing && <p className="text-xs text-slate-500">Klik <b>Edit Data</b> untuk menambah atau mengubah {def.satuan}.</p>}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {def.kolom.map((k) => <TableHead key={k.key}>{k.label}</TableHead>)}
              {editing && <TableHead className="text-right">Aksi</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={def.kolom.length + 1} className="text-center py-8 text-slate-500">
                  {tidakAda ? `Ditandai: ${def.tidakAda.label.toLowerCase()}.` : `Belum ada data ${def.satuan}.`}
                </TableCell>
              </TableRow>
            ) : items.map((it, i) => (
              <TableRow key={i}>
                {def.kolom.map((k) => <TableCell key={k.key}>{formatSel(k, it[k.key])}</TableCell>)}
                {editing && (
                  <TableCell className="text-right whitespace-nowrap">
                    <Button size="icon" variant="ghost" onClick={() => buka(i)} aria-label="Ubah"><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="Hapus">
                      <Trash2 className="h-4 w-4 text-rose-600" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!dialog} onOpenChange={(o) => { if (!o) setDialog(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{dialog?.index == null ? 'Tambah' : 'Ubah'} {def.judul}</DialogTitle></DialogHeader>
          {dialog && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {def.kolom.map((k) => (
                <div key={k.key} className={k.key.startsWith('nama') ? 'sm:col-span-2' : ''}>
                  <Label>{k.label}{k.wajib ? ' *' : ''}</Label>
                  <FieldDialog k={k} nilai={dialog.item[k.key]} onChange={(v) => setDialog((d) => ({ ...d, item: { ...d.item, [k.key]: v } }))} />
                </div>
              ))}
            </div>
          )}
          {galat && <p className="text-sm text-rose-600">{galat}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Batal</Button>
            <Button onClick={simpan} className="bg-[#006837] hover:bg-[#0B7A3B]" data-testid={`${testid}-simpan-item`}>Tampung</Button>
          </DialogFooter>
          <p className="text-xs text-slate-500">Data tersimpan setelah tombol Simpan di atas halaman ditekan.</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Pilih Fungsi/Jabatan GTK (multi) dari master jabatan aktif. */
export function PilihJabatanGtk({ value = [], onChange, disabled }) {
  const [daftar, setDaftar] = useState([]);
  useEffect(() => {
    api.get('/jabatan').then(({ data }) => setDaftar(Array.isArray(data) ? data : [])).catch(() => setDaftar([]));
  }, []);
  const nama = (jid) => daftar.find((j) => j.id === jid)?.name || 'Jabatan tidak dikenal';
  const tersedia = daftar.filter((j) => j.is_active !== false && !value.includes(j.id));
  return (
    <div className="space-y-2" data-testid="pilih-jabatan-gtk">
      <div className="flex flex-wrap gap-1.5">
        {value.length === 0 && <span className="text-sm italic text-slate-400">Belum ada fungsi/jabatan</span>}
        {value.map((jid) => (
          <Badge key={jid} variant="outline" className="gap-1 border-[#006837]/30 bg-[#006837]/5 text-[#006837]">
            {nama(jid)}
            {!disabled && <button type="button" onClick={() => onChange(value.filter((x) => x !== jid))} aria-label="Hapus"><X className="h-3 w-3" /></button>}
          </Badge>
        ))}
      </div>
      {!disabled && (
        <Select value="" onValueChange={(v) => onChange([...value, v])}>
          <SelectTrigger><SelectValue placeholder={tersedia.length ? 'Tambah fungsi/jabatan...' : 'Tidak ada jabatan lain'} /></SelectTrigger>
          <SelectContent>{tersedia.map((j) => <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>)}</SelectContent>
        </Select>
      )}
    </div>
  );
}

/** Daftar arsip berkas GTK. `field` = field users penyimpan URL; `jenis` = jenis unggahan di server. */
export const ARSIP_BERKAS_GTK = [
  { jenis: 'ktp', field: 'berkas_ktp', label: 'KTP', wajib: true },
  { jenis: 'kk', field: 'berkas_kk', label: 'Kartu Keluarga (KK)', wajib: true },
  { jenis: 'ijazah', field: 'berkas_ijazah', label: 'Ijazah Terakhir', wajib: true },
  { jenis: 'sk', field: 'berkas_sk', label: 'SK Pengangkatan', wajib: true },
  { jenis: 'npwp', field: 'berkas_npwp', label: 'NPWP' },
  { jenis: 'absensi', field: 'berkas_absensi', label: 'Absensi' },
  { jenis: 'skbk', field: 'berkas_skbk', label: 'SKBK/SKMT' },
  { jenis: 'skakpt', field: 'berkas_skakpt', label: 'SKAKPT' },
  { jenis: 'tunjangan', field: 'berkas_tunjangan', label: 'Tunjangan Non ASN' },
];

/** Tombol unggah/lihat/hapus satu berkas GTK (PDF/JPG/PNG maks 2MB). */
export function BerkasGtk({ gtkId, jenis, url, onChange, editing, testid }) {
  const [mengunggah, setMengunggah] = useState(false);
  const unggah = async (file) => {
    if (file.size > 2 * 1024 * 1024) { toast.error('Ukuran berkas maksimal 2MB'); return; }
    setMengunggah(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('gtk_id', gtkId);
      const { data } = await api.post(`/gtk/berkas/upload/${jenis}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      onChange(data.url);
      toast.success('Berkas terunggah — klik Simpan untuk menyimpan');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal mengunggah berkas');
    } finally {
      setMengunggah(false);
    }
  };
  return (
    <div className="flex items-center gap-2" data-testid={testid}>
      {url && (
        <Button type="button" size="sm" variant="outline" onClick={() => openAuthedFile(url)} className="gap-1">
          <FileText className="h-3.5 w-3.5" /> Lihat
        </Button>
      )}
      {editing && (
        <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-dashed border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:border-[#006837] hover:bg-[#006837]/5">
          {mengunggah ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} {url ? 'Ganti' : 'Upload'}
          <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" disabled={mengunggah}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) unggah(f); e.target.value = ''; }} />
        </label>
      )}
      {editing && url && (
        <Button type="button" size="icon" variant="ghost" onClick={() => onChange('')} aria-label="Hapus berkas"><Trash2 className="h-4 w-4 text-rose-600" /></Button>
      )}
      {!url && !editing && <span className="text-xs italic text-slate-400">Belum upload</span>}
    </div>
  );
}

export function ArsipBerkasGtk({ gtkId, nilai, onChange, editing }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="arsip-berkas-gtk">
      {ARSIP_BERKAS_GTK.map((b) => (
        <div key={b.field} className="rounded-lg border p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCheck className={`h-5 w-5 ${nilai[b.field] ? 'text-emerald-600' : 'text-slate-400'}`} />
              <span className="font-medium">{b.label}{b.wajib ? ' *' : ''}</span>
            </div>
            <Badge variant="outline" className={`text-xs ${nilai[b.field] ? 'border-emerald-200 text-emerald-700' : ''}`}>{nilai[b.field] ? 'Sudah upload' : 'Belum upload'}</Badge>
          </div>
          <BerkasGtk gtkId={gtkId} jenis={b.jenis} url={nilai[b.field]} editing={editing} testid={`berkas-${b.jenis}`}
            onChange={(url) => onChange({ ...nilai, [b.field]: url })} />
        </div>
      ))}
    </div>
  );
}
