/**
 * Jembatan aplikasi ↔ halaman web madrasah di dalam WebView.
 *
 * Skrip disuntikkan SEBELUM halaman dimuat dan hanya berlaku di domain web madrasah:
 *  - menandai mode tertanam (window.__MATSA_EMBED__) → web menyembunyikan sidebar/topbar;
 *  - mengisi sesi web (matsa_token, matsa_user, matsa_active_role) dari sesi aplikasi,
 *    sehingga halaman langsung terbuka tanpa login ulang;
 *  - mencegat unduhan blob/data (ekspor PDF/Excel, rapor), window.open, tautan _blank, dan
 *    window.print, lalu meneruskannya ke aplikasi (simpan & bagikan / buka di browser).
 */
import type { User } from '@/api/types';

export type BridgeMessage =
  | { type: 'route'; path: string; title?: string }
  | { type: 'download'; name: string; mime: string; data: string }
  | { type: 'open'; url: string }
  | { type: 'print' }
  | { type: 'error'; message: string };

export function buildBridgeScript(opts: { host: string; token: string | null; user: User | null; activeRole: string | null }): string {
  const cfg = JSON.stringify({
    host: opts.host,
    token: opts.token,
    user: opts.user ? JSON.stringify({ ...opts.user, active_role: opts.activeRole ?? opts.user.active_role }) : null,
    role: opts.activeRole,
  });
  return `(function () {
  try {
    var CFG = ${cfg};
    if (location.host !== CFG.host) return;
    window.__MATSA_EMBED__ = true;
    try { sessionStorage.setItem('matsa_embed', '1'); } catch (e) {}
    try {
      if (CFG.token) {
        localStorage.setItem('matsa_token', CFG.token);
        if (CFG.user) localStorage.setItem('matsa_user', CFG.user);
        if (CFG.role) localStorage.setItem('matsa_active_role', CFG.role);
      }
      localStorage.removeItem('matsa_impersonation');
    } catch (e) {}

    var post = function (m) { try { window.ReactNativeWebView.postMessage(JSON.stringify(m)); } catch (e) {} };
    var EXT = {
      'application/pdf': 'pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'application/vnd.ms-excel': 'xls',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/msword': 'doc',
      'application/zip': 'zip',
      'application/json': 'json',
      'text/csv': 'csv',
      'text/plain': 'txt',
      'image/png': 'png',
      'image/jpeg': 'jpg'
    };
    var fileName = function (name, mime) {
      if (name) return String(name);
      return 'unduhan-' + Date.now() + '.' + (EXT[mime] || 'bin');
    };
    var sendBlob = function (blob, name) {
      var fr = new FileReader();
      fr.onloadend = function () {
        var res = String(fr.result || '');
        post({ type: 'download', name: fileName(name, blob.type), mime: blob.type || 'application/octet-stream', data: res.slice(res.indexOf(',') + 1) });
      };
      fr.onerror = function () { post({ type: 'error', message: 'Berkas gagal dibaca untuk diunduh.' }); };
      fr.readAsDataURL(blob);
    };
    var blobs = {};
    var origCreate = URL.createObjectURL.bind(URL);
    URL.createObjectURL = function (obj) {
      var url = origCreate(obj);
      try { if (obj instanceof Blob) blobs[url] = obj; } catch (e) {}
      return url;
    };
    var sendUrl = function (url, name) {
      if (url.indexOf('data:') === 0) {
        var m = url.match(/^data:([^;,]+)?((?:;[^;,]+)*?)(;base64)?,([\\s\\S]*)$/);
        if (!m) return post({ type: 'error', message: 'Format berkas tidak dikenal.' });
        var mime = m[1] || 'application/octet-stream';
        var data = m[3] ? m[4] : btoa(unescape(encodeURIComponent(decodeURIComponent(m[4]))));
        return post({ type: 'download', name: fileName(name, mime), mime: mime, data: data });
      }
      if (blobs[url]) return sendBlob(blobs[url], name);
      fetch(url).then(function (r) { return r.blob(); }).then(function (b) { sendBlob(b, name); })
        .catch(function () { post({ type: 'error', message: 'Berkas gagal diunduh.' }); });
    };
    var isFile = function (h) { return h.indexOf('blob:') === 0 || h.indexOf('data:') === 0; };

    var origClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      var h = this.href || '';
      if (isFile(h)) { sendUrl(h, this.getAttribute('download')); return; }
      if (this.target === '_blank' && h) { post({ type: 'open', url: h }); return; }
      return origClick.apply(this, arguments);
    };
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a') : null;
      if (!a) return;
      var h = a.href || '';
      if (isFile(h)) { e.preventDefault(); e.stopPropagation(); sendUrl(h, a.getAttribute('download')); }
      else if (a.target === '_blank' && h) { e.preventDefault(); e.stopPropagation(); post({ type: 'open', url: h }); }
    }, true);

    window.open = function (url) {
      var u = String(url || '');
      if (!u) return null;
      if (isFile(u)) { sendUrl(u, null); return null; }
      try { u = new URL(u, location.href).href; } catch (e) {}
      post({ type: 'open', url: u });
      return null;
    };
    window.print = function () { post({ type: 'print' }); };
  } catch (e) {}
})();
true;`;
}
