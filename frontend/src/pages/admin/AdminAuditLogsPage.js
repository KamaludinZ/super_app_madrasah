import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ShieldCheck, Activity, Lock, AlertTriangle, Search } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { api } from '@/lib/api';

export default function AdminAuditLogsPage() {
  const [audit, setAudit] = useState([]);
  const [security, setSecurity] = useState([]);
  const [errors, setErrors] = useState([]);
  const [searchAudit, setSearchAudit] = useState('');
  const [searchSecurity, setSearchSecurity] = useState('');
  const [searchErrors, setSearchErrors] = useState('');

  useEffect(() => {
    api.get('/admin/audit-logs').then(({ data }) => {
      // Separate errors from regular audit logs
      const errorLogs = data.filter(log => log.action === 'error');
      const regularLogs = data.filter(log => log.action !== 'error');
      setAudit(regularLogs);
      setErrors(errorLogs);
    });
    api.get('/admin/security-logs').then(({ data }) => setSecurity(data));
  }, []);

  const filteredErrors = useMemo(() => {
    if (!searchErrors) return errors;
    const query = searchErrors.toLowerCase();
    return errors.filter(log =>
      log.username?.toLowerCase().includes(query) ||
      log.details?.error_type?.toLowerCase().includes(query) ||
      log.details?.message?.toLowerCase().includes(query) ||
      log.details?.path?.toLowerCase().includes(query)
    );
  }, [errors, searchErrors]);

  const filteredAudit = useMemo(() => {
    if (!searchAudit) return audit;
    const query = searchAudit.toLowerCase();
    return audit.filter(log =>
      log.username?.toLowerCase().includes(query) ||
      log.action?.toLowerCase().includes(query) ||
      log.entity?.toLowerCase().includes(query) ||
      log.ip_address?.toLowerCase().includes(query) ||
      JSON.stringify(log.details || {}).toLowerCase().includes(query)
    );
  }, [audit, searchAudit]);

  const filteredSecurity = useMemo(() => {
    if (!searchSecurity) return security;
    const query = searchSecurity.toLowerCase();
    return security.filter(log =>
      log.username?.toLowerCase().includes(query) ||
      log.event_type?.toLowerCase().includes(query) ||
      log.ip_address?.toLowerCase().includes(query) ||
      JSON.stringify(log.details || {}).toLowerCase().includes(query)
    );
  }, [security, searchSecurity]);

  return (
    <div className="space-y-6">
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2"><ShieldCheck className="h-3 w-3 mr-1" /> Log & Audit</Badge>
        <h1 className="text-2xl sm:text-3xl font-bold">Log Aktivitas Sistem</h1>
        <p className="text-sm text-slate-600 mt-1">Pantau aktivitas pengguna dan event keamanan</p>
      </div>

      <Tabs defaultValue="errors">
        <TabsList>
          <TabsTrigger value="errors" data-testid="tab-errors"><AlertTriangle className="h-4 w-4 mr-1" /> Errors ({errors.length})</TabsTrigger>
          <TabsTrigger value="audit" data-testid="tab-audit"><Activity className="h-4 w-4 mr-1" /> Audit Trail ({audit.length})</TabsTrigger>
          <TabsTrigger value="security" data-testid="tab-security"><Lock className="h-4 w-4 mr-1" /> Security Log ({security.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="errors" className="mt-4">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              data-testid="search-errors-input"
              placeholder="Cari error berdasarkan user, tipe, pesan, atau path..."
              value={searchErrors}
              onChange={(e) => setSearchErrors(e.target.value)}
              className="pl-10"
            />
          </div>
          <Card><CardContent className="p-0"><div className="overflow-x-auto">
            <Table data-testid="admin-error-logs-table">
              <TableHeader><TableRow>
                <TableHead>Waktu</TableHead><TableHead>Error Type</TableHead><TableHead>Message</TableHead><TableHead>Path</TableHead><TableHead>User</TableHead><TableHead>Details</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filteredErrors.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-500">{searchErrors ? 'Tidak ada hasil pencarian' : 'Belum ada error tercatat'}</TableCell></TableRow> :
                  filteredErrors.map((l) => (
                    <TableRow key={l.id} className="bg-rose-50/50">
                      <TableCell className="font-mono text-xs whitespace-nowrap">{new Date(l.timestamp).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'medium' })}</TableCell>
                      <TableCell><Badge className="bg-rose-100 text-rose-700 border-rose-300 font-mono text-xs">{l.details?.error_type || 'Unknown'}</Badge></TableCell>
                      <TableCell className="text-sm max-w-xs truncate" title={l.details?.message}>{l.details?.message || '-'}</TableCell>
                      <TableCell className="text-xs font-mono">{l.details?.path || '-'}</TableCell>
                      <TableCell className="text-sm">{l.username || 'System'}</TableCell>
                      <TableCell className="text-xs">
                        <details className="cursor-pointer">
                          <summary className="text-slate-600 hover:text-slate-900">View Traceback</summary>
                          <pre className="mt-2 text-[10px] bg-slate-900 text-green-400 p-2 rounded overflow-x-auto max-w-2xl">{l.details?.traceback || 'No traceback available'}</pre>
                        </details>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div></CardContent></Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              data-testid="search-audit-input"
              placeholder="Cari audit berdasarkan user, aksi, entitas, IP, atau detail..."
              value={searchAudit}
              onChange={(e) => setSearchAudit(e.target.value)}
              className="pl-10"
            />
          </div>
          <Card><CardContent className="p-0"><div className="overflow-x-auto">
            <Table data-testid="admin-audit-logs-table">
              <TableHeader><TableRow>
                <TableHead>Waktu</TableHead><TableHead>User</TableHead><TableHead>Aksi</TableHead><TableHead>Entitas</TableHead><TableHead>Detail</TableHead><TableHead>IP</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filteredAudit.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-500">{searchAudit ? 'Tidak ada hasil pencarian' : 'Belum ada log'}</TableCell></TableRow> :
                  filteredAudit.map((l) => (
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
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              data-testid="search-security-input"
              placeholder="Cari log keamanan berdasarkan event, username, IP, atau detail..."
              value={searchSecurity}
              onChange={(e) => setSearchSecurity(e.target.value)}
              className="pl-10"
            />
          </div>
          <Card><CardContent className="p-0"><div className="overflow-x-auto">
            <Table data-testid="admin-security-logs-table">
              <TableHeader><TableRow>
                <TableHead>Waktu</TableHead><TableHead>Event</TableHead><TableHead>Username</TableHead><TableHead>Detail</TableHead><TableHead>IP</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filteredSecurity.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-500">{searchSecurity ? 'Tidak ada hasil pencarian' : 'Belum ada log keamanan'}</TableCell></TableRow> :
                  filteredSecurity.map((l) => {
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
