/**
 * Jabatan Diagnostic Page
 *
 * Admin-only page to check if jabatan master data contains role names
 * Helps diagnose the public agenda jabatan display issue
 */

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, CheckCircle, XCircle, Users, Briefcase } from 'lucide-react';
import { toast } from 'sonner';

export default function JabatanDiagnostic() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const loadDiagnostic = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/jabatan/diagnostic/check-role-names');
      setData(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
      toast.error('Gagal memuat diagnostic data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDiagnostic();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-[#006837]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Diagnostic Jabatan</h1>
        <p className="text-slate-600 mt-1">
          Pemeriksaan data master jabatan untuk memastikan tidak menggunakan nama role
        </p>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">
              Total Jabatan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">
              {data?.total_jabatan || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">
              Jabatan dengan Nama Role
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="text-3xl font-bold text-rose-600">
                {data?.role_based_jabatan?.count || 0}
              </div>
              {data?.role_based_jabatan?.count > 0 && (
                <XCircle className="h-5 w-5 text-rose-600" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">
              User Tanpa Jabatan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="text-3xl font-bold text-amber-600">
                {data?.users_without_jabatan?.count || 0}
              </div>
              {data?.users_without_jabatan?.count > 0 && (
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overall Status */}
      {data?.has_issues ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Ditemukan masalah pada data jabatan!</strong><br />
            Silakan ikuti rekomendasi di bawah untuk memperbaiki.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="border-emerald-200 bg-emerald-50">
          <CheckCircle className="h-4 w-4 text-emerald-600" />
          <AlertDescription className="text-emerald-900">
            <strong>Data jabatan sudah baik!</strong><br />
            Tidak ditemukan jabatan dengan nama role.
          </AlertDescription>
        </Alert>
      )}

      {/* Recommendations */}
      {data?.recommendations && data.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Rekomendasi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.recommendations.map((rec, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-[#006837] mt-1">•</span>
                  <span className="text-slate-700">{rec}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Problem Jabatan (Using Role Names) */}
      {data?.role_based_jabatan?.count > 0 && (
        <Card className="border-rose-200">
          <CardHeader className="bg-rose-50">
            <CardTitle className="flex items-center gap-2 text-rose-900">
              <XCircle className="h-5 w-5" />
              Jabatan dengan Nama Role ({data.role_based_jabatan.count})
            </CardTitle>
            <CardDescription className="text-rose-700">
              Jabatan berikut menggunakan nama role dan HARUS dihapus atau diganti
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {data.role_based_jabatan.items.map((jab) => (
                <div key={jab.id} className="border border-rose-200 rounded-lg p-4 bg-rose-50/50">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-semibold text-rose-900">{jab.name}</h4>
                      {jab.description && (
                        <p className="text-sm text-slate-600">{jab.description}</p>
                      )}
                    </div>
                    <Badge variant="destructive">
                      Role Name
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-slate-600 mt-3">
                    <Users className="h-4 w-4" />
                    <span>
                      {jab.user_count} pengguna menggunakan jabatan ini
                    </span>
                  </div>

                  {jab.sample_users && jab.sample_users.length > 0 && (
                    <div className="mt-2 pl-6 space-y-1">
                      {jab.sample_users.map((user, idx) => (
                        <div key={idx} className="text-sm text-slate-600">
                          • {user.full_name} {user.nip && `(${user.nip})`}
                        </div>
                      ))}
                      {jab.user_count > 3 && (
                        <div className="text-sm text-slate-500">
                          ... dan {jab.user_count - 3} lainnya
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-3 p-3 bg-white border border-rose-200 rounded text-sm">
                    <strong className="text-rose-900">Solusi:</strong>
                    <ol className="list-decimal list-inside mt-1 space-y-1 text-slate-700">
                      <li>Buka menu Manajemen Pengguna</li>
                      <li>Edit user yang menggunakan jabatan "{jab.name}"</li>
                      <li>Pilih jabatan yang sesuai (bukan role!)</li>
                      <li>Setelah semua user dipindah, hapus jabatan "{jab.name}" ini</li>
                    </ol>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Proper Jabatan */}
      {data?.proper_jabatan?.count > 0 && (
        <Card className="border-emerald-200">
          <CardHeader className="bg-emerald-50">
            <CardTitle className="flex items-center gap-2 text-emerald-900">
              <CheckCircle className="h-5 w-5" />
              Jabatan yang Sudah Benar ({data.proper_jabatan.count})
            </CardTitle>
            <CardDescription className="text-emerald-700">
              Jabatan berikut menggunakan nama posisi yang tepat
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-3">
              {data.proper_jabatan.items.map((jab) => (
                <div key={jab.id} className="border border-emerald-200 rounded-lg p-3 bg-emerald-50/30">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium text-emerald-900">{jab.name}</h4>
                      {jab.description && (
                        <p className="text-sm text-slate-600 mt-1">{jab.description}</p>
                      )}
                    </div>
                    <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-300">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      OK
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-slate-600 mt-2">
                    <Users className="h-4 w-4" />
                    <span>{jab.user_count} pengguna</span>
                  </div>

                  {jab.sample_users && jab.sample_users.length > 0 && (
                    <div className="mt-2 pl-6 space-y-1">
                      {jab.sample_users.map((user, idx) => (
                        <div key={idx} className="text-sm text-slate-600">
                          • {user.full_name} {user.nip && `(${user.nip})`}
                        </div>
                      ))}
                      {jab.user_count > 3 && (
                        <div className="text-sm text-slate-500">
                          ... dan {jab.user_count - 3} lainnya
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Users Without Jabatan */}
      {data?.users_without_jabatan?.count > 0 && (
        <Card className="border-amber-200">
          <CardHeader className="bg-amber-50">
            <CardTitle className="flex items-center gap-2 text-amber-900">
              <AlertTriangle className="h-5 w-5" />
              Pengguna Tanpa Jabatan ({data.users_without_jabatan.count})
            </CardTitle>
            <CardDescription className="text-amber-700">
              Pengguna berikut belum memiliki jabatan
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-2">
              {data.users_without_jabatan.sample.map((user, idx) => (
                <div key={idx} className="border border-amber-200 rounded p-3 bg-amber-50/30">
                  <div className="font-medium text-amber-900">
                    {user.full_name} {user.nip && `(${user.nip})`}
                  </div>
                  {user.roles && user.roles.length > 0 && (
                    <div className="text-sm text-slate-600 mt-1">
                      Role: {user.roles.join(', ')}
                    </div>
                  )}
                </div>
              ))}
              {data.users_without_jabatan.count > 5 && (
                <div className="text-sm text-slate-500 text-center py-2">
                  ... dan {data.users_without_jabatan.count - 5} lainnya
                </div>
              )}
            </div>

            <div className="mt-4 p-3 bg-white border border-amber-200 rounded text-sm">
              <strong className="text-amber-900">Catatan:</strong>
              <p className="mt-1 text-slate-700">
                Pengguna tanpa jabatan akan menampilkan "Jabatan belum ditentukan" di halaman publik.
                Silakan edit pengguna dan pilihkan jabatan yang sesuai.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Refresh Button */}
      <div className="flex justify-center pt-4">
        <Button onClick={loadDiagnostic} variant="outline">
          <Loader2 className="h-4 w-4 mr-2" />
          Refresh Data
        </Button>
      </div>
    </div>
  );
}
