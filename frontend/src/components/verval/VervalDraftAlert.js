import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Send, X, Clock, Edit3, Trash2, XCircle, CheckCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

/**
 * Component to show alert for verval request status
 * - Shows "Ajukan Verval" button if there's a draft
 * - Shows "Batalkan Ajuan" and "Sesuaikan Kembali" if pending
 * - Shows "Perbaiki" button if rejected with admin notes
 */
export function VervalDraftAlert({ userId, userType, onRefresh }) {
  const [hasDraft, setHasDraft] = useState(false);
  const [draftData, setDraftData] = useState(null);
  const [pendingRequest, setPendingRequest] = useState(null);
  const [rejectedRequest, setRejectedRequest] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const STORAGE_KEY = `verval_draft_${userId}`;
  const DISMISSED_KEY = `verval_draft_dismissed_${userId}`;

  const checkRequests = async () => {
    try {
      const { data } = await api.get('/verval-requests');

      // Check for pending request
      const pending = data.find(req => req.status === 'pending' && req.user_id === userId);
      setPendingRequest(pending);

      // Check for latest rejected request
      const rejected = data
        .filter(req => req.status === 'rejected' && req.user_id === userId)
        .sort((a, b) => new Date(b.reviewed_at) - new Date(a.reviewed_at))[0];
      setRejectedRequest(rejected);

      return { pending, rejected };
    } catch (e) {
      console.error('Failed to check requests:', e);
      return { pending: null, rejected: null };
    }
  };

  const checkDraft = () => {
    const draft = localStorage.getItem(STORAGE_KEY);
    const isDismissed = sessionStorage.getItem(DISMISSED_KEY);

    if (draft && !isDismissed) {
      try {
        const parsedDraft = JSON.parse(draft);
        setDraftData(parsedDraft);
        setHasDraft(true);
        return true;
      } catch (e) {
        console.error('Failed to parse draft:', e);
      }
    }
    return false;
  };

  useEffect(() => {
    checkDraft();
    checkRequests();
  }, [STORAGE_KEY, DISMISSED_KEY, userId]);

  const handleSubmit = async () => {
    if (!draftData) return;

    setSubmitting(true);
    try {
      // Get current user data as old_data
      const { data: currentUser } = await api.get('/auth/me');

      // Create verval request
      await api.post('/verval-requests', {
        user_id: userId,
        user_type: userType,
        old_data: currentUser,
        new_data: draftData.new_data,
      });

      toast.success('Perubahan data berhasil diajukan untuk verifikasi!');

      // Clear draft from storage
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(DISMISSED_KEY);
      setHasDraft(false);
      setDraftData(null);

      // Refresh to show pending status
      await checkRequests();
      onRefresh?.();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal mengajukan perubahan data');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!pendingRequest) return;

    if (!window.confirm('Yakin ingin membatalkan ajuan verval? Data akan kembali ke draft.')) return;

    setSubmitting(true);
    try {
      // Delete the pending request
      await api.delete(`/verval-requests/${pendingRequest.id}`);

      toast.success('Ajuan verval dibatalkan');

      // Restore to draft
      const draft = {
        new_data: pendingRequest.new_data,
        saved_at: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));

      setPendingRequest(null);
      setHasDraft(true);
      setDraftData(draft);
      onRefresh?.();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal membatalkan ajuan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdjust = async () => {
    if (!pendingRequest) return;

    // Move pending request back to draft for editing
    const draft = {
      new_data: pendingRequest.new_data,
      saved_at: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));

    // Delete the pending request
    try {
      await api.delete(`/verval-requests/${pendingRequest.id}`);
      toast.success('Ajuan dipindahkan ke draft untuk disesuaikan');

      setPendingRequest(null);
      setHasDraft(true);
      setDraftData(draft);
      onRefresh?.();
    } catch (e) {
      toast.error('Gagal memindahkan ke draft');
    }
  };

  const handleFixRejected = () => {
    if (!rejectedRequest) return;

    // Move rejected data back to draft for fixing
    const draft = {
      new_data: rejectedRequest.new_data,
      saved_at: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));

    setRejectedRequest(null);
    setHasDraft(true);
    setDraftData(draft);
    toast.info('Data yang ditolak dipindahkan ke draft. Silakan perbaiki dan ajukan kembali.');
    onRefresh?.();
  };

  const handleDismissRejected = () => {
    sessionStorage.setItem(`verval_rejected_dismissed_${rejectedRequest?.id}`, 'true');
    setRejectedRequest(null);
  };

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISSED_KEY, 'true');
    setDismissed(true);
    setHasDraft(false);
  };

  const handleClearDraft = () => {
    if (!window.confirm('Yakin ingin menghapus draft perubahan?')) return;

    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(DISMISSED_KEY);
    setHasDraft(false);
    setDraftData(null);
    toast.success('Draft dihapus');
    onRefresh?.();
  };

  // Check if rejected notification was dismissed
  const isRejectedDismissed = rejectedRequest &&
    sessionStorage.getItem(`verval_rejected_dismissed_${rejectedRequest.id}`);

  // Priority: Show rejected > pending > draft
  if (rejectedRequest && !isRejectedDismissed && !pendingRequest && !hasDraft) {
    return (
      <Card className="bg-rose-50 border-rose-300 shadow-md mb-6 animate-in slide-in-from-top-4 duration-300">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <XCircle className="h-5 w-5 text-rose-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-rose-900 mb-1">
                Ajuan Verval Ditolak
              </h3>
              <p className="text-xs text-rose-800 mb-2">
                Ajuan perubahan data Anda ditolak oleh admin pada{' '}
                {new Date(rejectedRequest.reviewed_at).toLocaleDateString('id-ID', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
              {rejectedRequest.admin_notes && (
                <div className="bg-rose-100 border border-rose-200 rounded p-2 mb-3">
                  <p className="text-xs font-semibold text-rose-900 mb-1">Catatan Admin:</p>
                  <p className="text-xs text-rose-800">{rejectedRequest.admin_notes}</p>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleFixRejected}
                  className="bg-rose-600 hover:bg-rose-700 text-white gap-2"
                >
                  <Edit3 className="h-3 w-3" />
                  Perbaiki & Ajukan Lagi
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleDismissRejected}
                  className="text-rose-700 hover:bg-rose-100"
                >
                  <X className="h-3 w-3 mr-1" />
                  Tutup
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (pendingRequest && !dismissed) {
    return (
      <Card className="bg-blue-50 border-blue-300 shadow-md mb-6 animate-in slide-in-from-top-4 duration-300">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <Clock className="h-5 w-5 text-blue-600 animate-pulse" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-blue-900 mb-1">
                Ajuan Verval Sedang Diproses
              </h3>
              <p className="text-xs text-blue-800 mb-3">
                Perubahan data Anda sudah diajukan pada{' '}
                {new Date(pendingRequest.created_at).toLocaleDateString('id-ID', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
                {'. '}
                Menunggu verifikasi dari admin.
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleAdjust}
                  disabled={submitting}
                  variant="outline"
                  className="gap-2 border-blue-300 text-blue-700 hover:bg-blue-100"
                >
                  <Edit3 className="h-3 w-3" />
                  Sesuaikan Kembali
                </Button>
                <Button
                  size="sm"
                  onClick={handleCancelRequest}
                  disabled={submitting}
                  variant="outline"
                  className="gap-2 border-rose-300 text-rose-700 hover:bg-rose-50"
                >
                  <Trash2 className="h-3 w-3" />
                  {submitting ? 'Membatalkan...' : 'Batalkan Ajuan'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleDismiss}
                  disabled={submitting}
                  className="text-blue-700 hover:bg-blue-100"
                >
                  <X className="h-3 w-3 mr-1" />
                  Tutup
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (hasDraft && !dismissed) {
    return (
      <Card className="bg-amber-50 border-amber-300 shadow-md mb-6 animate-in slide-in-from-top-4 duration-300">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <AlertCircle className="h-5 w-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-amber-900 mb-1">
                Ada Perubahan Data yang Belum Diajukan
              </h3>
              <p className="text-xs text-amber-800 mb-1">
                Anda memiliki perubahan data yang tersimpan sementara pada{' '}
                {new Date(draftData.saved_at).toLocaleDateString('id-ID', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
              <p className="text-xs text-amber-800 mb-3">
                Klik "Ajukan Verval" untuk mengirim ke admin untuk diverifikasi.
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
                >
                  <Send className="h-3 w-3" />
                  {submitting ? 'Mengajukan...' : 'Ajukan Verval'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleClearDraft}
                  disabled={submitting}
                  className="text-rose-700 border-rose-300 hover:bg-rose-50 gap-2"
                >
                  <Trash2 className="h-3 w-3" />
                  Hapus Draft
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleDismiss}
                  disabled={submitting}
                  className="text-amber-700 hover:bg-amber-100"
                >
                  <X className="h-3 w-3 mr-1" />
                  Nanti Saja
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}

/**
 * Helper function to save draft changes to localStorage
 */
export function saveVervalDraft(userId, newData) {
  const STORAGE_KEY = `verval_draft_${userId}`;
  const draft = {
    new_data: newData,
    saved_at: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));

  // Clear dismissed state when new draft is saved
  sessionStorage.removeItem(`verval_draft_dismissed_${userId}`);
}

/**
 * Helper function to clear draft from localStorage
 */
export function clearVervalDraft(userId) {
  const STORAGE_KEY = `verval_draft_${userId}`;
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(`verval_draft_dismissed_${userId}`);
}

/**
 * Helper function to check if there's a pending verval request
 */
export async function hasPendingVervalRequest(userId) {
  try {
    const { data } = await api.get('/verval-requests');
    return data.some(req => req.status === 'pending' && req.user_id === userId);
  } catch (e) {
    return false;
  }
}

/**
 * Helper function to get verval draft data
 */
export function getVervalDraft(userId) {
  const STORAGE_KEY = `verval_draft_${userId}`;
  const draft = localStorage.getItem(STORAGE_KEY);
  if (draft) {
    try {
      return JSON.parse(draft);
    } catch (e) {
      return null;
    }
  }
  return null;
}
