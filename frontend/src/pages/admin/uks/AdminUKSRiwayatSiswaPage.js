import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ArrowLeft, HeartPulse, Stethoscope, Syringe, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { compareKunjunganTerbaru } from './RiwayatKunjunganPanel';
import RiwayatKunjunganTab from './RiwayatKunjunganTab';
import RiwayatCkgTab from './RiwayatCkgTab';

/**
 * Halaman Riwayat UKS seorang siswa (dibuka dari Menu UKS > Data Siswa).
 * Tab 1: seluruh riwayat kunjungan UKS. Tab 2: riwayat pemeriksaan CKG.
 */
export default function AdminUKSRiwayatSiswaPage() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const { activeRole, user } = useAuth();
  // Tombol pintasan input hanya untuk yang mengelola UKS; wali kelas & kepala sekolah hanya melihat.
  const canManage = activeRole === 'unit_kesehatan' || activeRole === 'admin' || user?.roles?.includes('admin');
  const [tab, setTab] = useState('kunjungan');
  const [profile, setProfile] = useState(null);
  const [kunjungan, setKunjungan] = useState([]);
  const [ckg, setCkg] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [errorDetail, setErrorDetail] = useState('');

  useEffect(() => { loadData(); }, [studentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = async () => {
    setLoading(true);
    setError(false);
    try {
      const [kRes, cRes] = await Promise.all([
        api.get(`/uks/siswa/${studentId}/riwayat-kunjungan`),
        api.get(`/uks/siswa/${studentId}/riwayat-ckg`),
      ]);
      setProfile(kRes.data?.siswa || null);
      setKunjungan([...(kRes.data?.items || [])].sort(compareKunjunganTerbaru));
      setCkg(cRes.data?.items || []); // sudah urut terbaru dari server
    } catch (e) {
      setError(true);
      setErrorDetail(e?.response?.status === 403 ? (e?.response?.data?.detail || 'Anda tidak memiliki akses ke riwayat UKS siswa ini.') : '');
      toast.error(e?.response?.data?.detail || 'Gagal memuat riwayat UKS siswa');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-uks-riwayat-siswa-page">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <HeartPulse className="h-3 w-3 mr-1" /> Menu UKS
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Riwayat UKS Siswa</h1>
          {profile ? (
            <p className="text-sm text-slate-600 mt-1">
              <span className="font-semibold text-slate-800">{profile.nama}</span>
              {profile.kelas && <> · Kelas {profile.kelas}</>}
              {profile.umur && <> · {profile.umur}</>}
              {profile.wali_kelas_nama && <> · Wali kelas: {profile.wali_kelas_nama}</>}
            </p>
          ) : (
            <p className="text-sm text-slate-600 mt-1">Riwayat kunjungan dan pemeriksaan CKG siswa</p>
          )}
        </div>
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/admin/uks/data-siswa'))}
        >
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Button>
      </div>

      {error ? (
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <p className="text-slate-600">{errorDetail || 'Riwayat UKS siswa gagal dimuat.'}</p>
            {!errorDetail && <Button variant="outline" onClick={loadData} className="gap-2"><RefreshCw className="h-4 w-4" /> Coba lagi</Button>}
          </CardContent>
        </Card>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-white border border-slate-200">
            <TabsTrigger value="kunjungan"><Stethoscope className="h-4 w-4 mr-2" /> Riwayat Kunjungan ({loading ? '…' : kunjungan.length})</TabsTrigger>
            <TabsTrigger value="ckg"><Syringe className="h-4 w-4 mr-2" /> Riwayat CKG ({loading ? '…' : ckg.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="kunjungan" className="mt-4">
            <Card>
              <CardContent className="p-4">
                <RiwayatKunjunganTab items={kunjungan} loading={loading} canManage={canManage} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ckg" className="mt-4">
            <Card>
              <CardContent className="p-4">
                <RiwayatCkgTab items={ckg} loading={loading} canManage={canManage} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

