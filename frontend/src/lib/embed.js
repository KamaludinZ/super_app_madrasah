/**
 * Mode tertanam (embed): halaman web dibuka di dalam aplikasi Android "Super Apps MATSANDATAMA"
 * (WebView). Aplikasi menyuntikkan `window.__MATSA_EMBED__ = true` sebelum halaman dimuat;
 * pada mode ini AppShell hanya menampilkan isi halaman (tanpa sidebar/topbar), karena navigasi,
 * ganti peran, notifikasi, dan keluar ditangani aplikasi.
 */
export function isEmbeddedApp() {
  try {
    return typeof window !== 'undefined' && (window.__MATSA_EMBED__ === true || sessionStorage.getItem('matsa_embed') === '1');
  } catch {
    return false;
  }
}

/** Kirim pesan ke aplikasi (judul halaman, rute, permintaan buka tautan). Aman dipanggil di web biasa. */
export function postToApp(message) {
  try {
    if (window.ReactNativeWebView?.postMessage) window.ReactNativeWebView.postMessage(JSON.stringify(message));
  } catch {
    /* abaikan */
  }
}
