/**
 * Buka berkas yang dilindungi login (path /api/... seperti sertifikat, foto, lampiran): diunduh dengan
 * token sesi aplikasi, disimpan sementara, lalu ditampilkan lewat lembar berbagi Android (buka dengan
 * penampil PDF/galeri). URL http(s) biasa dibuka di browser.
 */
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { API_URL } from '@/config';
import { getAuthToken } from '@/api/client';
import { openUrl } from '@/components/RichText';
import { toast } from '@/components/ui/Toast';

const API_ORIGIN = API_URL.replace(/\/api$/, '');

export async function openAuthedFile(pathOrUrl: string) {
  const isApi = pathOrUrl.startsWith('/api/') || pathOrUrl.startsWith(API_ORIGIN);
  if (!isApi) { openUrl(pathOrUrl); return; }
  const url = pathOrUrl.startsWith('/') ? `${API_ORIGIN}${pathOrUrl}` : pathOrUrl;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${getAuthToken() ?? ''}` } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const mime = res.headers.get('content-type')?.split(';')[0] || 'application/octet-stream';
    const disp = res.headers.get('content-disposition') || '';
    const fromHeader = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disp)?.[1];
    const name = decodeURIComponent(fromHeader || url.split('/').pop()?.split('?')[0] || `berkas-${Date.now()}`)
      .replace(/[\/:*?"<>|]+/g, '_');
    const file = new File(Paths.cache, name);
    if (file.exists) file.delete();
    file.create();
    file.write(new Uint8Array(await res.arrayBuffer()));
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: mime, dialogTitle: name });
    else toast.success('Berkas tersimpan', name);
  } catch {
    toast.error('Berkas tidak dapat dibuka. Periksa koneksi lalu coba lagi.');
  }
}
