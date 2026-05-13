import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Activity, Lock } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { api } from '@/lib/api';

export default function AdminAuditLogsPage() {
  const [audit, setAudit] = useState([]);
  const [security, setSecurity] = useState([]);
  useEffect(() => {
    api.get('/admin/audit-logs').then(({ data }) => setAudit(data));
    api.get('/admin/security-logs').then(({ data }) => setSecurity(data));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2"><ShieldCheck className="h-3 w-3 mr-1" /> Log & Audit</Badge>
        <h1 className="text-2xl sm:text-3xl font-bold">Log Aktivitas Sistem</h1>
        <p className="text-sm text-slate-600 mt-1">Pantau aktivitas pengguna dan event keamanan</p>
      </div>

      <Tabs defaultValue="audit">
        <TabsList>
          <TabsTrigger value="audit" data-testid="tab-audit"><Activity className="h-4 w-4 mr-1" /> Audit Trail ({audit.length})</TabsTrigger>
          <TabsTrigger value="security" data-testid="tab-security"><Lock className="h-4 w-4 mr-1" /> Security Log ({security.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="audit" className="mt-4">
          <Card><CardContent className="p-0"><div className="overflow-x-auto">
            <Table data-testid="admin-audit-logs-table">
              <TableHeader><TableRow>
                <TableHead>Waktu</TableHead><TableHead>User</TableHead><TableHead>Aksi</TableHead><TableHead>Entitas</TableHead><TableHead>Detail</TableHead><TableHead>IP</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {audit.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-500">Belum ada log</TableCell></TableRow> :
                  audit.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-mono text-xs whitespace-nowrap">{new Date(l.timestamp).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'medium' })}</TableCell>
                      <TableCell className="text-sm">{l.username || '-'}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{l.action}</Badge></TableCell>
                      <TableCell className="text-sm">{l.entity}</TableCell>
                      <TableCell className="text-xs font-mono max-w-xs truncate">{JSON.stringify(l.details || {})}</TableCell>
                      <TableCell className="text-xs font-mono">{l.ip_address || '-'}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div></CardContent></Card>
        </TabsContent>

        <TabsContent value="security" className="mt-4">
          <Card><CardContent className="p-0"><div className="overflow-x-auto">
            <Table data-testid="admin-security-logs-table">
              <TableHeader><TableRow>
                <TableHead>Waktu</TableHead><TableHead>Event</TableHead><TableHead>Username</TableHead><TableHead>Detail</TableHead><TableHead>IP</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {security.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-500">Belum ada log keamanan</TableCell></TableRow> :
                  security.map((l) => {
                    const isWarn = ['login_failed', 'locked', 'locked_attempt', 'captcha_failed', 'journal_blocked'].includes(l.event_type);
                    return (
                      <TableRow key={l.id}>
                        <TableCell className="font-mono text-xs whitespace-nowrap">{new Date(l.timestamp).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'medium' })}</TableCell>
                        <TableCell><Badge className={isWarn ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}>{l.event_type}</Badge></TableCell>
                        <TableCell className="text-sm">{l.username || '-'}</TableCell>
                        <TableCell className="text-xs font-mono max-w-xs truncate">{JSON.stringify(l.details || {})}</TableCell>
                        <TableCell className="text-xs font-mono">{l.ip_address || '-'}</TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </div></CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
