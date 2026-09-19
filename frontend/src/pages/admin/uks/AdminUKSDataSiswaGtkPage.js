import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, GraduationCap, Briefcase, ArrowRight } from 'lucide-react';

export default function AdminUKSDataSiswaGtkPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6" data-testid="admin-uks-data-siswa-gtk-page">
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
          <Users className="h-3 w-3 mr-1" /> Menu UKS
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Data Siswa dan GTK</h1>
        <p className="text-sm text-slate-600 mt-1">Rujukan data identitas siswa dan GTK untuk keperluan pelayanan UKS</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/admin/uks/data-siswa')}>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-slate-900">Data Siswa</div>
              <div className="text-sm text-slate-500 mt-0.5">Lihat data identitas dan kelas siswa</div>
            </div>
            <Button size="icon" variant="ghost" className="text-slate-400">
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/admin/uks/data-gtk')}>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <Briefcase className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-slate-900">Data GTK</div>
              <div className="text-sm text-slate-500 mt-0.5">Lihat data identitas guru dan tenaga kependidikan</div>
            </div>
            <Button size="icon" variant="ghost" className="text-slate-400">
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
