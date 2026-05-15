import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QrCode, Download, Upload, Image as ImageIcon, Trash2, Printer, FileText } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

export default function AdminQRGeneratorPage() {
  const [rooms, setRooms] = useState([]);
  const [classes, setClasses] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('default');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [qrPreview, setQrPreview] = useState(null);
  const [cardPreview, setCardPreview] = useState(null);
  const [bulkPreview, setBulkPreview] = useState(null);
  const [mode, setMode] = useState('static');
  const [tplName, setTplName] = useState('');
  const fileInputRef = useRef(null);

  const refresh = async () => {
    const [r, c, t] = await Promise.all([api.get('/rooms'), api.get('/classes'), api.get('/qr-templates')]);
    setRooms(r.data); setClasses(c.data); setTemplates(t.data);
  };
  useEffect(() => { refresh(); }, []);

  // Get unique grade levels
  const grades = [...new Set(classes.map(c => c.grade))].sort((a, b) => a - b);

  const generateQR = async () => {
    if (!selectedRoom) { toast.error('Pilih ruangan dulu'); return; }
    try {
      const { data } = await api.get(`/rooms/${selectedRoom}/qr`, { params: { mode } });
      setQrPreview(data);
      setCardPreview(null);
      setBulkPreview(null);
      toast.success('QR Code dibuat');
    } catch (e) { toast.error('Gagal'); }
  };

  const generateCard = async () => {
    if (!selectedRoom) { toast.error('Pilih ruangan dulu'); return; }
    try {
      const form = new FormData();
      if (selectedTemplate && selectedTemplate !== 'default') form.append('template_id', selectedTemplate);
      if (selectedClass) {
        const cls = classes.find((c) => c.id === selectedClass);
        if (cls) form.append('class_name', cls.name);
      }
      const token = localStorage.getItem('matsa_token');
      const r = await fetch(`${BACKEND_URL}/api/rooms/${selectedRoom}/qr-card`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form,
      });
      if (!r.ok) throw new Error('Gagal generate');
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      setCardPreview(url);
      setBulkPreview(null);
      toast.success('Kartu B5 berhasil dibuat');
    } catch (e) { toast.error(e.message || 'Gagal'); }
  };

  const generateBulkByGrade = async () => {
    if (!selectedGrade) { toast.error('Pilih jenjang kelas dulu'); return; }
    try {
      const form = new FormData();
      form.append('grade', selectedGrade);
      if (selectedTemplate && selectedTemplate !== 'default') form.append('template_id', selectedTemplate);

      const token = localStorage.getItem('matsa_token');
      const r = await fetch(`${BACKEND_URL}/api/qr-cards/bulk-by-grade`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form,
      });
      if (!r.ok) {
        const errorText = await r.text();
        console.error('Bulk generation error:', r.status, errorText);
        throw new Error(`Gagal generate bulk (${r.status}): ${errorText.substring(0, 100)}`);
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      setBulkPreview({ url, type: blob.type, filename: `kartu-kelas-${selectedGrade}.${blob.type.includes('pdf') ? 'pdf' : 'png'}` });
      setCardPreview(null);
      setQrPreview(null);
      toast.success(`Kartu untuk semua kelas ${selectedGrade} berhasil dibuat!`);
    } catch (e) {
      console.error('Exception in generateBulkByGrade:', e);
      toast.error(e.message || 'Gagal');
    }
  };

  const downloadCard = () => {
    if (!cardPreview) return;
    const a = document.createElement('a');
    a.href = cardPreview; a.download = `qr-card-${rooms.find((r) => r.id === selectedRoom)?.name || 'room'}.png`;
    a.click();
  };

  const downloadBulk = () => {
    if (!bulkPreview) return;
    const a = document.createElement('a');
    a.href = bulkPreview.url;
    a.download = bulkPreview.filename;
    a.click();
  };

  const printBulk = () => {
    if (!bulkPreview) return;
    const printWindow = window.open(bulkPreview.url, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };

  const handleTemplateUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!tplName.trim()) { toast.error('Nama template wajib diisi'); return; }
    try {
      const form = new FormData();
      form.append('file', file); form.append('name', tplName);
      const token = localStorage.getItem('matsa_token');
      const r = await fetch(`${BACKEND_URL}/api/qr-templates`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form,
      });
      if (!r.ok) throw new Error('Upload gagal');
      toast.success('Template berhasil diunggah'); setTplName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      refresh();
    } catch (err) { toast.error(err.message); }
  };

  const deleteTemplate = async (t) => {
    if (!window.confirm(`Hapus template ${t.name}?`)) return;
    await api.delete(`/qr-templates/${t.id}`); toast.success('Dihapus'); refresh();
  };

  return (
    <div className="space-y-6">
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2"><QrCode className="h-3 w-3 mr-1" /> QR Generator</Badge>
        <h1 className="text-2xl sm:text-3xl font-bold">Generator QR Code Ruangan</h1>
        <p className="text-sm text-slate-600 mt-1">Buat QR Code unik per ruangan + Kartu B5 portrait untuk dicetak & ditempel</p>
      </div>

      <Tabs defaultValue="generate">
        <TabsList>
          <TabsTrigger value="generate" data-testid="qr-tab-generate">Generate Per Ruangan</TabsTrigger>
          <TabsTrigger value="bulk" data-testid="qr-tab-bulk">Cetak Per Jenjang</TabsTrigger>
          <TabsTrigger value="templates" data-testid="qr-tab-templates">Template Kartu B5</TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-5 space-y-3">
                <h2 className="text-base font-semibold mb-2">Pengaturan</h2>
                <div><Label>Pilih Ruangan</Label>
                  <Select value={selectedRoom} onValueChange={setSelectedRoom}>
                    <SelectTrigger data-testid="qr-room-select"><SelectValue placeholder="Pilih ruangan..." /></SelectTrigger>
                    <SelectContent>{rooms.map((r) => <SelectItem key={r.id} value={r.id}>{r.name} - {r.description}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Nama Kelas (opsional)</Label>
                  <Select value={selectedClass} onValueChange={setSelectedClass}>
                    <SelectTrigger><SelectValue placeholder="Otomatis dari ruangan" /></SelectTrigger>
                    <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Template Latar Belakang Kartu B5</Label>
                  <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                    <SelectTrigger data-testid="qr-template-select"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default (Hijau Kemenag)</SelectItem>
                      {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Mode QR</Label>
                  <Select value={mode} onValueChange={setMode}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="static">Statis (rekomendasi)</SelectItem>
                      <SelectItem value="dynamic">Dinamis (TOTP)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button onClick={generateQR} variant="outline" className="flex-1" data-testid="generate-qr-only"><QrCode className="h-4 w-4 mr-1" /> Preview QR</Button>
                  <Button onClick={generateCard} className="flex-1 bg-[#006837] hover:bg-[#0B7A3B]" data-testid="generate-qr-card"><Printer className="h-4 w-4 mr-1" /> Generate Kartu B5</Button>
                </div>
              </CardContent>
            </Card>

            <Card className="surface-ivory">
              <CardContent className="p-5">
                <h2 className="text-base font-semibold mb-3">Preview</h2>
                {cardPreview ? (
                  <div className="space-y-3">
                    <img src={cardPreview} alt="B5 Card" className="w-full max-w-md mx-auto rounded-lg shadow-lg border border-[#C8A24A]" data-testid="qr-generator-preview" />
                    <Button onClick={downloadCard} className="w-full bg-[#006837] hover:bg-[#0B7A3B] gap-2" data-testid="qr-generator-download-button"><Download className="h-4 w-4" /> Download Kartu B5 (PNG)</Button>
                    <div className="text-sm text-slate-500 text-center">Cetak pada kertas B5 portrait • 1386x1969 px @ 200 DPI</div>
                    <div className="text-sm text-emerald-700 font-semibold text-center bg-emerald-50 p-2 rounded-lg border border-emerald-200">✓ Token kelas ditampilkan di bawah QR code</div>
                  </div>
                ) : qrPreview ? (
                  <div className="space-y-3">
                    <img src={`data:image/png;base64,${qrPreview.qr_image_b64}`} alt="QR" className="w-full max-w-xs mx-auto rounded-lg border border-slate-200" />
                    <div className="text-sm font-mono text-slate-600 break-all p-3 bg-slate-100 rounded-lg">{qrPreview.token.substring(0, 100)}...</div>
                    <div className="text-sm text-slate-500 text-center">Ruangan: <span className="font-mono font-semibold">{qrPreview.room_name}</span> • Mode: {qrPreview.mode}</div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-400">
                    <QrCode className="h-12 w-12 mx-auto opacity-30 mb-2" />
                    <div className="text-sm">Pilih ruangan & klik Generate untuk melihat preview</div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="bulk" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Cetak Kartu Per Jenjang Kelas</CardTitle>
                <p className="text-sm text-slate-600 mt-1">Generate semua kartu QR untuk satu jenjang sekaligus dalam format siap cetak</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div><Label>Pilih Jenjang Kelas</Label>
                  <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                    <SelectTrigger data-testid="qr-grade-select"><SelectValue placeholder="Pilih jenjang (7, 8, atau 9)..." /></SelectTrigger>
                    <SelectContent>
                      {grades.map((g) => {
                        const count = classes.filter(c => c.grade === g).length;
                        return <SelectItem key={g} value={String(g)}>Kelas {g} ({count} kelas)</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Template Latar Belakang Kartu B5</Label>
                  <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default (Hijau Kemenag)</SelectItem>
                      {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                  <div className="flex items-start gap-2">
                    <FileText className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-900">
                      <div className="font-semibold mb-1">Format Output:</div>
                      <ul className="text-xs space-y-1 list-disc list-inside">
                        <li>Kartu disusun dalam kertas A4 (2 kartu per halaman)</li>
                        <li>Format PDF untuk multiple pages</li>
                        <li>Siap langsung untuk dicetak</li>
                        <li>Token kelas otomatis ditampilkan</li>
                      </ul>
                    </div>
                  </div>
                </div>
                <Button onClick={generateBulkByGrade} disabled={!selectedGrade} className="w-full bg-[#006837] hover:bg-[#0B7A3B] gap-2 h-12 text-base" data-testid="generate-bulk-button">
                  <Printer className="h-5 w-5" /> Generate Semua Kartu Kelas {selectedGrade || ''}
                </Button>
              </CardContent>
            </Card>

            <Card className="surface-ivory">
              <CardContent className="p-5">
                <h2 className="text-base font-semibold mb-3">Preview & Download</h2>
                {bulkPreview ? (
                  <div className="space-y-3">
                    {bulkPreview.type.includes('pdf') ? (
                      <div className="border-2 border-dashed border-[#C8A24A] rounded-lg p-8 text-center">
                        <FileText className="h-16 w-16 mx-auto text-[#006837] mb-3" />
                        <div className="font-semibold text-lg mb-1">PDF Siap Cetak</div>
                        <div className="text-sm text-slate-600 mb-4">Dokumen berisi semua kartu kelas {selectedGrade}</div>
                        <iframe src={bulkPreview.url} className="w-full h-96 border rounded-lg mb-3" title="PDF Preview" />
                      </div>
                    ) : (
                      <img src={bulkPreview.url} alt="Bulk Cards" className="w-full rounded-lg shadow-lg border border-[#C8A24A]" />
                    )}
                    <div className="flex gap-2">
                      <Button onClick={downloadBulk} className="flex-1 bg-[#006837] hover:bg-[#0B7A3B] gap-2"><Download className="h-4 w-4" /> Download</Button>
                      <Button onClick={printBulk} variant="outline" className="flex-1 gap-2"><Printer className="h-4 w-4" /> Print</Button>
                    </div>
                    <div className="text-xs text-slate-500 text-center">Format A4 • Siap cetak • {bulkPreview.type.includes('pdf') ? 'Multi-page PDF' : 'PNG'}</div>
                  </div>
                ) : (
                  <div className="text-center py-20 text-slate-400">
                    <FileText className="h-16 w-16 mx-auto opacity-30 mb-3" />
                    <div className="text-sm">Pilih jenjang kelas & klik Generate</div>
                    <div className="text-xs mt-1">Semua kartu akan muncul di sini</div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="templates" className="mt-4 space-y-4">
          <Card>
            <CardContent className="p-5">
              <h2 className="text-base font-semibold mb-3">Upload Template Latar Belakang Kartu B5</h2>
              <p className="text-xs text-slate-600 mb-3">Ukuran ideal: <strong>1386 x 1969 px</strong> (B5 portrait @ 200 DPI). Format PNG/JPG.</p>
              <div className="flex gap-2 mb-3">
                <Input value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="Nama template (mis: 'TP 2025/2026')" className="flex-1" data-testid="qr-template-name-input" />
                <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="gap-2" data-testid="qr-template-upload-button"><Upload className="h-4 w-4" /> Pilih File</Button>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleTemplateUpload} className="hidden" data-testid="qr-generator-template-upload" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {templates.length === 0 ? (
                  <div className="col-span-full text-center py-8 text-slate-400 text-sm">
                    <ImageIcon className="h-10 w-10 mx-auto opacity-30 mb-2" /> Belum ada template tersimpan
                  </div>
                ) : templates.map((t) => (
                  <div key={t.id} className="relative rounded-xl border border-slate-200 overflow-hidden group">
                    <img src={t.image_b64} alt={t.name} className="w-full aspect-[1386/1969] object-cover" />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-white text-sm">{t.name}</div>
                    <button onClick={() => deleteTemplate(t)} className="absolute top-2 right-2 p-1 bg-white/90 rounded-full shadow opacity-0 group-hover:opacity-100"><Trash2 className="h-3 w-3 text-rose-600" /></button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
