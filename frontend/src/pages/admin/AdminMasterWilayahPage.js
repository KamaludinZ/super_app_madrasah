import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Map } from 'lucide-react';
import WilayahBertingkat from '@/components/wilayah/WilayahBertingkat';
import PaketWilayahCard from './PaketWilayahCard';

/**
 * Halaman Master Wilayah Indonesia (admin): mencoba form alamat bertingkat
 * provinsi -> kabupaten/kota -> kecamatan -> desa/kelurahan beserta kode pos.
 */
export default function AdminMasterWilayahPage() {
  const [wilayah, setWilayah] = useState({ provinsi: null, kabupaten: null, kecamatan: null, desa: null });
  const [info, setInfo] = useState({ kode_pos: '', kode_wilayah: '' });
  const [alamat, setAlamat] = useState('');

  const ringkas = [alamat, wilayah.desa?.nama, wilayah.kecamatan?.nama, wilayah.kabupaten?.nama, wilayah.provinsi?.nama, info.kode_pos]
    .filter(Boolean).join(', ');

  return (
    <div className="space-y-6" data-testid="admin-master-wilayah-page">
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
          <Map className="h-3 w-3 mr-1" /> Master Wilayah
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Master Wilayah Indonesia</h1>
        <p className="text-sm text-slate-600 mt-1">Rujukan alamat bertingkat: provinsi, kabupaten/kota, kecamatan, desa/kelurahan, dan kode pos.</p>
      </div>

      <PaketWilayahCard />

      <Card>
        <CardHeader><CardTitle className="text-lg">Form Alamat Bertingkat</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Alamat (jalan, nomor, dusun)</Label>
            <Input value={alamat} onChange={(e) => setAlamat(e.target.value)} placeholder="mis. Jl. Melati No. 2" data-testid="input-alamat-jalan" />
          </div>
          <WilayahBertingkat value={wilayah} onChange={(v, i) => { setWilayah(v); setInfo((lama) => ({ kode_wilayah: i.kode_wilayah, kode_pos: i.kode_pos ?? lama.kode_pos })); }} testidPrefix="demo-wilayah" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Kode Pos</Label>
              <Input value={info.kode_pos} readOnly placeholder="Terisi dari desa/kelurahan" data-testid="kode-pos-otomatis" />
            </div>
            <div>
              <Label>Kode Wilayah</Label>
              <Input value={info.kode_wilayah} readOnly className="font-mono" data-testid="kode-wilayah" />
            </div>
          </div>
          {ringkas && (
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700" data-testid="alamat-lengkap">
              <span className="text-xs text-slate-500 block">Alamat lengkap</span>{ringkas}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
