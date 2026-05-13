import React, { useEffect, useState } from 'react';
import { Bell, Megaphone, Lock, CheckCheck, Pin, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { api } from '@/lib/api';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

function formatRelative(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return 'Baru saja';
    if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} hari lalu`;
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

const SEVERITY_STYLES = {
  info: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
  success: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  warning: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  critical: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
};

function NotificationItem({ n, onClick }) {
  const Icon = n.icon === 'lock' ? Lock : Megaphone;
  const style = SEVERITY_STYLES[n.severity] || SEVERITY_STYLES.info;
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={`notif-item-${n.id}`}
      className={`w-full text-left px-3 py-3 border-l-2 transition-colors hover:bg-slate-50 ${
        n.is_read ? 'border-l-transparent opacity-70' : `${style.border}`
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${style.bg} ${style.text}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {n.is_pinned && <Pin className="h-3 w-3 text-amber-600" />}
            <p className={`text-sm leading-snug ${n.is_read ? 'text-slate-600' : 'text-slate-900 font-semibold'}`}>
              {n.title}
            </p>
            {!n.is_read && <span className="ml-auto h-2 w-2 rounded-full bg-[#006837] shrink-0" />}
          </div>
          <p className="text-xs text-slate-600 line-clamp-2 mt-0.5">{n.body}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-slate-400">{formatRelative(n.created_at)}</span>
            <Badge variant="outline" className="text-[9px] py-0 px-1 capitalize">
              {n.source === 'announcement' ? 'Pengumuman' : 'Sistem'}
            </Badge>
          </div>
        </div>
      </div>
    </button>
  );
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  const fetchUnread = async () => {
    try {
      const { data } = await api.get('/notifications/unread-count');
      setUnread(data.unread || 0);
    } catch { /* ignore */ }
  };

  const fetchList = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/notifications');
      setItems(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchUnread();
    const id = setInterval(fetchUnread, 60_000); // poll every minute
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (open) fetchList();
  }, [open]);

  const handleClick = async (n) => {
    if (!n.is_read && n.source === 'announcement') {
      try { await api.post(`/notifications/${n.source}/${n.source_id}/read`); } catch { /* */ }
    }
    setOpen(false);
    if (n.link) {
      nav(n.link);
    }
    fetchUnread();
  };

  const handleMarkAll = async () => {
    try {
      const { data } = await api.post('/notifications/mark-all-read');
      toast.success(`${data.marked_read} pengumuman ditandai sudah dibaca`);
      fetchList();
      fetchUnread();
    } catch (e) { toast.error('Gagal'); }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost" size="icon"
          data-testid="notification-bell"
          className="relative rounded-full hover:bg-[#006837]/8"
          aria-label={`Notifikasi (${unread} belum dibaca)`}
        >
          <Bell className="h-5 w-5 text-slate-700" />
          {unread > 0 && (
            <span data-testid="notification-badge"
                  className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[360px] p-0" data-testid="notification-menu">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-100">
          <div>
            <p className="text-sm font-semibold text-slate-900">Notifikasi</p>
            <p className="text-[10px] text-slate-500">{unread > 0 ? `${unread} belum dibaca` : 'Semua sudah dibaca'}</p>
          </div>
          {items.some((i) => !i.is_read && i.source === 'announcement') && (
            <Button variant="ghost" size="sm" onClick={handleMarkAll} className="h-7 text-xs gap-1" data-testid="btn-mark-all-read">
              <CheckCheck className="h-3.5 w-3.5" /> Tandai semua dibaca
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[420px]">
          {loading ? (
            <div className="py-12 text-center text-sm text-slate-500">Memuat…</div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center">
              <Bell className="h-8 w-8 mx-auto text-slate-300 mb-2" />
              <p className="text-sm text-slate-500">Belum ada notifikasi</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {items.map((n) => (
                <NotificationItem key={n.id} n={n} onClick={() => handleClick(n)} />
              ))}
            </div>
          )}
        </ScrollArea>
        <div className="border-t border-slate-100 px-3 py-2">
          <Button variant="ghost" size="sm" className="w-full justify-between text-xs h-8" onClick={() => { setOpen(false); nav('/pengumuman'); }} data-testid="btn-view-all-announcements">
            Lihat semua pengumuman
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
