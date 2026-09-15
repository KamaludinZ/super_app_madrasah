import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Calendar } from 'lucide-react';
import { api } from '@/lib/api';

const KelasJadwalPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [jadwal, setJadwal] = useState([]);

  const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  useEffect(() => {
    loadJadwal();
  }, []);

  const loadJadwal = async () => {
    try {
      setLoading(true);
      const res = await api.get('/kelas/jadwal');
      console.log('[JADWAL-NEW-VERSION] API Response:', res.data);
      console.log('[JADWAL-NEW-VERSION] Grouped schedules:', res.data.grouped);
      console.log('[JADWAL-NEW-VERSION] Number of grouped:', res.data.grouped?.length);
      // Use grouped format from backend (consecutive hours are already grouped)
      setJadwal(res.data.grouped || []);
      setLoading(false);
    } catch (err) {
      console.error('Error loading jadwal:', err);
      setError(err.response?.data?.detail || 'Gagal memuat jadwal kelas');
      setLoading(false);
    }
  };

  // Group schedules by day (case-insensitive)
  const groupedByDay = days.reduce((acc, day) => {
    acc[day] = jadwal.filter(item => item.day?.toLowerCase() === day.toLowerCase());
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-green-600" />
          <p className="text-sm text-gray-600">Memuat jadwal kelas...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Calendar className="h-8 w-8" />
          Jadwal Kelas
        </h1>
        <p className="text-gray-600 mt-2">
          Jadwal pelajaran mingguan kelas
        </p>
      </div>

      <div className="space-y-4">
        {days.map(day => {
          const daySchedules = groupedByDay[day] || [];

          if (daySchedules.length === 0) {
            return null;
          }

          return (
            <Card key={day}>
              <CardHeader>
                <CardTitle>{day}</CardTitle>
                <CardDescription>
                  {daySchedules.length} mata pelajaran
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px]">Jam</TableHead>
                        <TableHead>Mata Pelajaran</TableHead>
                        <TableHead>Guru</TableHead>
                        <TableHead>Ruangan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {daySchedules
                        .sort((a, b) => {
                          const timeA = a.start_time || '00:00';
                          const timeB = b.start_time || '00:00';
                          return timeA.localeCompare(timeB);
                        })
                        .map((schedule, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono text-sm">
                              {schedule.start_time && schedule.end_time ? (
                                <div>
                                  <div>
                                    {schedule.start_time.substring(0, 5)} - {schedule.end_time.substring(0, 5)}
                                  </div>
                                  {schedule.duration_minutes && (
                                    <div className="text-xs text-gray-500 mt-1">
                                      {schedule.duration_minutes} menit
                                    </div>
                                  )}
                                </div>
                              ) : (
                                '-'
                              )}
                            </TableCell>
                            <TableCell className="font-semibold">
                              <div>
                                {schedule.subject_name}
                                {schedule.subject_code && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    {schedule.subject_code}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                {schedule.teacher_name}
                                {schedule.teacher_nip && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    NIP: {schedule.teacher_nip}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {schedule.room_name ? (
                                <Badge variant="outline">{schedule.room_name}</Badge>
                              ) : (
                                '-'
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {jadwal.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            Belum ada jadwal untuk kelas ini
          </div>
        )}
      </div>
    </div>
  );
};

export default KelasJadwalPage;
